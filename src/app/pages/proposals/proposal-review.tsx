import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, Clock, FileText, Search, ClipboardCheck, Cpu, Calculator, CalendarDays } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';
import { formatCostEstimate, formatTechRecommendation, formatTimelinePrediction, loadProposalPlanning, type ProposalPlanning } from '../../../lib/proposal-planning';

type Proposal = {
  id: string;
  project_id?: string | null;
  title: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'declined';
  executive_summary?: string | null;
  technical_approach?: string | null;
  architecture_description?: string | null;
  template_name?: string | null;
  tone?: string | null;
  detail_level?: string | null;
  generated_content?: Record<string, string> | null;
  created_at: string;
  version: number;
};

const reviewSections = [
  ['cover', 'Cover Page'],
  ['executive', 'Executive Summary'],
  ['background', 'Project Background'],
  ['scope', 'Scope & Objectives'],
  ['technical', 'Technical Approach'],
  ['architecture', 'System Architecture'],
  ['modules', 'Module Breakdown'],
  ['tech-stack', 'Technology Stack'],
  ['methodology', 'Development Methodology'],
  ['team', 'Team Structure'],
  ['deliverables', 'Deliverables'],
  ['acceptance', 'Acceptance Criteria'],
  ['assumptions', 'Assumptions & Constraints'],
  ['timeline', 'Timeline & Milestones'],
  ['cost', 'Cost Breakdown'],
  ['terms', 'Terms & Conditions'],
] as const;

const checklistItems = [
  ['complete_summary', 'Executive summary and client value are clear'],
  ['scope_reviewed', 'Scope, modules, deliverables, and exclusions are reviewed'],
  ['technical_reviewed', 'Technical approach, architecture, and stack are reviewed'],
  ['timeline_reviewed', 'Timeline, milestones, and dependencies are reviewed'],
  ['pricing_reviewed', 'Cost breakdown, assumptions, and commercial terms are reviewed'],
  ['acceptance_reviewed', 'Acceptance criteria are measurable and complete'],
] as const;

function initialChecklist() {
  return checklistItems.reduce<Record<string, boolean>>((acc, [key]) => ({ ...acc, [key]: false }), {});
}

