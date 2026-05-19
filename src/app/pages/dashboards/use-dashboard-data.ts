import { useEffect, useMemo, useState } from 'react';
import { selectRows } from '../../../lib/supabase';

export type DashboardProject = {
  id: string;
  title: string;
  status: string;
  project_type?: string | null;
  created_at: string;
};

export type DashboardProposal = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export function useDashboardData() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [proposals, setProposals] = useState<DashboardProposal[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projectRows, proposalRows, clientRows] = await Promise.all([
          selectRows<DashboardProject>('projects', 'select=id,title,status,project_type,created_at&order=created_at.desc'),
          selectRows<DashboardProposal>('proposals', 'select=id,title,status,created_at&order=created_at.desc'),
          selectRows<any>('clients', 'select=id,company_name,created_at&order=created_at.desc'),
        ]);
        setProjects(projectRows);
        setProposals(proposalRows);
        setClients(clientRows);
      } catch (error) {
        console.warn('Unable to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const stats = useMemo(
    () => ({
      projects: projects.length,
      activeProjects: projects.filter((project) => !['won', 'lost', 'archived'].includes(project.status)).length,
      proposals: proposals.length,
      clients: clients.length,
      approvedProposals: proposals.filter((proposal) => ['approved', 'accepted', 'sent'].includes(proposal.status)).length,
    }),
    [clients.length, projects, proposals]
  );

  return { projects, proposals, clients, stats, loading };
}
