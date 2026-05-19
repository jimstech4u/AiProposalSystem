import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Server, Users, Database, Activity, CheckCircle2 } from 'lucide-react';
import { useDashboardData } from './use-dashboard-data';

export default function AdminDashboard() {
  const { stats, projects, proposals, clients, loading } = useDashboardData();
  const systemHealth = [
    { name: 'Supabase API', status: 'Configured', icon: Server },
    { name: 'Database', status: 'RLS Enabled', icon: Database },
    { name: 'Gemini Integration', status: 'Configured', icon: Activity },
    { name: 'Authentication', status: 'Active', icon: CheckCircle2 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Administrator Dashboard</h1>
        <p className="text-gray-600 mt-1">System overview using live application records.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemHealth.map((system) => {
              const Icon = system.icon;
              return (
                <div key={system.name} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between mb-3">
                    <Icon className="w-6 h-6 text-slate-700" />
                    <Badge variant="success">{system.status}</Badge>
                  </div>
                  <p className="font-medium text-gray-900">{system.name}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Projects', value: stats.projects },
          { label: 'Active Projects', value: stats.activeProjects },
          { label: 'Proposals', value: stats.proposals },
          { label: 'Clients', value: stats.clients },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent System Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-600">Loading activity...</p>
          ) : projects.length + proposals.length + clients.length === 0 ? (
            <p className="text-sm text-gray-600">No records exist yet. Activity will appear after users create projects, clients, and proposals.</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 3).map((project) => (
                <div key={project.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                  <Users className="w-5 h-5 text-slate-700 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Project created: {project.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{new Date(project.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