export default function ProposalReviewPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [planning, setPlanning] = useState<ProposalPlanning>({ costs: {}, tech: {}, timelines: {} });
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initialChecklist);
  const [search, setSearch] = useState('');
  const session = getStoredSession();

  useEffect(() => {
    async function loadProposals() {
      try {
        const rows = await selectRows<Proposal>('proposals', 'select=id,project_id,title,status,template_name,tone,detail_level,executive_summary,technical_approach,architecture_description,generated_content,created_at,version&status=eq.in_review&order=created_at.desc');
        setProposals(rows);
        loadProposalPlanning(rows.map((row) => row.project_id ?? '').filter(Boolean))
          .then(setPlanning)
          .catch((planningError) => console.warn('Unable to load proposal planning data:', planningError));
        setSelectedProposal(rows[0]?.id ?? null);
      } catch (error) {
        console.warn('Unable to load proposals for review:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProposals();
  }, []);

  const filteredProposals = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return proposals;

    return proposals.filter((proposal) =>
      [proposal.title, proposal.status, proposal.executive_summary, proposal.version]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [proposals, search]);
  const selected = useMemo(() => proposals.find((proposal) => proposal.id === selectedProposal), [proposals, selectedProposal]);
  const allChecklistComplete = useMemo(() => Object.values(checklist).every(Boolean), [checklist]);
  const selectedPlanning = selected?.project_id
    ? {
        cost: planning.costs[selected.project_id],
        tech: planning.tech[selected.project_id],
        timeline: planning.timelines[selected.project_id],
      }
    : { cost: undefined, tech: undefined, timeline: undefined };

  const getSectionBody = (proposal: Proposal, key: string) => {
    const generated = proposal.generated_content?.[key];
    if (generated) return generated;
    if (key === 'executive') return proposal.executive_summary ?? '';
    if (key === 'technical') return proposal.technical_approach ?? '';
    if (key === 'architecture') return proposal.architecture_description ?? '';
    return '';
  };

  useEffect(() => {
    setChecklist(initialChecklist());
    setComments('');
  }, [selectedProposal]);

  const setDecision = async (id: string, status: 'approved' | 'rejected' | 'draft', decision: 'approved' | 'rejected' | 'revision_requested') => {
    if (decision === 'approved' && !allChecklistComplete) {
      toast.error('Complete the review checklist before approving this proposal.');
      return;
    }

    try {
      await insertRow('proposal_reviews', {
        proposal_id: id,
        reviewer_id: session?.userId ?? null,
        decision,
        comments: comments.trim() || null,
        checklist,
      });
      await updateRows<Proposal>('proposals', `id=eq.${id}`, { status });
      setProposals((current) => {
        const remaining = current.filter((proposal) => proposal.id !== id);
        setSelectedProposal(remaining[0]?.id ?? null);
        return remaining;
      });
      setComments('');
      toast.success(decision === 'approved' ? 'Proposal approved successfully.' : decision === 'rejected' ? 'Proposal rejected.' : 'Revision requested.');
    } catch (error) {
      toast.error('Unable to update proposal review. Check your role permissions.');
      console.warn(error);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proposal Review & Approval</h1>
        <p className="text-gray-600">Review proposals currently marked as in review.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="p-4">
            <div className="mb-4 space-y-3">
              <h2 className="font-semibold">Pending Approvals ({filteredProposals.length})</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search approvals..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {loading ? (
              <p className="text-sm text-gray-600">Loading proposals...</p>
            ) : proposals.length === 0 ? (
              <p className="text-sm text-gray-600">No proposals are waiting for approval.</p>
            ) : filteredProposals.length === 0 ? (
              <p className="text-sm text-gray-600">No pending proposals match your search.</p>
            ) : (
              <div className="space-y-3">
                {filteredProposals.map((proposal) => (
                  <button
                    key={proposal.id}
                    onClick={() => setSelectedProposal(proposal.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedProposal === proposal.id ? 'border-sky-600 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm">{proposal.title}</h3>
                      <Badge variant="warning">
                        <Clock className="w-3 h-3 mr-1" />
                        Review
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{new Date(proposal.created_at).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <Card className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{selected.title}</h2>
                  <p className="text-gray-600">Version {selected.version}</p>
                </div>
                <Badge variant="warning">Pending Review</Badge>
              </div>

              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                <p className="font-medium text-gray-900">Proposal Metadata</p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-gray-600 sm:grid-cols-2">
                  <p>Template: {selected.template_name || 'Not set'}</p>
                  <p>Created: {new Date(selected.created_at).toLocaleString()}</p>
                  <p>Tone: {selected.tone || 'Not set'}</p>
                  <p>Detail Level: {selected.detail_level || 'Not set'}</p>
                  <p>Project ID: {selected.project_id || 'Not linked'}</p>
                  <p>Generated Sections: {Object.keys(selected.generated_content ?? {}).length}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-blue-700" />
                    <h3 className="font-semibold">Technology Stack</h3>
                  </div>
                  <p className="text-sm whitespace-pre-line text-gray-700">{formatTechRecommendation(selectedPlanning.tech)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-green-700" />
                    <h3 className="font-semibold">Cost Estimate</h3>
                  </div>
                  <p className="text-sm whitespace-pre-line text-gray-700">{formatCostEstimate(selectedPlanning.cost)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-purple-700" />
                    <h3 className="font-semibold">Timeline Prediction</h3>
                  </div>
                  <p className="text-sm whitespace-pre-line text-gray-700">{formatTimelinePrediction(selectedPlanning.timeline)}</p>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                {reviewSections.map(([key, label]) => {
                  const body = getSectionBody(selected, key);
                  return (
                    <div key={key} className="rounded-lg border border-gray-200 p-4">
                      <h3 className="font-semibold mb-2">{label}</h3>
                      <p className="text-gray-700 text-sm whitespace-pre-line">{body || 'This section has not been completed.'}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mb-6 rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-sky-700" />
                  <h3 className="font-semibold">Review Checklist</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {checklistItems.map(([key, label]) => (
                    <label key={key} className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={Boolean(checklist[key])}
                        onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))}
                        className="mt-0.5"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Review Comments</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  rows={4}
                  placeholder="Add your review comments..."
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setDecision(selected.id, 'approved', 'approved')} aria-label="Approve Proposal" className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:flex-1 sm:px-4" disabled={!allChecklistComplete}>
                  <CheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Approve Proposal</span>
                </Button>
                <Button onClick={() => setDecision(selected.id, 'rejected', 'rejected')} variant="danger" aria-label="Reject Proposal" className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:flex-1 sm:px-4">
                  <XCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Reject Proposal</span>
                </Button>
                <Button onClick={() => setDecision(selected.id, 'draft', 'revision_requested')} variant="outline" aria-label="Request Revision" className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:flex-1 sm:px-4">
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">Request Revision</span>
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Select a proposal to review</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
