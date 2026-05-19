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

export type DashboardIntegration = {
  id: string;
  provider: string;
  status: string;
};

type DashboardHealth = {
  projects: 'ok' | 'error';
  proposals: 'ok' | 'error';
  clients: 'ok' | 'error';
  integrations: 'ok' | 'error';
};

export function useDashboardData() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [proposals, setProposals] = useState<DashboardProposal[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<DashboardIntegration[]>([]);
  const [health, setHealth] = useState<DashboardHealth>({
    projects: 'error',
    proposals: 'error',
    clients: 'error',
    integrations: 'error',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projectResult, proposalResult, clientResult, integrationResult] = await Promise.allSettled([
          selectRows<DashboardProject>('projects', 'select=id,title,status,project_type,created_at&order=created_at.desc'),
          selectRows<DashboardProposal>('proposals', 'select=id,title,status,created_at&order=created_at.desc'),
          selectRows<any>('clients', 'select=id,company_name,created_at&order=created_at.desc'),
          selectRows<DashboardIntegration>('integrations', 'select=id,provider,status&order=created_at.desc'),
        ]);
        setProjects(projectResult.status === 'fulfilled' ? projectResult.value : []);
        setProposals(proposalResult.status === 'fulfilled' ? proposalResult.value : []);
        setClients(clientResult.status === 'fulfilled' ? clientResult.value : []);
        setIntegrations(integrationResult.status === 'fulfilled' ? integrationResult.value : []);
        setHealth({
          projects: projectResult.status === 'fulfilled' ? 'ok' : 'error',
          proposals: proposalResult.status === 'fulfilled' ? 'ok' : 'error',
          clients: clientResult.status === 'fulfilled' ? 'ok' : 'error',
          integrations: integrationResult.status === 'fulfilled' ? 'ok' : 'error',
        });
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
      connectedIntegrations: integrations.filter((integration) => integration.status === 'connected').length,
    }),
    [clients.length, integrations, projects, proposals]
  );

  return { projects, proposals, clients, integrations, stats, loading, health };
}
