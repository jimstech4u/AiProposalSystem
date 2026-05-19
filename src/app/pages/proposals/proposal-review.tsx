import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, Clock, FileText, Search } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';

type Proposal = {
  id: string;
  title: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'declined';
  executive_summary?: string | null;
  created_at: string;
  version: number;
};

export default function ProposalReviewPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState('');
  const [search, setSearch] = useState('');
  const session = getStoredSession();

  useEffect(() => {
    async function loadProposals() {
      try {
        const rows = await selectRows<Proposal>('proposals', 'select=id,title,status,executive_summary,created_at,version&status=eq.in_review&order=created_at.desc');
        setProposals(rows);
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

  const setDecision = async (id: string, status: 'approved' | 'rejected' | 'in_review', decision: 'approved' | 'rejected' | 'revision_requested') => {
    try {
      await insertRow('proposal_reviews', {
        proposal_id: id,
        reviewer_id: session?.userId ?? null,
        decision,
        comments: comments.trim() || null,
        checklist: {
          complete_summary: true,
          technical_scope_reviewed: true,
          pricing_terms_reviewed: true,
        },
      });
      await updateRows<Proposal>('proposals', `id=eq.${id}`, { status });
      setProposals((current) => current.filter((proposal) => proposal.id !== id));
      setSelectedProposal(null);
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

              <div className="mb-6">
                <h3 className="font-semibold mb-2">Executive Summary</h3>
                <p className="text-gray-700 text-sm whitespace-pre-line">{selected.executive_summary || 'No executive summary was saved for this proposal.'}</p>
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
                <Button onClick={() => setDecision(selected.id, 'approved', 'approved')} aria-label="Approve Proposal" className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:flex-1 sm:px-4">
                  <CheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Approve Proposal</span>
                </Button>
                <Button onClick={() => setDecision(selected.id, 'rejected', 'rejected')} variant="danger" aria-label="Reject Proposal" className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:flex-1 sm:px-4">
                  <XCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Reject Proposal</span>
                </Button>
                <Button onClick={() => setDecision(selected.id, 'in_review', 'revision_requested')} variant="outline" aria-label="Request Revision" className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:flex-1 sm:px-4">
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
