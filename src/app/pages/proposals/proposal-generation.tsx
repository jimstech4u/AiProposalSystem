import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Sparkles, Save, Download, FileText, ClipboardCheck, Send, Info, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractJsonObject, generateWithGemini, getGeminiErrorMessage } from '../../../lib/gemini';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson, removeJson, saveJson } from '../../../lib/storage';
import { insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';

const sections = [
  { id: 'cover', name: 'Cover Page' },
  { id: 'executive', name: 'Executive Summary' },
  { id: 'background', name: 'Project Background' },
  { id: 'scope', name: 'Scope & Objectives' },
  { id: 'technical', name: 'Technical Approach' },
  { id: 'architecture', name: 'System Architecture' },
  { id: 'modules', name: 'Module Breakdown' },
  { id: 'tech-stack', name: 'Technology Stack' },
  { id: 'timeline', name: 'Timeline & Milestones' },
  { id: 'cost', name: 'Cost Breakdown' },
  { id: 'terms', name: 'Terms & Conditions' },
];

type ProposalContent = Record<string, string>;

type ProposalRow = {
  id: string;
  project_id: string;
  title: string;
  template_name?: string | null;
  tone?: string | null;
  detail_level?: string | null;
  executive_summary?: string | null;
  technical_approach?: string | null;
  architecture_description?: string | null;
  generated_content?: ProposalContent | null;
};

type ClientRow = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  industry?: string | null;
};

type ProjectRow = {
  id: string;
  title: string;
  description?: string | null;
  project_type?: string | null;
  requirements_text?: string | null;
  client_id?: string | null;
  clients?: { company_name?: string | null } | null;
};

function defaultContent(projectName: string, clientName: string): ProposalContent {
  return {
    executive: `${clientName} requires a dependable software solution for ${projectName}. This proposal presents a practical delivery approach, the recommended technology direction, core project modules, estimated delivery structure, assumptions, and acceptance criteria.`,
    technical: 'The solution will use a modular architecture with a responsive web interface, secure API layer, relational database, role-based access control, structured logging, and automated testing across critical workflows.',
  };
}

function buildLocalProposalContent(project: { name: string; client: string; description?: string }, latestAnalysis: any): ProposalContent {
  const projectName = project.name || 'the proposed project';
  const clientName = project.client || 'the client';
  const requirements = (latestAnalysis?.requirements ?? [])
    .map((item: any) => String(item.description ?? '').trim())
    .filter(Boolean);
  const requirementList = requirements.length
    ? requirements.map((item: string) => `- ${item}`).join('\n')
    : '- Requirements will be finalized during stakeholder validation.';

  return {
    cover: `${projectName}\n\nPrepared for ${clientName}\n\nTechnical Proposal`,
    executive: `${clientName} requires a dependable software solution for ${projectName}. This proposal defines the business context, functional scope, implementation approach, delivery structure, assumptions, and review process needed to move from requirements into execution.`,
    background: project.description || `The project is based on the requirement analysis captured for ${clientName}. The proposed solution should address the documented needs while leaving room for validation of ambiguous or missing requirements before implementation begins.`,
    scope: `The solution scope is driven by these current requirements:\n\n${requirementList}\n\nOut-of-scope items should be confirmed during project kickoff and handled through change control.`,
    technical: 'The implementation should use a modular architecture with a responsive user interface, secure API layer, persistent database, role-based access controls, validation, logging, and test coverage for critical workflows.',
    architecture: 'The recommended architecture separates presentation, application services, data persistence, and integration concerns. This keeps the system maintainable, easier to test, and easier to extend as requirements mature.',
    modules: `Primary modules will map directly to the validated requirements:\n\n${requirementList}`,
    'tech-stack': 'The technology stack should be selected based on delivery speed, maintainability, security, integration needs, and the team skills available for long-term support.',
    timeline: 'Delivery should proceed through discovery validation, design, implementation, testing, review, deployment, and handover. Final duration depends on confirmed scope and integration complexity.',
    cost: 'Cost should be estimated from module complexity, engineering effort, infrastructure needs, third-party services, testing effort, and contingency for unclear requirements.',
    terms: 'This proposal assumes timely stakeholder feedback, access to required systems, clear approval checkpoints, and a formal change process for new scope discovered after approval.',
  };
}

