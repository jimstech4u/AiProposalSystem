import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Sparkles, Save, Download, FileText, ClipboardCheck, Send, Info, Trash2, UserRound, ListChecks, Cpu, Calculator, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { generateWithNvidia, getNvidiaErrorMessage, getNvidiaRetryAfterMs, isNvidiaQuotaError, isNvidiaRetryableError } from '../../../lib/nvidia';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson, removeJson, saveJson } from '../../../lib/storage';
import { insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';
import { standardProposalTemplate } from '../../../lib/default-templates';

const sections = [
  { id: 'cover', name: 'Cover Page' },
  { id: 'executive', name: 'Executive Summary' },
  { id: 'background', name: 'Project Background' },
  { id: 'scope', name: 'Scope & Objectives' },
  { id: 'technical', name: 'Technical Approach' },
  { id: 'architecture', name: 'System Architecture' },
  { id: 'modules', name: 'Module Breakdown' },
  { id: 'tech-stack', name: 'Technology Stack' },
  { id: 'methodology', name: 'Development Methodology' },
  { id: 'team', name: 'Team Structure' },
  { id: 'deliverables', name: 'Deliverables' },
  { id: 'acceptance', name: 'Acceptance Criteria' },
  { id: 'assumptions', name: 'Assumptions & Constraints' },
  { id: 'timeline', name: 'Timeline & Milestones' },
  { id: 'cost', name: 'Cost Breakdown' },
  { id: 'terms', name: 'Terms & Conditions' },
];

type ProposalContent = Record<string, string>;

const sectionAliases: Record<string, string> = {
  coverpage: 'cover',
  cover: 'cover',
  executivesummary: 'executive',
  executive: 'executive',
  summary: 'executive',
  projectbackground: 'background',
  background: 'background',
  scopeobjectives: 'scope',
  scopeandobjectives: 'scope',
  scope: 'scope',
  technicalapproach: 'technical',
  technical: 'technical',
  systemarchitecture: 'architecture',
  architecture: 'architecture',
  modulebreakdown: 'modules',
  modules: 'modules',
  technologystack: 'tech-stack',
  techstack: 'tech-stack',
  developmentmethodology: 'methodology',
  methodology: 'methodology',
  teamstructure: 'team',
  team: 'team',
  deliverables: 'deliverables',
  deliverableslisting: 'deliverables',
  acceptancecriteria: 'acceptance',
  acceptance: 'acceptance',
  assumptionsconstraints: 'assumptions',
  assumptionsandconstraints: 'assumptions',
  assumptions: 'assumptions',
  constraints: 'assumptions',
  timeline: 'timeline',
  timelinemilestones: 'timeline',
  timelineandmilestones: 'timeline',
  cost: 'cost',
  costbreakdown: 'cost',
  terms: 'terms',
  termsconditions: 'terms',
  termsandconditions: 'terms',
};

type ProposalRow = {
  id: string;
  project_id: string;
  title: string;
  status?: string | null;
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

type TemplateRow = {
  id: string;
  name: string;
  category?: string | null;
  sections?: string[] | null;
  is_default?: boolean | null;
  version?: number | null;
};

type CostEstimateRow = {
  id: string;
  project_id: string;
  development_cost: number;
  infrastructure_cost: number;
  third_party_cost: number;
  contingency_percent: number;
  contingency_amount: number;
  total_cost: number;
  min_cost?: number | null;
  max_cost?: number | null;
  confidence_score?: number | null;
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
};

type TimelineRow = {
  id: string;
  project_id: string;
  duration_weeks: number;
  min_weeks?: number | null;
  max_weeks?: number | null;
  risk_level?: string | null;
  confidence_score?: number | null;
  critical_path?: Array<{ name?: string; date?: string; status?: string }> | null;
};

function defaultContent(projectName: string, clientName: string): ProposalContent {
  return {
    executive: `${clientName} requires a dependable software solution for ${projectName}. This proposal presents a practical delivery approach, the recommended technology direction, core project modules, estimated delivery structure, assumptions, and acceptance criteria.`,
    technical: 'The solution will use a modular architecture with a responsive web interface, secure API layer, relational database, role-based access control, structured logging, and automated testing across critical workflows.',
  };
}

function normalizeSectionKey(key: string) {
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sectionAliases[compact] ?? key;
}

function normalizeGeneratedContent(generated: ProposalContent) {
  const toSectionText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      return value.map((item) => toSectionText(item)).filter(Boolean).join('\n\n');
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const preferred = record.content ?? record.body ?? record.text ?? record.description ?? record.summary;
      if (preferred) return toSectionText(preferred);
      return Object.entries(record)
        .filter(([key]) => !['id', 'key', 'name', 'title', 'section'].includes(key.toLowerCase()))
        .map(([key, item]) => `${key.replace(/[-_]/g, ' ')}: ${toSectionText(item)}`)
        .filter((line) => !line.endsWith(': '))
        .join('\n');
    }
    return '';
  };

  const collect = (source: unknown) => {
    if (!source) return {};

    if (Array.isArray(source)) {
      return source.reduce<ProposalContent>((next, item) => {
        if (!item || typeof item !== 'object') return next;
        const record = item as Record<string, unknown>;
        const rawKey = String(record.id ?? record.key ?? record.name ?? record.title ?? record.section ?? '');
        const normalizedKey = normalizeSectionKey(rawKey);
        const text = toSectionText(record.content ?? record.body ?? record.text ?? record.description ?? record);
        if (sections.some((section) => section.id === normalizedKey) && text) {
          next[normalizedKey] = text;
        }
        return next;
      }, {});
    }

    if (typeof source !== 'object') return {};

    return Object.entries(source as Record<string, unknown>).reduce<ProposalContent>((next, [key, value]) => {
      const normalizedKey = normalizeSectionKey(key);
      const text = toSectionText(value);
      if (sections.some((section) => section.id === normalizedKey) && text) {
        next[normalizedKey] = text;
      }
      return next;
    }, {});
  };

  const roots = [
    generated,
    (generated as any)?.sections,
    (generated as any)?.proposal,
    (generated as any)?.content,
    (generated as any)?.generated_content,
    (generated as any)?.generatedContent,
  ];

  return roots.reduce<ProposalContent>((next, root) => ({ ...next, ...collect(root) }), {});
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
    methodology: 'Delivery should follow an iterative methodology with confirmed milestones, frequent review checkpoints, clear change control, and acceptance gates before deployment.',
    team: 'The recommended team includes product ownership, project management, UX/UI design, frontend engineering, backend engineering, QA/testing, DevOps support, and stakeholder reviewers.',
    deliverables: 'Expected deliverables include validated requirements, solution design, implementation artifacts, tested application modules, deployment configuration, user documentation, and handover materials.',
    acceptance: 'Acceptance should be based on approved requirements, successful completion of priority workflows, security and access-control validation, performance expectations, and stakeholder sign-off.',
    assumptions: 'This proposal assumes timely stakeholder feedback, access to required systems, availability of decision makers, stable priority requirements, and a formal process for scope changes.',
    timeline: 'Delivery should proceed through discovery validation, design, implementation, testing, review, deployment, and handover. Final duration depends on confirmed scope and integration complexity.',
    cost: 'Cost should be estimated from module complexity, engineering effort, infrastructure needs, third-party services, testing effort, and contingency for unclear requirements.',
    terms: 'This proposal assumes timely stakeholder feedback, access to required systems, clear approval checkpoints, and a formal change process for new scope discovered after approval.',
  };
}

