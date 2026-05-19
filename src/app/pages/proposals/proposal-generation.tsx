import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Sparkles, Save, Download, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { extractJsonObject, generateWithGemini } from '../../../lib/gemini';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson, saveJson } from '../../../lib/storage';
import { insertRow, selectRows, updateRows } from '../../../lib/supabase';

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

function defaultContent(projectName: string, clientName: string): ProposalContent {
  return {
    executive: `${clientName} requires a dependable software solution for ${projectName}. This proposal presents a practical delivery approach, the recommended technology direction, core project modules, estimated delivery structure, assumptions, and acceptance criteria.`,
    technical: 'The solution will use a modular architecture with a responsive web interface, secure API layer, relational database, role-based access control, structured logging, and automated testing across critical workflows.',
  };
}

export default function ProposalGeneration() {
  const { id } = useParams();
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const project = latestAnalysis?.project ?? { name: 'Untitled Project', client: 'Client not selected' };
  const [projectId, setProjectId] = useState(readJson<string | null>('latestProjectId', null));
  const storedProposal = readJson<ProposalContent | null>('latestProposal', null);
  const [proposalId, setProposalId] = useState(id && id !== 'new' ? id : '');
  const [proposalTitle, setProposalTitle] = useState(`${project.name} Proposal`);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState('executive');
  const [tone, setTone] = useState('Professional & Formal');
  const [detailLevel, setDetailLevel] = useState('Comprehensive');
  const [content, setContent] = useState<ProposalContent>(() => storedProposal ?? defaultContent(project.name, project.client));

  const activeSectionName = useMemo(() => sections.find((section) => section.id === activeSection)?.name ?? 'Section', [activeSection]);

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
        toast.error('Unable to load proposal from Supabase.');
        console.warn(error);
      }
    }

    loadProposal();
  }, [id]);

  const saveProposal = async (nextContent = content) => {
    saveJson('latestProposal', nextContent);
    try {
      if (!projectId) {
        throw new Error('No persisted project id is available for this proposal.');
      }

      const payload = {
        project_id: projectId,
        title: proposalTitle,
        template_name: 'Standard Technical Proposal',
        tone,
        detail_level: detailLevel,
        executive_summary: nextContent.executive,
        technical_approach: nextContent.technical,
        architecture_description: nextContent.architecture,
        generated_content: nextContent,
      };

      if (proposalId) {
        await updateRows('proposals', `id=eq.${proposalId}`, payload);
      } else {
        const [saved] = await insertRow<ProposalRow>('proposals', payload as ProposalRow);
        if (saved?.id) setProposalId(saved.id);
      }
    } catch (error) {
      console.warn('Supabase proposal persistence skipped:', error);
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
      await saveProposal(nextContent);
      toast.success('Section generated with Gemini.');
    } catch (error) {
      const fallback = `${activeSectionName}\n\nThis section should be completed using the project requirements, client objectives, technical constraints, delivery assumptions, and acceptance criteria captured during requirement analysis.`;
      const nextContent = { ...content, [sectionId]: fallback };
      setContent(nextContent);
      saveJson('latestProposal', nextContent);
      toast.warning('Gemini was unavailable; local fallback content was inserted.');
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
      await saveProposal(nextContent);
      toast.success('Full proposal generated with Gemini.');
    } catch (error) {
      toast.error('Unable to generate the full proposal. Try one section at a time.');
      console.warn(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = (format: 'pdf' | 'docx') => {
    const report = toReport(
      `${project.name} Technical Proposal`,
      sections.map((section) => ({ heading: section.name, body: content[section.id] ?? 'Pending generation.' }))
    );
    downloadTextFile(`${project.name || 'proposal'}.${format === 'docx' ? 'doc' : 'txt'}`, report, format === 'docx' ? 'application/msword' : 'text/plain');
    toast.success(`Proposal exported as ${format.toUpperCase()}.`);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1 min-w-0">
              <input
                value={proposalTitle}
                onChange={(event) => setProposalTitle(event.target.value)}
                className="w-full rounded-md border border-transparent bg-transparent px-0 py-1 text-2xl font-bold text-gray-900 focus:border-gray-300 focus:px-3 focus:outline-none md:text-3xl"
              />
              <p className="text-sm text-gray-600 mt-2">For {project.client} - Gemini-assisted draft</p>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('docx')}>
                <FileText className="w-4 h-4" />
              </Button>
              <Button variant="primary" size="sm" onClick={() => saveProposal().then(() => toast.success('Proposal saved.'))}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Card className="border-2 border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="w-6 h-6 text-purple-600" />
                AI Content Generation
              </CardTitle>
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
              <div className="flex flex-col gap-4 sm:flex-row">
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{activeSectionName}</CardTitle>
                <Badge variant="purple" className="gap-1 px-3 py-1">
                  <Sparkles className="w-3 h-3" />
                  Editable AI Draft
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full h-96 p-5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base leading-relaxed"
                value={content[activeSection] ?? ''}
                placeholder="Generate this section with Gemini or write the content manually."
                onChange={(event) => setContent((current) => ({ ...current, [activeSection]: event.target.value }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="w-full bg-gray-50 border-t border-gray-200 p-4 md:p-8 lg:w-96 lg:border-l lg:border-t-0">
        <div>
          <h3 className="font-semibold text-gray-900 mb-4 text-lg">Proposal Sections</h3>
          <div className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  activeSection === section.id ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200' : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-4 text-lg">Source Data</h3>
          <div className="space-y-3 text-sm">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="font-medium text-gray-900">Requirements Analysis</p>
              <p className="text-gray-600 text-xs mt-1.5">{latestAnalysis?.summary?.totalRequirements ?? 0} requirements identified</p>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <p className="font-medium text-gray-900">Client</p>
              <p className="text-gray-600 text-xs mt-1.5">{project.client}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
