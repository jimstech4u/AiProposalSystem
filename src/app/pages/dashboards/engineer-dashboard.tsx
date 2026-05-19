import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FileText, DollarSign, Clock, Lightbulb, ArrowRight, Plus } from 'lucide-react';
import { useDashboardData } from './use-dashboard-data';

export default function EngineerDashboard() {
  const { projects, proposals, stats, loading } = useDashboardData();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Engineer Dashboard</h1>
        <p className="text-gray-600 mt-1">Live project and proposal activity.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/requirements/new">
              <Button variant="primary" className="w-full justify-start" size="lg">
                <Plus className="w-5 h-5" />
                Analyze Requirements
              </Button>
            </Link>
            <Link to="/proposals/new">
              <Button variant="secondary" className="w-full justify-start" size="lg">
                <FileText className="w-5 h-5" />
                Generate Proposal
              </Button>
            </Link>
            <Link to="/estimation">
              <Button variant="secondary" className="w-full justify-start" size="lg">
                <DollarSign className="w-5 h-5" />
                Estimate Costs
              </Button>
            </Link>
            <Link to="/technology">
              <Button variant="secondary" className="w-full justify-start" size="lg">
                <Lightbulb className="w-5 h-5" />
                Tech Recommendations
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Projects</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.projects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Active Projects</p>
            <p className="text-3xl font-bold text-sky-700 mt-2">{stats.activeProjects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Proposals</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.proposals}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Recent Projects</CardTitle>
            <Link to="/repository">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-600">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-600">No projects have been created yet.</p>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{project.title}</p>
                      <p className="text-sm text-gray-600">{project.project_type || 'Project type not set'}</p>
                    </div>
                    <Badge variant="info">{project.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-600">Loading proposals...</p>
            ) : proposals.length === 0 ? (
              <p className="text-sm text-gray-600">No proposals have been saved yet.</p>
            ) : (
              <div className="space-y-3">
                {proposals.map((proposal) => (
                  <div key={proposal.id} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-slate-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{proposal.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{proposal.status}</p>
                    </div>
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
