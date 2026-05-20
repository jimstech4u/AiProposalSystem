import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Sparkles, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { extractJsonObject, generateWithGemini, getGeminiErrorMessage } from '../../../lib/gemini';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson, saveJson } from '../../../lib/storage';
import { insertRow } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';

export default function TimelinePrediction() {
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const projectId = readJson<string | null>('latestProjectId', null);
  const session = getStoredSession();
  const [calculating, setCalculating] = useState(false);
  const [phases, setPhases] = useState(readJson<any[]>('latestTimelinePhases', []));

  const [milestones, setMilestones] = useState(readJson<any[]>('latestTimelineMilestones', []));
  const totalWeeks = phases.reduce((sum, phase) => sum + Number(phase.duration || 0), 0);

  const exportTimeline = () => {
    downloadTextFile(
      'timeline-prediction-report.txt',
      toReport('AI Timeline Prediction Report', [
        { heading: 'Total Duration', body: `${totalWeeks} weeks` },
        { heading: 'Phases', body: phases.map((phase) => `- ${phase.name}: ${phase.start} to ${phase.end} (${phase.duration} weeks)`).join('\n') },
        { heading: 'Milestones', body: milestones.map((milestone) => `- ${milestone.name}: ${milestone.date}`).join('\n') },
      ])
    );
  };

  const recalculate = async () => {
    setCalculating(true);
    try {
      const prompt = `Create a project delivery timeline from this analysis. Return only JSON: {phases:[{name,duration,start,end,status,color}], milestones:[{name,date,status}]}.
Analysis: ${JSON.stringify(latestAnalysis)}`;
      const generated = extractJsonObject(await generateWithGemini(prompt), { phases, milestones });
      setPhases(generated.phases);
      setMilestones(generated.milestones);
      saveJson('latestTimelinePhases', generated.phases);
      saveJson('latestTimelineMilestones', generated.milestones);
      if (projectId) {
        const generatedWeeks = generated.phases.reduce((sum: number, phase: any) => sum + Number(phase.duration || 0), 0);
        const [timeline] = await insertRow('timeline_predictions', {
          project_id: projectId,
          created_by: session?.userId ?? null,
          duration_weeks: generatedWeeks,
          min_weeks: Math.max(1, Math.floor(generatedWeeks * 0.85)),
          max_weeks: Math.ceil(generatedWeeks * 1.15),
          risk_level: generatedWeeks > 20 ? 'high' : generatedWeeks > 10 ? 'medium' : 'low',
          confidence_score: 85,
          critical_path: generated.milestones ?? [],
        });
        if ((timeline as any)?.id) {
          await Promise.all(
            generated.phases.map((phase: any, index: number) =>
              insertRow('timeline_phases', {
                timeline_id: (timeline as any).id,
                phase_name: phase.name,
                start_week: index === 0 ? 1 : generated.phases.slice(0, index).reduce((sum: number, item: any) => sum + Number(item.duration || 0), 1),
                end_week: generated.phases.slice(0, index + 1).reduce((sum: number, item: any) => sum + Number(item.duration || 0), 0),
                milestone: generated.milestones?.[index]?.name ?? null,
                dependencies: [],
                status: phase.status ?? 'planned',
              })
            )
          );
        }
      }
      toast.success('Timeline recalculated with Gemini.');
    } catch (error) {
      toast.warning(`Timeline retained. ${getGeminiErrorMessage(error)}`);
      console.warn(error);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Timeline Prediction</h1>
          <p className="text-gray-600 mt-1">AI-powered project timeline estimation</p>
        </div>
        <div className="flex shrink-0 gap-2 sm:gap-3">
          <Link to="/proposals/new" aria-label="Back to Proposal">
            <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <Button variant="outline" onClick={exportTimeline} aria-label="Export Timeline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Timeline</span>
          </Button>
          <Button variant="ai" onClick={recalculate} disabled={calculating} aria-label={calculating ? 'Recalculating' : 'Recalculate'} className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">{calculating ? 'Recalculating...' : 'Recalculate'}</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Total Duration</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalWeeks} weeks</p>
            <p className="text-xs text-gray-500 mt-2">Generated from current analysis</p>
            <Badge variant="success" className="mt-3 gap-1">
              <Sparkles className="w-3 h-3" />
              85% Confidence
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Project Phases</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{phases.length}</p>
            <p className="text-sm text-gray-600 mt-2">Generated phases</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Start Date</p>
            <p className="text-xl font-bold text-gray-900 mt-2">{milestones[0]?.date ?? 'Not set'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Est. Completion</p>
            <p className="text-xl font-bold text-gray-900 mt-2">{milestones[milestones.length - 1]?.date ?? 'Not set'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {phases.map((phase, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{phase.name}</span>
                    <Badge
                      variant={
                        phase.status === 'completed' ? 'success' :
                        phase.status === 'in-progress' ? 'info' : 'default'
                      }
                    >
                      {phase.status === 'completed' ? 'Completed' :
                       phase.status === 'in-progress' ? 'In Progress' : 'Upcoming'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {phase.start} - {phase.end} ({phase.duration} weeks)
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`${phase.color} h-3 rounded-full transition-all`}
                    style={{ width: `${totalWeeks ? (phase.duration / totalWeeks) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Key Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    milestone.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <span className="font-medium text-gray-900">{milestone.name}</span>
                </div>
                <span className="text-sm text-gray-600">{milestone.date}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
