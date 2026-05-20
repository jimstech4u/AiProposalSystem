import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Archive, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { deleteRows, insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { can, getStoredRole } from '../../../lib/permissions';
import { toast } from 'sonner';

type ProposalRow = {
  id: string;
  title: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'declined';
  version: number;
  created_at: string;
  template_name?: string | null;
  project_id: string;
  generated_content?: Record<string, string> | null;
};

type ProjectRow = {
  id: string;
  title: string;
  project_type?: string | null;
  requirements_text?: string | null;
};

type CostEstimateRow = {
  total_cost?: number | null;
};

function formatStatus(status: ProposalRow['status']) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProposalList() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [archivedProjectIds, setArchivedProjectIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const role = getStoredRole();
  const canCreate = can(role, 'proposals', 'create');
  const canUpdate = can(role, 'proposals', 'update');
  const canDelete = can(role, 'proposals', 'delete');

  async function loadProposals() {
      try {
        const [rows, repositoryRows] = await Promise.all([
          selectRows<ProposalRow>('proposals', 'select=*&order=created_at.desc'),
          selectRows<{ project_id?: string | null }>('project_repository', 'select=project_id'),
        ]);
        setProposals(rows);
        setArchivedProjectIds(new Set(repositoryRows.map((row) => row.project_id).filter(Boolean) as string[]));
      } catch (error) {
        console.warn('Unable to load proposals:', error);
      } finally {
        setLoading(false);
      }
    }

  useEffect(() => {
    loadProposals();
  }, []);

  const changeStatus = async (proposal: ProposalRow, status: ProposalRow['status']) => {
    try {
      await updateRows('proposals', `id=eq.${proposal.id}`, { status });
      toast.success('Proposal status updated.');
      await loadProposals();
    } catch (error) {
      toast.error('Proposal status update failed. Check your role permissions.');
      console.warn(error);
    }
  };

  const deleteProposal = async (proposal: ProposalRow) => {
    if (!window.confirm(`Delete proposal "${proposal.title}"?`)) return;
    try {
      await deleteRows('proposals', `id=eq.${proposal.id}`);
      toast.success('Proposal deleted.');
      await loadProposals();
    } catch (error) {
      toast.error('Proposal delete failed. Check your role permissions.');
      console.warn(error);
    }
  };

  const archiveProposal = async (proposal: ProposalRow) => {
    if (!window.confirm(`Archive "${proposal.title}" into the project repository?`)) return;

    try {
      const existing = await selectRows('project_repository', `select=id&project_id=eq.${proposal.project_id}&limit=1`);
      if (existing.length > 0) {
        toast.info('This project is already in the repository.');
        return;
      }

      const [project] = await selectRows<ProjectRow>('projects', `select=id,title,project_type,requirements_text&id=eq.${proposal.project_id}`);
      const [costEstimate] = await selectRows<CostEstimateRow>('cost_estimations', `select=total_cost&project_id=eq.${proposal.project_id}&order=created_at.desc&limit=1`);
      const generatedContent = proposal.generated_content ?? {};
      const techText = String(generatedContent['tech-stack'] ?? generatedContent.technical ?? '');
      const technologies = techText
        .split(/\r?\n|,|;|\u2022|-/)
        .map((item) => item.trim())
        .filter((item) => item.length > 2 && item.length < 40)
        .slice(0, 12);

      await insertRow('project_repository', {
        project_id: proposal.project_id,
        project_title: project?.title ?? proposal.title.replace(/\s+Proposal$/i, ''),
        project_type: project?.project_type ?? proposal.template_name ?? null,
        technologies,
        estimated_cost: costEstimate?.total_cost ?? null,
        outcome: `Proposal ${formatStatus(proposal.status).toLowerCase()}`,
        lessons_learned: [
          `Created from proposal: ${proposal.title}`,
          `Template: ${proposal.template_name || 'Not set'}`,
          project?.requirements_text ? `Requirements:\n${project.requirements_text}` : '',
        ].filter(Boolean).join('\n\n'),
      });
      await updateRows('projects', `id=eq.${proposal.project_id}`, { status: 'archived' }).catch(() => undefined);
      setArchivedProjectIds((current) => new Set([...current, proposal.project_id]));
      toast.success('Project archived to repository.');
    } catch (error) {
      toast.error('Unable to archive this proposal into the repository.');
      console.warn(error);
    }
  };

  const filteredProposals = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return proposals;
    return proposals.filter((proposal) =>
      [proposal.title, proposal.status, proposal.template_name].filter(Boolean).some((field) => String(field).toLowerCase().includes(value))
    );
  }, [proposals, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Proposals</h1>
          <p className="text-gray-600 mt-1">Proposal records</p>
        </div>
        {canCreate && (
          <Link to="/proposals/new" aria-label="New Proposal" className="shrink-0">
            <Button variant="primary" size="lg" className="h-12 w-12 px-0 sm:w-auto sm:px-6">
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">New Proposal</span>
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search proposals..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-600">Loading proposals...</CardContent>
        </Card>
      ) : filteredProposals.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-400" />
            <h2 className="mt-3 font-semibold text-gray-900">No proposals found</h2>
            <p className="mt-1 text-sm text-gray-600">Generate and save a proposal to populate this list.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProposals.map((proposal) => (
            <Card key={proposal.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="w-8 h-8 text-sky-700" />
                  <Badge
                    variant={
                      proposal.status === 'approved' || proposal.status === 'accepted'
                        ? 'success'
                        : proposal.status === 'in_review'
                        ? 'warning'
                        : proposal.status === 'sent'
                        ? 'info'
                        : 'default'
                    }
                  >
                    {formatStatus(proposal.status)}
                  </Badge>
                </div>
                <CardTitle className="mt-4">{proposal.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>Template: {proposal.template_name || 'Not set'}</p>
                  <p>Version: {proposal.version}</p>
                  <p>Date: {new Date(proposal.created_at).toLocaleDateString()}</p>
                </div>
                <Link to={`/proposals/${proposal.id}`} className="block">
                  <Button variant="outline" className="w-full">
                    View Details
                  </Button>
                </Link>
                {(canUpdate || canDelete) && (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 pt-1">
                    {canUpdate && (
                      <select
                        value={proposal.status}
                        onChange={(event) => changeStatus(proposal, event.target.value as ProposalRow['status'])}
                        className="h-10 min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="draft">Draft</option>
                        <option value="in_review">In Review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="declined">Declined</option>
                      </select>
                    )}
                    {canDelete && (
                      <Button variant="danger" size="sm" onClick={() => deleteProposal(proposal)} aria-label="Delete Proposal" className="h-10 w-10 px-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                {['approved', 'accepted', 'sent'].includes(proposal.status) && !archivedProjectIds.has(proposal.project_id) && (
                  <Button variant="outline" className="w-full" onClick={() => archiveProposal(proposal)}>
                    <Archive className="h-4 w-4" />
                    Archive to Repository
                  </Button>
                )}
                {['approved', 'accepted', 'sent'].includes(proposal.status) && archivedProjectIds.has(proposal.project_id) && (
                  <Badge variant="success" className="justify-center py-2">Archived in Repository</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
