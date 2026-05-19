import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FileText, Users, CheckCircle2, Plus } from 'lucide-react';
import { useDashboardData } from './use-dashboard-data';

export default function SalesDashboard() {
  const { stats, proposals, clients, loading } = useDashboardData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="text-gray-600 mt-1">Client and proposal activity.</p>
        </div>
        <Link to="/requirements/new">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            New Proposal
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Clients</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.clients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Proposals</p>
            <p className="text-3xl font-bold text-sky-700 mt-2">{stats.proposals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Approved or Sent</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.approvedProposals}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Proposal Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-600">Loading proposals...</p>
            ) : proposals.length === 0 ? (
              <p className="text-sm text-gray-600">No proposals have been saved yet.</p>
            ) : (
              <div className="space-y-3">
                {proposals.map((proposal) => (
                  <div key={proposal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{proposal.title}</p>
                      <p className="text-xs text-gray-500">{new Date(proposal.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="default">{proposal.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Recent Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-600">Loading clients...</p>
            ) : clients.length === 0 ? (
              <p className="text-sm text-gray-600">No client records found.</p>
            ) : (
              <div className="space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-slate-700" />
                    <p className="font-medium text-gray-900">{client.company_name}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