export default function ProposalGeneration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditingExistingProposal = Boolean(id && id !== 'new');
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const analysisProject = latestAnalysis?.project ?? { name: 'Untitled Project', client: 'Client not selected' };
  const [projectId, setProjectId] = useState(readJson<string | null>('latestProjectId', null));
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const storedProposal = readJson<ProposalContent | null>('latestProposal', null);
  const [proposalId, setProposalId] = useState(isEditingExistingProposal ? id ?? '' : '');
  const [proposalTitle, setProposalTitle] = useState(`${analysisProject.name} Proposal`);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState('executive');
  const [tone, setTone] = useState('Professional & Formal');
  const [detailLevel, setDetailLevel] = useState('Comprehensive');
  const [content, setContent] = useState<ProposalContent>(() =>
    isEditingExistingProposal ? storedProposal ?? defaultContent(analysisProject.name, analysisProject.client) : defaultContent(analysisProject.name, analysisProject.client)
  );
  const session = getStoredSession();

  const activeSectionName = useMemo(() => sections.find((section) => section.id === activeSection)?.name ?? 'Section', [activeSection]);
  const selectedProject = useMemo(() => projects.find((item) => item.id === projectId), [projectId, projects]);
  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId), [clients, selectedClientId]);
  const hasUsableAnalysis = Boolean(latestAnalysis?.summary?.totalRequirements && analysisProject.name !== 'Untitled Project');
  const hasProposalSource = Boolean(projectId || hasUsableAnalysis);
  const project = useMemo(
    () => ({
      name: selectedProject?.title ?? analysisProject.name,
      client: selectedClient?.company_name ?? selectedProject?.clients?.company_name ?? analysisProject.client,
      description: selectedProject?.description ?? latestAnalysis?.project?.description,
      requirements: selectedProject?.requirements_text ?? latestAnalysis,
    }),
    [analysisProject.client, analysisProject.name, latestAnalysis, selectedClient?.company_name, selectedProject]
  );

  useEffect(() => {
    if (!isEditingExistingProposal) {
      removeJson('latestProposal');
      setProposalId('');
      setProposalTitle(`${analysisProject.name} Proposal`);
      setContent(defaultContent(analysisProject.name, analysisProject.client));
    }
  }, [analysisProject.client, analysisProject.name, isEditingExistingProposal]);

  useEffect(() => {
    async function loadProposalSources() {
      try {
        const [clientRows, projectRows] = await Promise.all([
          selectRows<ClientRow>('clients', 'select=id,company_name,contact_name,industry&order=company_name.asc'),
          selectRows<ProjectRow>('projects', 'select=id,title,description,project_type,requirements_text,client_id,clients(company_name)&order=created_at.desc'),
        ]);
        setClients(clientRows);
        setProjects(projectRows);
        const matchingProject = projectId ? projectRows.find((row) => row.id === projectId) : undefined;
        if (matchingProject?.client_id) setSelectedClientId(matchingProject.client_id);
      } catch (error) {
        console.warn('Unable to load proposal source data:', error);
      }
    }

    loadProposalSources();
  }, [projectId]);

  useEffect(() => {
    async function loadProposal() {
      if (!id || id === 'new') return;
      try {
        const [row] = await selectRows<ProposalRow>('proposals', `select=*&id=eq.${id}`);
        if (!row) return;
        setProposalId(row.id);
        setProjectId(row.project_id);
        setProposalTitle(row.title);
        setTone(row.tone ?? 'Professional & Formal');
        setDetailLevel(row.detail_level ?? 'Comprehensive');
        setContent({
          ...(row.generated_content ?? {}),
          executive: row.generated_content?.executive ?? row.executive_summary ?? '',
          technical: row.generated_content?.technical ?? row.technical_approach ?? '',
          architecture: row.generated_content?.architecture ?? row.architecture_description ?? '',
        });
      } catch (error) {
        toast.error('Unable to load proposal.');
        console.warn(error);
      }
    }

    loadProposal();
  }, [id]);

  const ensureProject = async () => {
    if (projectId) return projectId;

    const projectName = String(analysisProject.name ?? '').trim();
    const clientName = String(analysisProject.client ?? '').trim();
    if (!projectName || projectName === 'Untitled Project' || !clientName || clientName === 'Client not selected') {
      throw new Error('Create or select a requirement analysis before saving this proposal.');
    }

    const [existingClient] = await selectRows<any>(
      'clients',
      `select=id&company_name=eq.${encodeURIComponent(clientName)}&limit=1`
    );
    const [savedClient] = existingClient
      ? [existingClient]
      : await insertRow('clients', {
          company_name: clientName,
          industry: latestAnalysis?.project?.industry ?? null,
          created_by: session?.userId ?? null,
        });
    const requirementText = (latestAnalysis?.requirements ?? [])
      .map((item: any) => item.description)
      .filter(Boolean)
      .join('\n');
    const [savedProject] = await insertRow<ProjectRow>('projects', {
      client_id: savedClient?.id ?? null,
      title: projectName,
      description: latestAnalysis?.project?.description ?? null,
      industry: latestAnalysis?.project?.industry ?? null,
      project_type: latestAnalysis?.project?.projectType ?? 'web',
      status: 'proposal',
      requirements_text: requirementText,
      target_users: String(latestAnalysis?.project?.expectedUsers ?? ''),
      complexity_score: Number(latestAnalysis?.summary?.complexityScore ?? 0) * 10,
      confidence_score: Number(latestAnalysis?.summary?.confidenceScore ?? 0),
      submitted_by: session?.userId ?? null,
    } as any);

    const nextProjectId = savedProject?.id;
    if (!nextProjectId) throw new Error('Unable to create proposal project record.');

    const requirementRows = (latestAnalysis?.requirements ?? [])
      .filter((requirement: any) => String(requirement.description ?? '').trim())
      .map((requirement: any) => ({
        project_id: nextProjectId,
        category: requirement.category ?? 'general',
        title: String(requirement.description).trim().slice(0, 80),
        description: String(requirement.description).trim(),
        priority: requirement.priority ?? 'medium',
        requirement_type: 'functional',
        complexity: 50,
      }));
    if (requirementRows.length > 0) {
      await Promise.all(requirementRows.map((row: any) => insertRow('requirements', row)));
    }

    setProjectId(nextProjectId);
    saveJson('latestProjectId', nextProjectId);
    return nextProjectId;
  };

  const saveProposal = async (nextContent = content) => {
    saveJson('latestProposal', nextContent);
    try {
      const persistedProjectId = await ensureProject();

      const payload = {
        project_id: persistedProjectId,
        title: proposalTitle.trim() || `${project.name} Proposal`,
        template_name: 'Standard Technical Proposal',
        tone,
        detail_level: detailLevel,
        executive_summary: nextContent.executive,
        technical_approach: nextContent.technical,
        architecture_description: nextContent.architecture,
        generated_content: nextContent,
      };

      if (proposalId) {
        const [updated] = await updateRows<ProposalRow>('proposals', `id=eq.${proposalId}`, payload);
        if (updated?.id) setProposalId(updated.id);
        await updateRows('projects', `id=eq.${persistedProjectId}`, { status: 'proposal' }).catch(() => undefined);
        return updated?.id ?? proposalId;
      } else {
        const [saved] = await insertRow<ProposalRow>('proposals', payload as ProposalRow);
        if (saved?.id) setProposalId(saved.id);
        await updateRows('projects', `id=eq.${persistedProjectId}`, { status: 'proposal' }).catch(() => undefined);
        return saved?.id ?? true;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Proposal save failed.');
      console.warn('Proposal persistence failed:', error);
      return false;
    }
  };

  const submitForReview = async () => {
    const saved = await saveProposal();
    if (!saved) return;

    const savedProposalId = typeof saved === 'string' ? saved : proposalId;
    if (!savedProposalId) {
      toast.error('Save the proposal before submitting for review.');
      return;
    }

    try {
      await updateRows('proposals', `id=eq.${savedProposalId}`, { status: 'in_review' });
      toast.success('Proposal submitted for review.');
    } catch (error) {
      toast.error('Unable to submit proposal for review.');
      console.warn(error);
    }
  };

  const handleGenerateSection = async (sectionId = activeSection) => {
    setGenerating(true);
    try {
      const prompt = `Write the "${sections.find((section) => section.id === sectionId)?.name}" section of a technical proposal.
Tone: ${tone}
Detail level: ${detailLevel}
Project context: ${JSON.stringify(project)}
Requirement analysis: ${JSON.stringify(latestAnalysis)}
Return polished proposal text only.`;
      const text = await generateWithGemini(prompt);
      const nextContent = { ...content, [sectionId]: text };
      setContent(nextContent);
      const saved = await saveProposal(nextContent);
      toast.success(saved ? 'Section generated and saved with Gemini.' : 'Section generated locally. Save after selecting an analysis.');
    } catch (error) {
      const fallback = `${activeSectionName}\n\nThis section should be completed using the project requirements, client objectives, technical constraints, delivery assumptions, and acceptance criteria captured during requirement analysis.`;
      const nextContent = { ...content, [sectionId]: fallback };
      setContent(nextContent);
      saveJson('latestProposal', nextContent);
      toast.warning(`Local fallback inserted. ${getGeminiErrorMessage(error)}`);
      console.warn(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const prompt = `Generate a complete technical proposal as valid JSON. Use keys: ${sections.map((section) => section.id).join(', ')}.
Tone: ${tone}
Detail level: ${detailLevel}
Project context: ${JSON.stringify(project)}
Requirement analysis: ${JSON.stringify(latestAnalysis)}`;
      const text = await generateWithGemini(prompt);
      const generated = extractJsonObject<ProposalContent>(text, content);
      const nextContent = { ...content, ...generated };
      setContent(nextContent);
      const saved = await saveProposal(nextContent);
      toast.success(saved ? 'Full proposal generated and saved with Gemini.' : 'Full proposal generated locally. Save after selecting an analysis.');
    } catch (error) {
      const nextContent = { ...content, ...buildLocalProposalContent(project, latestAnalysis) };
      setContent(nextContent);
      saveJson('latestProposal', nextContent);
      toast.warning(`Generated a local proposal fallback. ${getGeminiErrorMessage(error)}`);
      console.warn(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = () => {
    const report = toReport(
      `${project.name} Technical Proposal`,
      sections.map((section) => ({ heading: section.name, body: content[section.id] ?? 'Pending generation.' }))
    );
    downloadTextFile(`${project.name || 'proposal'}.doc`, report, 'application/msword');
    toast.success('Proposal exported.');
  };

  const clearLocalProposalFlow = () => {
    const confirmed = window.confirm(
      'Clear the current local proposal draft and selected analysis? Saved database proposals will not be deleted.'
    );
    if (!confirmed) return;

    [
      'latestProposal',
      'latestAnalysis',
      'latestProjectId',
      'latestCostModules',
      'latestCostBreakdown',
      'latestTimelinePhases',
      'latestTimelineMilestones',
      'latestTechStack',
      'latestTechAlternatives',
    ].forEach(removeJson);

    setProjectId(null);
    setSelectedClientId('');
    setProposalId('');
    setProposalTitle('New Proposal');
    setContent(defaultContent('New Proposal', 'Client not selected'));
    toast.success('Local proposal draft cleared.');
    navigate('/proposals/new', { replace: true });
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)]">
      <div className="min-w-0">
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
              <input
                value={proposalTitle}
                onChange={(event) => setProposalTitle(event.target.value)}
                aria-label="Proposal title"
                className="w-full rounded-md border border-transparent bg-transparent px-0 py-1 text-2xl font-bold text-gray-900 focus:border-gray-300 focus:px-3 focus:outline-none sm:text-3xl"
              />
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                  Build a proposal from a requirement analysis, generate section content, save drafts, then submit for manager review.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:shrink-0">
              <Button variant="outline" size="sm" onClick={clearLocalProposalFlow} aria-label="Clear Draft" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={isEditingExistingProposal}>
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Draft</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} aria-label="Export" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={!hasProposalSource}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => saveProposal().then((saved) => saved && toast.success('Proposal saved.'))} aria-label="Save" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={!hasProposalSource}>
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save</span>
              </Button>
              <Button variant="ai" size="sm" onClick={submitForReview} aria-label="Submit for Review" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={!hasProposalSource}>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Submit for Review</span>
              </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:flex-wrap">
              <span className="rounded-md bg-gray-50 px-3 py-2">Client: {project.client}</span>
              <span className="rounded-md bg-gray-50 px-3 py-2">Analysis: {projectId ? 'Selected project record' : hasUsableAnalysis ? 'Latest local analysis' : 'Not selected'}</span>
              <span className="rounded-md bg-gray-50 px-3 py-2">Status: {proposalId ? 'Saved draft' : 'Unsaved draft'}</span>
            </div>
          </div>

          {!hasProposalSource && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Start with a requirement analysis.</p>
                  <p className="mt-1 leading-6">A proposal needs project, client, and requirement details. Select an existing analysis below or create a new one before saving or submitting for review.</p>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                Proposal Intake
              </CardTitle>
              <p className="text-sm leading-6 text-gray-600">
                Choose the requirements analysis that should drive this proposal. The selected analysis supplies the client, scope, requirements, and AI context.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">Requirements Analysis</label>
                {projects.length > 0 ? (
                  <select
                    value={projectId ?? ''}
                    onChange={(event) => setProjectId(event.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {hasUsableAnalysis && (
                      <option value="">
                        Current analysis: {analysisProject.name} for {analysisProject.client}
                      </option>
                    )}
                    {!hasUsableAnalysis && <option value="">Select a saved analysis</option>}
                    {projects.map((item) => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </select>
                ) : hasUsableAnalysis ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                    <p className="font-medium text-gray-900">{analysisProject.name}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Client: {analysisProject.client} - {latestAnalysis?.summary?.totalRequirements ?? 0} requirements
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    No requirement analysis is selected yet.
                  </div>
                )}
                <p className="mt-1.5 text-xs leading-5 text-gray-500">
                  This source controls the proposal client, scope, requirements, and AI context.
                </p>
              </div>
              <div className="flex items-end md:w-44">
                <Link to="/requirements/new" state={{ returnTo: '/proposals/new' }} className="w-full">
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">New Analysis</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {hasProposalSource && (
            <>
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Proposal Sections</CardTitle>
                  <p className="text-sm leading-6 text-gray-600">Pick a section to edit. Generate one section at a time when you want more control.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                          activeSection === section.id ? 'border-blue-200 bg-blue-50 font-medium text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {section.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-xl">{activeSectionName}</CardTitle>
                    <Badge variant="purple" className="gap-1 px-3 py-1">
                      <Sparkles className="w-3 h-3" />
                      Editable Draft
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="h-72 w-full rounded-lg border border-gray-300 p-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 sm:h-96 sm:p-5"
                    value={content[activeSection] ?? ''}
                    placeholder="Generate this section with Gemini or write the content manually."
                    onChange={(event) => setContent((current) => ({ ...current, [activeSection]: event.target.value }))}
                  />
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    AI Content Generation
                  </CardTitle>
                  <p className="text-sm leading-6 text-gray-600">
                    Generate all proposal sections from the selected requirements analysis, then edit each section before saving or submitting for review.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                      <select value={tone} onChange={(event) => setTone(event.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option>Professional & Formal</option>
                        <option>Conversational & Friendly</option>
                        <option>Technical & Detailed</option>
                        <option>Executive & High-level</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Detail Level</label>
                      <select value={detailLevel} onChange={(event) => setDetailLevel(event.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option>Comprehensive</option>
                        <option>Detailed</option>
                        <option>Moderate</option>
                        <option>Concise</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <Button variant="ai" onClick={() => handleGenerateSection()} disabled={generating} className="flex-1">
                      {generating ? 'Generating...' : 'Generate Section'}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleGenerateAll} disabled={generating}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Source Data</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="font-medium text-gray-900">Requirements Analysis</p>
                    <p className="mt-1.5 text-xs text-gray-600">{latestAnalysis?.summary?.totalRequirements ?? 0} requirements identified</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="font-medium text-gray-900">Client</p>
                    <p className="mt-1.5 text-xs text-gray-600">{project.client}</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
