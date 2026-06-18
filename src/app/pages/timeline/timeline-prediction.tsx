import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Calendar, Check, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { extractJsonObject, generateWithNvidia, getNvidiaErrorMessage } from '../../../lib/nvidia';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson, saveJson } from '../../../lib/storage';
import { insertRow, selectRows } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';

type ProjectRow = {
  id: string;
  title: string;
  description?: string | null;
  project_type?: string | null;
  requirements_text?: string | null;
  complexity_score?: number | null;
  confidence_score?: number | null;
};

type TimelineRow = {
  id: string;
  project_id: string;
  duration_weeks: number;
  min_weeks?: number | null;
  max_weeks?: number | null;
  risk_level: string;
  confidence_score?: number | null;
  critical_path?: any[] | null;
  created_at: string;
};

type TimelinePhaseRow = {
  phase_name: string;
  start_week: number;
  end_week: number;
  milestone?: string | null;
  dependencies?: string[] | null;
  status: string;
};

type RepositoryRow = {
  project_type?: string | null;
  estimated_weeks?: number | null;
  actual_weeks?: number | null;
};

type Phase = {
  name: string;
  duration: number;
  start: string;
  end: string;
  status: string;
  color: string;
  dependencies?: string[];
};

type Milestone = {
  name: string;
  date: string;
  status: string;
};

const colors = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-amber-600', 'bg-sky-600'];

function cleanNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function phaseRowsToPhases(rows: TimelinePhaseRow[]): Phase[] {
  return rows.map((row, index) => ({
    name: row.phase_name,
    duration: Math.max(1, cleanNumber(row.end_week) - cleanNumber(row.start_week) + 1),
    start: `Week ${row.start_week}`,
    end: `Week ${row.end_week}`,
    status: row.status ?? 'planned',
    color: colors[index % colors.length],
    dependencies: row.dependencies ?? [],
  }));
}

function localTimelineFromProject(project: ProjectRow | null, latestAnalysis: any): { phases: Phase[]; milestones: Milestone[] } {
  const requirements = project?.requirements_text
    ? project.requirements_text.split(/\r?\n/).filter(Boolean)
    : (latestAnalysis?.requirements ?? []).map((item: any) => item.description).filter(Boolean);
  const complexityScore = cleanNumber(project?.complexity_score ?? latestAnalysis?.summary?.complexityScore * 10, 55);
  const baseWeeks = Math.max(8, Math.ceil(requirements.length * 1.5 + complexityScore / 10));
  const phasePlan = [
    ['Discovery & Scope Validation', 0.15],
    ['UX, Architecture & Planning', 0.2],
    ['Core Implementation', 0.35],
    ['Integration & QA', 0.2],
    ['Deployment & Handover', 0.1],
  ];
  let cursor = 1;
  const phases = phasePlan.map(([name, ratio], index) => {
    const duration = Math.max(1, Math.round(baseWeeks * Number(ratio)));
    const startWeek = cursor;
    const endWeek = cursor + duration - 1;
    cursor = endWeek + 1;
    return {
      name: String(name),
      duration,
      start: `Week ${startWeek}`,
      end: `Week ${endWeek}`,
      status: 'planned',
      color: colors[index % colors.length],
      dependencies: index === 0 ? [] : [String(phasePlan[index - 1][0])],
    };
  });
  const milestones = phases.map((phase) => ({ name: `${phase.name} complete`, date: phase.end, status: 'planned' }));
  return { phases, milestones };
}