function textToList(value: string | undefined) {
  return String(value ?? '')
    .split(/\r?\n|;|\u2022|-/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .slice(0, 12);
}

export default function ProposalGeneration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditingExistingProposal = Boolean(id && id !== 'new');
  const routeState = location.state as { useLatestAnalysis?: boolean; projectId?: string | null } | null;
  const shouldUseLocalAnalysis = !isEditingExistingProposal && Boolean(routeState?.useLatestAnalysis || routeState?.projectId);
  const latestAnalysis = shouldUseLocalAnalysis ? readJson<any>('latestAnalysis', null) : null;
  const analysisProject = latestAnalysis?.project ?? { name: 'Untitled Project', client: 'Client not selected' };
  const [projectId, setProjectId] = useState(routeState?.projectId ?? (shouldUseLocalAnalysis ? readJson<string | null>('latestProjectId', null) : null));
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [costEstimate, setCostEstimate] = useState<CostEstimateRow | null>(null);
  const [techRecommendation, setTechRecommendation] = useState<TechRecommendationRow | null>(null);
  const [timelinePrediction, setTimelinePrediction] = useState<TimelineRow | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('Standard Technical Proposal');
  const [proposalId, setProposalId] = useState(isEditingExistingProposal ? id ?? '' : '');
  const proposalIdRef = useRef(isEditingExistingProposal ? id ?? '' : '');
  const persistingRef = useRef(false);
  const [persisting, setPersisting] = useState(false);
  const [proposalTitle, setProposalTitle] = useState(`${analysisProject.name} Proposal`);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState('executive');
  const [tone, setTone] = useState('Professional & Formal');
  const [detailLevel, setDetailLevel] = useState('Comprehensive');
  const [content, setContent] = useState<ProposalContent>(() =>
    defaultContent(analysisProject.name, analysisProject.client)
  );
  const session = getStoredSession();
  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const activeSectionName = useMemo(() => sections.find((section) => section.id === activeSection)?.name ?? 'Section', [activeSection]);
  const selectedProject = useMemo(() => projects.find((item) => item.id === projectId), [projectId, projects]);
  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId), [clients, selectedClientId]);
  const hasUsableAnalysis = Boolean(latestAnalysis?.summary?.totalRequirements && analysisProject.name !== 'Untitled Project');
  const hasProposalSource = Boolean(projectId || hasUsableAnalysis);
  const requirementItems = useMemo(() => {
    if (selectedProject?.requirements_text) {
      return selectedProject.requirements_text
        .split(/\r?\n/)
        .map((description) => ({ description: description.trim(), category: 'general', priority: 'medium' }))
        .filter((item) => item.description);
    }

    return (latestAnalysis?.requirements ?? [])
      .map((item: any) => ({
        description: String(item.description ?? '').trim(),
        category: item.category ?? 'general',
        priority: item.priority ?? 'medium',
      }))
      .filter((item: any) => item.description);
  }, [latestAnalysis?.requirements, selectedProject?.requirements_text]);
  const project = useMemo(
    () => ({
      name: selectedProject?.title ?? analysisProject.name,
      client: selectedClient?.company_name ?? selectedProject?.clients?.company_name ?? analysisProject.client,
      description: selectedProject?.description ?? latestAnalysis?.project?.description,
      requirements: requirementItems,
      summary: latestAnalysis?.summary,
      missingRequirements: latestAnalysis?.missingRequirements ?? [],
    }),
    [analysisProject.client, analysisProject.name, latestAnalysis?.missingRequirements, latestAnalysis?.project?.description, latestAnalysis?.summary, requirementItems, selectedClient?.company_name, selectedProject]
  );
  const currentProposalPath = isEditingExistingProposal && id ? `/proposals/${id}` : '/proposals/new';

  useEffect(() => {
    if (!isEditingExistingProposal) {
      setProposalId('');
      proposalIdRef.current = '';
      setProposalTitle(`${analysisProject.name} Proposal`);
      setContent(defaultContent(analysisProject.name, analysisProject.client));
    }
  }, [analysisProject.client, analysisProject.name, isEditingExistingProposal]);

  useEffect(() => {
    async function loadProposalSources() {
      try {
        const [clientRows, projectRows, templateRows] = await Promise.all([
          selectRows<ClientRow>('clients', 'select=id,company_name,contact_name,industry&order=company_name.asc'),
          selectRows<ProjectRow>('projects', 'select=id,title,description,project_type,requirements_text,client_id,clients(company_name)&order=created_at.desc'),
          selectRows<TemplateRow>('proposal_templates', 'select=id,name,category,sections,is_default,version&order=is_default.desc,updated_at.desc'),
        ]);
        setClients(clientRows);
        setProjects(projectRows);
        const availableTemplates = templateRows.length > 0
          ? templateRows
          : [{ id: '', ...standardProposalTemplate } as TemplateRow];
        setTemplates(availableTemplates);
        if (!selectedTemplateId && availableTemplates.length > 0) {
          const defaultTemplate = availableTemplates.find((template) => template.is_default) ?? availableTemplates[0];
          setSelectedTemplateId(defaultTemplate.id);
          setTemplateName(defaultTemplate.name);
        }
        const matchingProject = projectId ? projectRows.find((row) => row.id === projectId) : undefined;
        if (matchingProject?.client_id) setSelectedClientId(matchingProject.client_id);
        if (!isEditingExistingProposal && matchingProject?.title) {
          const clientName = matchingProject.clients?.company_name ?? analysisProject.client;
          setProposalTitle(`${matchingProject.title} Proposal`);
          setContent((current) => {
            const base = defaultContent(matchingProject.title, clientName);
            return current.executive?.includes('Untitled Project') ? base : { ...base, ...current };
          });
        }
      } catch (error) {
        console.warn('Unable to load proposal source data:', error);
      }
    }

    loadProposalSources();
  }, [analysisProject.client, isEditingExistingProposal, projectId, selectedTemplateId]);

  useEffect(() => {
    async function loadCostEstimate() {
      if (!projectId) {
        setCostEstimate(null);
        return;
      }

      try {
        const [row] = await selectRows<CostEstimateRow>('cost_estimations', `select=*&project_id=eq.${projectId}&order=created_at.desc&limit=1`);
        setCostEstimate(row ?? null);
      } catch (error) {
        setCostEstimate(null);
        console.warn('Unable to load proposal cost estimate:', error);
      }
    }

    loadCostEstimate();
  }, [projectId]);

  useEffect(() => {
    if (!costEstimate || String(content.cost ?? '').trim()) return;
    setContent((current) => ({
      ...current,
      cost: [
        `Estimated project cost: NGN ${Number(costEstimate.total_cost || 0).toLocaleString()}.`,
        `Development: NGN ${Number(costEstimate.development_cost || 0).toLocaleString()}.`,
        `Infrastructure: NGN ${Number(costEstimate.infrastructure_cost || 0).toLocaleString()}.`,
        `Third-party services: NGN ${Number(costEstimate.third_party_cost || 0).toLocaleString()}.`,
        `Contingency: ${costEstimate.contingency_percent}% (NGN ${Number(costEstimate.contingency_amount || 0).toLocaleString()}).`,
        costEstimate.min_cost && costEstimate.max_cost
          ? `Expected range: NGN ${Number(costEstimate.min_cost).toLocaleString()} - NGN ${Number(costEstimate.max_cost).toLocaleString()}.`
          : '',
      ].filter(Boolean).join('\n'),
    }));
  }, [content.cost, costEstimate]);

  useEffect(() => {
    async function loadTechRecommendation() {
      if (!projectId) {
        setTechRecommendation(null);
        return;
      }

      try {
        const [row] = await selectRows<TechRecommendationRow>('tech_recommendations', `select=*&project_id=eq.${projectId}&order=created_at.desc&limit=1`);
        setTechRecommendation(row ?? null);
      } catch (error) {
        setTechRecommendation(null);
        console.warn('Unable to load proposal technology recommendation:', error);
      }
    }

    loadTechRecommendation();
  }, [projectId]);

  useEffect(() => {
    async function loadTimelinePrediction() {
      if (!projectId) {
        setTimelinePrediction(null);
        return;
      }

      try {
        const [row] = await selectRows<TimelineRow>('timeline_predictions', `select=*&project_id=eq.${projectId}&order=created_at.desc&limit=1`);
        setTimelinePrediction(row ?? null);
      } catch (error) {
        setTimelinePrediction(null);
        console.warn('Unable to load proposal timeline prediction:', error);
      }
    }

    loadTimelinePrediction();
  }, [projectId]);

  useEffect(() => {
    if (!techRecommendation || String(content['tech-stack'] ?? '').trim()) return;
    setContent((current) => ({
      ...current,
      'tech-stack': [
        `Recommended stack: ${techRecommendation.stack_name}.`,
        `Frontend: ${techRecommendation.frontend || 'To be confirmed'}.`,
        `Backend: ${techRecommendation.backend || 'To be confirmed'}.`,
        `Database: ${techRecommendation.database_name || 'To be confirmed'}.`,
        `Hosting: ${techRecommendation.hosting || 'To be confirmed'}.`,
        techRecommendation.match_score ? `Match score: ${techRecommendation.match_score}%.` : '',
        techRecommendation.rationale ? `Rationale: ${techRecommendation.rationale}` : '',
      ].filter(Boolean).join('\n'),
    }));
  }, [content, techRecommendation]);

  useEffect(() => {
    if (!timelinePrediction || String(content.timeline ?? '').trim()) return;
    const milestones = (timelinePrediction.critical_path ?? [])
      .map((milestone) => `- ${milestone.name ?? 'Milestone'}${milestone.date ? `: ${milestone.date}` : ''}`)
      .join('\n');
    setContent((current) => ({
      ...current,
      timeline: [
        `Estimated delivery duration: ${timelinePrediction.duration_weeks} weeks.`,
        timelinePrediction.min_weeks && timelinePrediction.max_weeks
          ? `Expected range: ${timelinePrediction.min_weeks} - ${timelinePrediction.max_weeks} weeks.`
          : '',
        timelinePrediction.risk_level ? `Risk level: ${timelinePrediction.risk_level}.` : '',
        timelinePrediction.confidence_score ? `Confidence score: ${timelinePrediction.confidence_score}%.` : '',
        milestones ? `Key milestones:\n${milestones}` : '',
      ].filter(Boolean).join('\n'),
    }));
  }, [content.timeline, timelinePrediction]);

  useEffect(() => {
    async function loadProposal() {
      if (!id || id === 'new') return;
      try {
        const [row] = await selectRows<ProposalRow>('proposals', `select=*&id=eq.${id}`);
        if (!row) return;
        setProposalId(row.id);
        proposalIdRef.current = row.id;
        setProjectId(row.project_id);
        setProposalTitle(row.title);
        setTemplateName(row.template_name ?? 'Standard Technical Proposal');
        setTone(row.tone ?? 'Professional & Formal');
        setDetailLevel(row.detail_level ?? 'Comprehensive');
      setContent({
          ...normalizeGeneratedContent(row.generated_content ?? {}),
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

  useEffect(() => {
    if (!templateName || selectedTemplateId || templates.length === 0) return;
    const matchingTemplate = templates.find((template) => template.name === templateName);
    if (matchingTemplate) setSelectedTemplateId(matchingTemplate.id);
  }, [selectedTemplateId, templateName, templates]);

  const selectAnalysisSource = (nextProjectId: string) => {
    setProjectId(nextProjectId || null);
    const nextProject = projects.find((item) => item.id === nextProjectId);
    setSelectedClientId(nextProject?.client_id ?? '');
    if (nextProject?.title) {
      setProposalTitle(`${nextProject.title} Proposal`);
      setContent((current) => ({ ...defaultContent(nextProject.title, nextProject.clients?.company_name ?? analysisProject.client), ...current }));
    }
  };

  const selectTemplate = (nextTemplateId: string) => {
    setSelectedTemplateId(nextTemplateId);
    const nextTemplate = templates.find((template) => template.id === nextTemplateId);
    setTemplateName(nextTemplate?.name ?? 'Standard Technical Proposal');
  };

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
    if (persistingRef.current) return proposalIdRef.current;
    persistingRef.current = true;
    setPersisting(true);

    try {
      const persistedProjectId = await ensureProject();

      const payload = {
        project_id: persistedProjectId,
        created_by: session?.userId ?? null,
        title: proposalTitle.trim() || `${project.name} Proposal`,
        template_name: templateName,
        tone,
        detail_level: detailLevel,
        executive_summary: nextContent.executive,
        technical_approach: nextContent.technical,
        architecture_description: nextContent.architecture,
        deliverables: textToList(nextContent.deliverables),
        assumptions: textToList(nextContent.assumptions),
        acceptance_criteria: textToList(nextContent.acceptance),
        generated_content: nextContent,
      };

      const currentProposalId = proposalIdRef.current || proposalId;
      if (currentProposalId) {
        const [updated] = await updateRows<ProposalRow>('proposals', `id=eq.${currentProposalId}`, payload);
        if (updated?.id) {
          setProposalId(updated.id);
          proposalIdRef.current = updated.id;
        }
        await updateRows('projects', `id=eq.${persistedProjectId}`, { status: 'proposal' }).catch(() => undefined);
        return updated?.id ?? currentProposalId;
      } else {
        const [existingDraft] = await selectRows<ProposalRow>(
          'proposals',
          `select=id&project_id=eq.${persistedProjectId}&title=eq.${encodeURIComponent(payload.title)}&status=eq.draft&order=created_at.desc&limit=1`
        );
        if (existingDraft?.id) {
          const [updated] = await updateRows<ProposalRow>('proposals', `id=eq.${existingDraft.id}`, payload);
          const nextProposalId = updated?.id ?? existingDraft.id;
          setProposalId(nextProposalId);
          proposalIdRef.current = nextProposalId;
          navigate(`/proposals/${nextProposalId}`, { replace: true });
          await updateRows('projects', `id=eq.${persistedProjectId}`, { status: 'proposal' }).catch(() => undefined);
          return nextProposalId;
        }

        const [saved] = await insertRow<ProposalRow>('proposals', payload as ProposalRow);
        if (saved?.id) {
          setProposalId(saved.id);
          proposalIdRef.current = saved.id;
          navigate(`/proposals/${saved.id}`, { replace: true });
        }
        await updateRows('projects', `id=eq.${persistedProjectId}`, { status: 'proposal' }).catch(() => undefined);
        return saved?.id ?? '';
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Proposal save failed.');
      console.warn('Proposal persistence failed:', error);
      return '';
    } finally {
      persistingRef.current = false;
      setPersisting(false);
    }
  };

  const submitForReview = async () => {
    const savedProposalId = await saveProposal();
    if (!savedProposalId) return;

    try {
      await updateRows('proposals', `id=eq.${savedProposalId}`, { status: 'in_review' });
      removeJson('latestAnalysis');
      removeJson('latestProjectId');
      setProposalId('');
      proposalIdRef.current = '';
      setProjectId(null);
      setSelectedClientId('');
      setProposalTitle('New Proposal');
      setContent(defaultContent('New Proposal', 'Client not selected'));
      toast.success('Proposal submitted for review.');
      navigate('/proposals');
    } catch (error) {
      toast.error('Unable to submit proposal for review.');
      console.warn(error);
    }
  };

  const generateSectionText = async (sectionId: string) => {
      const prompt = `Write the "${sections.find((section) => section.id === sectionId)?.name}" section of a technical proposal.
Tone: ${tone}
Detail level: ${detailLevel}
Project context: ${JSON.stringify(project)}
Requirements: ${JSON.stringify(requirementItems)}
Cost estimate: ${JSON.stringify(costEstimate)}
Technology recommendation: ${JSON.stringify(techRecommendation)}
Timeline prediction: ${JSON.stringify(timelinePrediction)}
Template: ${templateName}
Template sections: ${JSON.stringify(templates.find((template) => template.id === selectedTemplateId)?.sections ?? sections.map((section) => section.name))}
Return polished proposal text only. Do not return JSON or markdown fences.`;
      return generateWithNvidia(prompt);
  };

  const generateSectionTextWithRetry = async (sectionId: string) => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await generateSectionText(sectionId);
      } catch (error) {
        if (!isNvidiaRetryableError(error) || attempt === maxAttempts) {
          throw error;
        }

        const retryAfter = getNvidiaRetryAfterMs(error);
        toast.warning(`The AI service is temporarily unavailable for ${sections.find((section) => section.id === sectionId)?.name}. Retrying in ${Math.ceil(retryAfter / 1000)}s.`);
        await sleep(retryAfter + 500);
      }
    }

    throw new Error('AI retry failed.');
  };

  const handleGenerateSection = async (sectionId = activeSection) => {
    setGenerating(true);
    try {
      const text = await generateSectionTextWithRetry(sectionId);
      const nextContent = { ...content, [sectionId]: text };
      setContent(nextContent);
      const saved = await saveProposal(nextContent);
      toast.success(saved ? 'Section generated and saved as an online draft.' : 'Section generated. Save after selecting an analysis.');
    } catch (error) {
      const fallback = `${activeSectionName}\n\nThis section should be completed using the project requirements, client objectives, technical constraints, delivery assumptions, and acceptance criteria captured during requirement analysis.`;
      const nextContent = { ...content, [sectionId]: fallback };
      setContent(nextContent);
      toast.warning(`Local fallback inserted. ${getNvidiaErrorMessage(error)}`);
      console.warn(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      let nextContent = { ...content };
      const startIndex = Math.max(0, sections.findIndex((section) => !String(nextContent[section.id] ?? '').trim()));
      const pendingSections = startIndex === -1 ? sections : sections.slice(startIndex);

      for (const section of pendingSections) {
        const text = await generateSectionTextWithRetry(section.id);
        nextContent = { ...nextContent, [section.id]: text };
        setContent(nextContent);
        setActiveSection(section.id);
        await saveProposal(nextContent);
      }
      toast.success('All proposal sections generated and saved as an online draft.');
    } catch (error) {
      if (isNvidiaQuotaError(error)) {
        toast.warning('AI quota paused generation. Completed sections were saved online. Click Generate All again later to continue remaining sections.');
      } else {
        const nextContent = { ...content, ...buildLocalProposalContent(project, latestAnalysis) };
        setContent(nextContent);
        await saveProposal(nextContent);
        toast.warning(`Generated a local proposal fallback. ${getNvidiaErrorMessage(error)}`);
      }
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
    proposalIdRef.current = '';
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
              <Button variant="outline" size="sm" onClick={() => navigate('/proposals')} aria-label="Back to Proposals" className="h-10 w-10 px-0 sm:w-auto sm:px-3">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
              </Button>
              <Button variant="outline" size="sm" onClick={clearLocalProposalFlow} aria-label="Clear Draft" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={isEditingExistingProposal}>
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Draft</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} aria-label="Export" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={!hasProposalSource}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => saveProposal().then((saved) => saved && toast.success('Proposal saved.'))} aria-label="Save" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={!hasProposalSource || persisting}>
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{persisting ? 'Saving...' : 'Save'}</span>
              </Button>
              <Button variant="ai" size="sm" onClick={submitForReview} aria-label="Submit for Review" className="h-10 w-10 px-0 sm:w-auto sm:px-3" disabled={!hasProposalSource || persisting}>
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
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">Requirements Analysis</label>
                {projects.length > 0 ? (
                  <select
                    value={projectId ?? ''}
                    onChange={(event) => selectAnalysisSource(event.target.value)}
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
                <Link to="/requirements/new" state={{ returnTo: currentProposalPath }} className="w-full">
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">New Analysis</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </Link>
              </div>
              </div>

              {hasProposalSource && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase text-gray-500">Project</p>
                        <p className="mt-1 font-semibold text-gray-900">{project.name}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">{project.description || 'No project description captured.'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase text-gray-500">Client</p>
                        <p className="mt-1 font-semibold text-gray-900">{project.client}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">Client comes from the selected requirement analysis.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase text-gray-500">Requirement Plan</p>
                        <p className="mt-1 font-semibold text-gray-900">{requirementItems.length} requirements</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">Used for scope, modules, timeline, cost, and acceptance language.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">Source Setup</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">Keep the client and requirement plan accurate before generating sections.</p>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <Link to="/requirements/new" state={{ returnTo: currentProposalPath, editAnalysis: true }} className="w-full">
                      <Button variant="outline" className="w-full justify-start">
                        <ListChecks className="h-4 w-4" />
                        Edit Requirement Plan
                      </Button>
                    </Link>
                    <Link to="/clients" className="w-full">
                      <Button variant="outline" className="w-full justify-start">
                        <UserRound className="h-4 w-4" />
                        Manage Clients
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className={`rounded-lg border p-4 ${hasProposalSource ? 'border-blue-100 bg-blue-50/40' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-sm font-semibold text-gray-900">Planning Workbench</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    Complete technology, cost, and timeline planning so the proposal sections use real project data.
                  </p>
                  {hasProposalSource ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Link to="/technology" state={{ returnTo: currentProposalPath, projectId, useLatestAnalysis: true }} className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50">
                        <Cpu className="h-5 w-5 text-blue-600" />
                        <p className="mt-3 font-medium text-gray-900">Technology Stack</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">{techRecommendation ? techRecommendation.stack_name : 'Recommend stack and architecture.'}</p>
                      </Link>
                      <Link to="/estimation" state={{ returnTo: currentProposalPath, projectId, useLatestAnalysis: true }} className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50">
                        <Calculator className="h-5 w-5 text-blue-600" />
                        <p className="mt-3 font-medium text-gray-900">Cost Estimate</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">{costEstimate ? `NGN ${Number(costEstimate.total_cost || 0).toLocaleString()}` : 'Calculate effort, rates, and contingency.'}</p>
                      </Link>
                      <Link to="/timeline" state={{ returnTo: currentProposalPath, projectId, useLatestAnalysis: true }} className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50">
                        <CalendarDays className="h-5 w-5 text-blue-600" />
                        <p className="mt-3 font-medium text-gray-900">Timeline</p>
                        <p className="mt-1 text-xs leading-5 text-gray-600">{timelinePrediction ? `${timelinePrediction.duration_weeks} weeks, ${timelinePrediction.risk_level ?? 'medium'} risk` : 'Plan phases, milestones, and risk.'}</p>
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                      Select or create a requirement analysis before opening planning tools.
                    </p>
                  )}
                </div>
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
                    placeholder="Generate this section with AI or write the content manually."
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
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Proposal Template</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(event) => selectTemplate(event.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {templates.length === 0 ? (
                          <option value="">Standard Technical Proposal</option>
                        ) : (
                          templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                              {template.category ? ` - ${template.category}` : ''}
                              {template.is_default ? ' (default)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                      <p className="mt-1.5 text-xs leading-5 text-gray-500">
                        The selected template is saved with the proposal and included in AI section prompts.
                      </p>
                    </div>
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
                  <CardTitle className="text-xl">Proposal Readiness</CardTitle>
                  <p className="text-sm leading-6 text-gray-600">
                    Confirm the planning outputs that will shape the AI draft before generating or submitting the proposal.
                  </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      label: 'Requirements',
                      ready: requirementItems.length > 0,
                      value: `${requirementItems.length} captured`,
                    },
                    {
                      label: 'Template',
                      ready: Boolean(templateName),
                      value: templateName,
                    },
                    {
                      label: 'Technology',
                      ready: Boolean(techRecommendation),
                      value: techRecommendation ? techRecommendation.stack_name : 'Open Technology Stack',
                    },
                    {
                      label: 'Cost',
                      ready: Boolean(costEstimate),
                      value: costEstimate ? `NGN ${Number(costEstimate.total_cost || 0).toLocaleString()}` : 'Open Cost Estimate',
                    },
                    {
                      label: 'Timeline',
                      ready: Boolean(timelinePrediction),
                      value: timelinePrediction ? `${timelinePrediction.duration_weeks} weeks` : 'Open Timeline',
                    },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-lg border p-4 ${item.ready ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <Badge variant={item.ready ? 'success' : 'warning'}>{item.ready ? 'Ready' : 'Needed'}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-gray-700">{item.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
