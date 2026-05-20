import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Check, Code, Database, Server, Cloud, Download, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { extractJsonObject, generateWithGemini, getGeminiErrorMessage } from '../../../lib/gemini';
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
  constraints?: string | null;
};

type TechRecommendationRow = {
  id: string;
  project_id: string;
  stack_name: string;
  frontend?: string | null;
  backend?: string | null;
  database_name?: string | null;
  hosting?: string | null;
  match_score?: number | null;
  rationale?: string | null;
  pros?: string[] | null;
  cons?: string[] | null;
  alternatives?: any[] | null;
};

type StackChoice = {
  frontend?: { name?: string; version?: string; confidence?: number };
  backend?: { name?: string; version?: string; confidence?: number };
  database?: { name?: string; version?: string; confidence?: number };
  cloud?: { name?: string; version?: string; confidence?: number };
  rationale?: string;
};

function rowToStack(row: TechRecommendationRow | null): StackChoice | null {
  if (!row) return null;
  return {
    frontend: { name: row.frontend ?? 'Not set', confidence: row.match_score ?? 0 },
    backend: { name: row.backend ?? 'Not set', confidence: row.match_score ?? 0 },
    database: { name: row.database_name ?? 'Not set', confidence: row.match_score ?? 0 },
    cloud: { name: row.hosting ?? 'Not set', confidence: row.match_score ?? 0 },
    rationale: row.rationale ?? '',
  };
}