export default function TimelinePrediction() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { returnTo?: string; projectId?: string | null } | null;
  const returnTo = routeState?.returnTo ?? '/proposals/new';
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const latestProjectId = readJson<string | null>('latestProjectId', null);
  const session = getStoredSession();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [repository, setRepository] = useState<RepositoryRow[]>([]);
  const [projectId, setProjectId] = useState(routeState?.projectId ?? latestProjectId ?? '');
  const [timeline, setTimeline] = useState<TimelineRow | null>(null);
  const [phases, setPhases] = useState<Phase[]>(readJson<Phase[]>('latestTimelinePhases', []));
  const [milestones, setMilestones] = useState<Milestone[]>(readJson<Milestone[]>('latestTimelineMilestones', []));
  const [teamSize, setTeamSize] = useState(4);
  const [riskAdjustment, setRiskAdjustment] = useState(10);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) ?? null, [projectId, projects]);
  const totalWeeks = phases.reduce((sum, phase) => sum + cleanNumber(phase.duration), 0);
  const adjustedWeeks = Math.max(1, Math.ceil(totalWeeks * (1 + riskAdjustment / 100)));
  const historicalMatches = repository.filter((item) => item.project_type && item.project_type === selectedProject?.project_type);
  const historicalAverage = historicalMatches.length
    ? historicalMatches.reduce((sum, item) => sum + cleanNumber(item.actual_weeks ?? item.estimated_weeks), 0) / historicalMatches.length
    : 0;

  async function loadProjectTimeline(nextProjectId = projectId) {
    if (!nextProjectId) return;
    const [latestTimeline] = await selectRows<TimelineRow>('timeline_predictions', `select=*&project_id=eq.${nextProjectId}&order=created_at.desc&limit=1`);
    setTimeline(latestTimeline ?? null);
    if (!latestTimeline) return;
    const phaseRows = await selectRows<TimelinePhaseRow>('timeline_phases', `select=phase_name,start_week,end_week,milestone,dependencies,status&timeline_id=eq.${latestTimeline.id}&order=start_week.asc`);
    const nextPhases = phaseRowsToPhases(phaseRows);
    const nextMilestones = phaseRows
      .filter((phase) => phase.milestone)
      .map((phase) => ({ name: String(phase.milestone), date: `Week ${phase.end_week}`, status: phase.status ?? 'planned' }));
    setPhases(nextPhases);
    setMilestones(nextMilestones);
    saveJson('latestTimelinePhases', nextPhases);
    saveJson('latestTimelineMilestones', nextMilestones);
  }

  useEffect(() => {
    async function load() {
      try {
        const [projectRows, repositoryRows] = await Promise.all([
          selectRows<ProjectRow>('projects', 'select=id,title,description,project_type,requirements_text,complexity_score,confidence_score&order=created_at.desc'),
          selectRows<RepositoryRow>('project_repository', 'select=project_type,estimated_weeks,actual_weeks'),
        ]);
        setProjects(projectRows);
        setRepository(repositoryRows);
        const activeProjectId = projectId || projectRows[0]?.id || '';
        setProjectId(activeProjectId);
        if (activeProjectId) await loadProjectTimeline(activeProjectId);
      } catch (error) {
        toast.error('Unable to load timeline data.');
        console.warn(error);
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectProject = async (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setTimeline(null);
    setPhases([]);
    setMilestones([]);
    if (nextProjectId) await loadProjectTimeline(nextProjectId);
  };

  const exportTimeline = () => {
    downloadTextFile(
      'timeline-prediction-report.txt',
      toReport('AI Timeline Prediction Report', [
        { heading: 'Project', body: selectedProject?.title || 'No project selected' },
        { heading: 'Total Duration', body: `${adjustedWeeks} weeks including ${riskAdjustment}% risk adjustment` },
        { heading: 'Range', body: `${Math.max(1, Math.floor(adjustedWeeks * 0.85))} - ${Math.ceil(adjustedWeeks * 1.15)} weeks` },
        { heading: 'Phases', body: phases.map((phase) => `- ${phase.name}: ${phase.start} to ${phase.end} (${phase.duration} weeks)`).join('\n') },
        { heading: 'Milestones', body: milestones.map((milestone) => `- ${milestone.name}: ${milestone.date}`).join('\n') },
      ])
    );
  };

  const saveTimeline = async (nextPhases: Phase[], nextMilestones: Milestone[]) => {
    if (!projectId) throw new Error('Select a saved project before saving a timeline.');
    const baseWeeks = nextPhases.reduce((sum, phase) => sum + cleanNumber(phase.duration), 0);
    const nextDuration = Math.max(1, Math.ceil(baseWeeks * (1 + riskAdjustment / 100)));
    const [savedTimeline] = await insertRow<TimelineRow>('timeline_predictions', {
      project_id: projectId,
      created_by: session?.userId ?? null,
      duration_weeks: nextDuration,
      min_weeks: Math.max(1, Math.floor(nextDuration * 0.85)),
      max_weeks: Math.ceil(nextDuration * 1.15),
      risk_level: riskAdjustment >= 20 ? 'high' : riskAdjustment >= 10 ? 'medium' : 'low',
      confidence_score: selectedProject?.confidence_score ?? 85,
      critical_path: nextMilestones,
    } as TimelineRow);

    if (savedTimeline?.id) {
      let cursor = 1;
      await Promise.all(
        nextPhases.map((phase, index) => {
          const duration = Math.max(1, cleanNumber(phase.duration, 1));
          const startWeek = cursor;
          const endWeek = cursor + duration - 1;
          cursor = endWeek + 1;
          return insertRow('timeline_phases', {
            timeline_id: savedTimeline.id,
            phase_name: phase.name,
            start_week: startWeek,
            end_week: endWeek,
            milestone: nextMilestones[index]?.name ?? `${phase.name} complete`,
            dependencies: phase.dependencies ?? [],
            status: phase.status ?? 'planned',
          });
        })
      );
      setTimeline(savedTimeline);
    }
  };

  const recalculate = async () => {
    setCalculating(true);
    try {
      const prompt = `Create a project delivery timeline from this software project.
Return only JSON: {phases:[{name,duration,start,end,status,color,dependencies}], milestones:[{name,date,status}]}.
Team size: ${teamSize}
Risk adjustment: ${riskAdjustment}%
Project: ${JSON.stringify(selectedProject)}
Analysis: ${JSON.stringify(latestAnalysis)}
Historical timeline average for similar projects: ${historicalAverage || 'unavailable'} weeks.`;
      const generated = extractJsonObject(await generateWithNvidia(prompt), {});
      const fallback = localTimelineFromProject(selectedProject, latestAnalysis);
      const nextPhases = (generated.phases?.length ? generated.phases : fallback.phases).map((phase: any, index: number) => ({
        name: String(phase.name ?? `Phase ${index + 1}`),
        duration: cleanNumber(phase.duration, 1),
        start: String(phase.start ?? `Week ${index + 1}`),
        end: String(phase.end ?? `Week ${index + 1}`),
        status: String(phase.status ?? 'planned'),
        color: String(phase.color ?? colors[index % colors.length]),
        dependencies: phase.dependencies ?? [],
      }));
      const nextMilestones = generated.milestones?.length ? generated.milestones : fallback.milestones;
      setPhases(nextPhases);
      setMilestones(nextMilestones);
      saveJson('latestTimelinePhases', nextPhases);
      saveJson('latestTimelineMilestones', nextMilestones);
      await saveTimeline(nextPhases, nextMilestones);
      toast.success('Timeline generated and saved online.');
    } catch (error) {
      const fallback = localTimelineFromProject(selectedProject, latestAnalysis);
      setPhases(fallback.phases);
      setMilestones(fallback.milestones);
      saveJson('latestTimelinePhases', fallback.phases);
      saveJson('latestTimelineMilestones', fallback.milestones);
      try {
        await saveTimeline(fallback.phases, fallback.milestones);
        toast.warning(`Saved a local timeline. ${getNvidiaErrorMessage(error)}`);
      } catch {
        toast.warning(`Local timeline prepared. ${getNvidiaErrorMessage(error)}`);
      }
      console.warn(error);
    } finally {
      setCalculating(false);
    }
  };

  const saveAndApply = async () => {
    if (!projectId || phases.length === 0) {
      toast.error('Select a project and prepare a timeline first.');
      return;
    }

    if (!timeline) {
      await saveTimeline(phases, milestones);
    }
    toast.success('Timeline applied to proposal context.');
    navigate(returnTo, { state: { useLatestAnalysis: true, projectId } });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Timeline Prediction</h1>
          <p className="text-gray-600 mt-1">Milestone-based project schedule connected to proposals and repository history</p>
        </div>
        <div className="flex shrink-0 gap-2 sm:gap-3">
          <Link to={returnTo} state={{ useLatestAnalysis: true, projectId }} aria-label="Back to Proposal">
            <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <Button variant="outline" onClick={exportTimeline} disabled={phases.length === 0} aria-label="Export Timeline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Timeline</span>
          </Button>
          <Button variant="primary" onClick={saveAndApply} disabled={!projectId || phases.length === 0} aria-label="Save and Apply" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">Save & Apply</span>
          </Button>
          <Button variant="ai" onClick={recalculate} disabled={calculating || !projectId} aria-label={calculating ? 'Recalculating' : 'Recalculate'} className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">{calculating ? 'Recalculating...' : 'Recalculate'}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 lg:grid-cols-[1.4fr_1fr_1fr]">
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Project Source
            <select value={projectId} onChange={(event) => selectProject(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
              <option value="">Select saved project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Team Size
            <input type="number" min="1" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
          </label>
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Risk Adjustment
            <input type="number" min="0" max="50" value={riskAdjustment} onChange={(event) => setRiskAdjustment(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Total Duration</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{adjustedWeeks} weeks</p>
            <p className="mt-2 text-xs text-gray-500">{timeline?.min_weeks ?? Math.max(1, Math.floor(adjustedWeeks * 0.85))} - {timeline?.max_weeks ?? Math.ceil(adjustedWeeks * 1.15)} week range</p>
            <Badge variant="success" className="mt-3 gap-1">
              <Sparkles className="w-3 h-3" />
              {timeline?.confidence_score ?? selectedProject?.confidence_score ?? 85}% Confidence
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Project Phases</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{phases.length}</p>
            <p className="mt-2 text-xs text-gray-500">{milestones.length} milestones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Risk Level</p>
            <p className="mt-2 text-2xl font-bold capitalize text-gray-900">{timeline?.risk_level ?? (riskAdjustment >= 20 ? 'high' : riskAdjustment >= 10 ? 'medium' : 'low')}</p>
            <p className="mt-2 text-xs text-gray-500">{riskAdjustment}% adjustment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Historical Average</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{historicalAverage ? `${historicalAverage.toFixed(1)} weeks` : 'N/A'}</p>
            <p className="mt-2 text-xs text-gray-500">{historicalMatches.length} similar records</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-600">Loading timeline...</p>
          ) : phases.length === 0 ? (
            <div className="py-10 text-center">
              <Calendar className="mx-auto h-10 w-10 text-gray-400" />
              <h2 className="mt-3 font-semibold text-gray-900">No timeline for this project yet</h2>
              <p className="mt-1 text-sm text-gray-600">Select a saved project and run the timeline prediction to create an online schedule.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {phases.map((phase, index) => (
                <div key={`${phase.name}-${index}`} className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium text-gray-900">{phase.name}</span>
                      <Badge variant={phase.status === 'completed' ? 'success' : phase.status === 'in-progress' ? 'info' : 'default'}>
                        {phase.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">{phase.start} - {phase.end} ({phase.duration} weeks)</div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-200">
                    <div className={`${phase.color || colors[index % colors.length]} h-3 rounded-full transition-all`} style={{ width: `${totalWeeks ? (phase.duration / totalWeeks) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Key Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-600">No milestones have been saved for this timeline yet.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((milestone, index) => (
                <div key={`${milestone.name}-${index}`} className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${milestone.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="font-medium text-gray-900">{milestone.name}</span>
                  </div>
                  <span className="text-sm text-gray-600">{milestone.date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