export default function TechnologyRecommendation() {
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/proposals/new';
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const latestProjectId = readJson<string | null>('latestProjectId', null);
  const session = getStoredSession();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState(latestProjectId ?? '');
  const [teamExpertise, setTeamExpertise] = useState('React, Node.js, PostgreSQL, Supabase');
  const [budgetConstraint, setBudgetConstraint] = useState('Moderate');
  const [timelineConstraint, setTimelineConstraint] = useState('Balanced delivery speed and maintainability');
  const [generating, setGenerating] = useState(false);
  const [recommendedStack, setRecommendedStack] = useState<StackChoice | null>(readJson<StackChoice | null>('latestTechStack', null));

  const [alternatives, setAlternatives] = useState(readJson<any[]>('latestTechAlternatives', []));
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) ?? null, [projectId, projects]);

  async function loadRecommendation(nextProjectId = projectId) {
    if (!nextProjectId) return;
    const [row] = await selectRows<TechRecommendationRow>('tech_recommendations', `select=*&project_id=eq.${nextProjectId}&order=created_at.desc&limit=1`);
    if (row) {
      setRecommendedStack(rowToStack(row));
      setAlternatives(row.alternatives ?? []);
    }
  }

  useEffect(() => {
    async function loadProjects() {
      try {
        const rows = await selectRows<ProjectRow>('projects', 'select=id,title,description,project_type,requirements_text,constraints&order=created_at.desc');
        setProjects(rows);
        const activeProjectId = projectId || rows[0]?.id || '';
        setProjectId(activeProjectId);
        if (activeProjectId) await loadRecommendation(activeProjectId);
      } catch (error) {
        toast.error('Unable to load technology recommendation data.');
        console.warn(error);
      }
    }

    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectProject = async (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setRecommendedStack(null);
    setAlternatives([]);
    if (nextProjectId) await loadRecommendation(nextProjectId);
  };

  const exportRecommendation = () => {
    downloadTextFile(
      'technology-recommendation-report.txt',
      toReport('Technology Stack Recommendation', [
        { heading: 'Project', body: selectedProject?.title || 'No project selected' },
        {
          heading: 'Recommended Stack',
          body: recommendedStack
            ? [
                `Frontend: ${recommendedStack.frontend?.name || 'Not set'}`,
                `Backend: ${recommendedStack.backend?.name || 'Not set'}`,
                `Database: ${recommendedStack.database?.name || 'Not set'}`,
                `Cloud: ${recommendedStack.cloud?.name || 'Not set'}`,
              ].join('\n')
            : 'No recommendation generated.',
        },
        { heading: 'Rationale', body: recommendedStack?.rationale || 'No rationale generated.' },
        { heading: 'Alternatives', body: alternatives.map((item) => `${item.name} (${item.match}%): ${(item.pros ?? []).join(', ')}`).join('\n') || 'No alternatives generated.' },
      ])
    );
  };

  const regenerate = async () => {
    setGenerating(true);
    try {
      const prompt = `Recommend a technology stack for this software project. Return only JSON: {recommendedStack:{frontend:{name,version,confidence},backend:{name,version,confidence},database:{name,version,confidence},cloud:{name,version,confidence},rationale:string}, alternatives:[{name,match,pros,cons,implementationNotes}]}.
Project: ${JSON.stringify(selectedProject)}
Analysis: ${JSON.stringify(latestAnalysis)}
Team expertise: ${teamExpertise}
Budget constraint: ${budgetConstraint}
Timeline constraint: ${timelineConstraint}`;
      const generated = extractJsonObject(await generateWithGemini(prompt), { recommendedStack: null, alternatives: [] });
      setRecommendedStack(generated.recommendedStack);
      setAlternatives(generated.alternatives);
      saveJson('latestTechStack', generated.recommendedStack);
      saveJson('latestTechAlternatives', generated.alternatives);
      if (projectId && generated.recommendedStack) {
        const scores = [
          generated.recommendedStack.frontend?.confidence,
          generated.recommendedStack.backend?.confidence,
          generated.recommendedStack.database?.confidence,
          generated.recommendedStack.cloud?.confidence,
        ].filter((value: unknown): value is number => typeof value === 'number');
        await insertRow('tech_recommendations', {
          project_id: projectId,
          created_by: session?.userId ?? null,
          stack_name: [
            generated.recommendedStack.frontend?.name,
            generated.recommendedStack.backend?.name,
            generated.recommendedStack.database?.name,
          ].filter(Boolean).join(' / ') || 'Recommended Stack',
          frontend: generated.recommendedStack.frontend?.name ?? null,
          backend: generated.recommendedStack.backend?.name ?? null,
          database_name: generated.recommendedStack.database?.name ?? null,
          hosting: generated.recommendedStack.cloud?.name ?? null,
          match_score: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
          rationale: generated.recommendedStack.rationale ?? null,
          pros: generated.alternatives?.flatMap((alternative: any) => alternative.pros ?? []) ?? [],
          cons: generated.alternatives?.flatMap((alternative: any) => alternative.cons ?? []) ?? [],
          alternatives: generated.alternatives ?? [],
        });
      }
      toast.success('Technology recommendation generated and saved online.');
    } catch (error) {
      toast.warning(`Technology stack retained. ${getGeminiErrorMessage(error)}`);
      console.warn(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Technology Stack Recommendation</h1>
          <p className="text-gray-600 mt-1">AI-powered technology selection</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to={returnTo} aria-label="Back to Proposal">
            <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <Button variant="outline" onClick={exportRecommendation} disabled={!recommendedStack} aria-label="Export Recommendation" className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="ai" onClick={regenerate} disabled={generating} aria-label={generating ? 'Generating' : 'Regenerate'} className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">{generating ? 'Generating...' : 'Regenerate'}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 lg:grid-cols-[1.2fr_2fr]">
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Project Source
            <select value={projectId} onChange={(event) => selectProject(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
              <option value="">Select saved project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Team Expertise
              <input value={teamExpertise} onChange={(event) => setTeamExpertise(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Budget Constraint
              <select value={budgetConstraint} onChange={(event) => setBudgetConstraint(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
                <option>Lean</option>
                <option>Moderate</option>
                <option>Enterprise</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Timeline Constraint
              <input value={timelineConstraint} onChange={(event) => setTimelineConstraint(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Stack */}
      <Card className="border-2 border-purple-100 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Recommended Technology Stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recommendedStack ? (
            <p className="text-sm text-gray-600">No technology recommendation has been generated yet. Use the regenerate action after completing requirement analysis.</p>
          ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Code className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Frontend</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.frontend?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.frontend?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.frontend?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Server className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Backend</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.backend?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.backend?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.backend?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Database</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.database?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.database?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.database?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <Cloud className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Cloud</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.cloud?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.cloud?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.cloud?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Why We Recommend This Stack</h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              {recommendedStack.rationale ?? 'No rationale generated.'}
            </p>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      {/* Alternative Stacks */}
      <Card>
        <CardHeader>
          <CardTitle>Alternative Technology Stacks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alternatives.map((stack, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{stack.name}</h4>
                    <Badge variant="info" className="mt-1">{stack.match}% Match</Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-700 mb-1">Pros:</p>
                    <ul className="space-y-0.5">
                      {stack.pros.map((pro, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-700"><Check className="h-4 w-4 text-green-700" /> {pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-red-700 mb-1">Cons:</p>
                    <ul className="space-y-0.5">
                      {stack.cons.map((con, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-700"><X className="h-4 w-4 text-red-700" /> {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
