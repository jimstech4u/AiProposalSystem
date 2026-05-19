import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FileText, DollarSign, Clock, Lightbulb, ArrowRight, Plus } from 'lucide-react';
import { useDashboardData } from './use-dashboard-data';

export default function EngineerDashboard() {
  const { projects, proposals, stats, loading } = useDashboardData();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Engineer Dashboard</h1>
        <p className="text-gray-600 mt-1">Live project and proposal activity.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link to="/requirements/new" aria-label="Analyze Requirements">
              <Button variant="primary" className="w-full justify-center px-0 sm:justify-start sm:px-6" size="lg">
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Analyze Requirements</span>
              </Button>
            </Link>
            <Link to="/proposals/new" aria-label="Generate Proposal">
              <Button variant="secondary" className="w-full justify-center px-0 sm:justify-start sm:px-6" size="lg">
                <FileText className="w-5 h-5" />
                <span className="hidden sm:inline">Generate Proposal</span>
              </Button>
            </Link>
            <Link to="/estimation" aria-label="Estimate Costs">
              <Button variant="secondary" className="w-full justify-center px-0 sm:justify-start sm:px-6" size="lg">
                <DollarSign className="w-5 h-5" />
                <span className="hidden sm:inline">Estimate Costs</span>
              </Button>
            </Link>
            <Link to="/technology" aria-label="Tech Recommendations">
              <Button variant="secondary" className="w-full justify-center px-0 sm:justify-start sm:px-6" size="lg">
                <Lightbulb className="w-5 h-5" />
                <span className="hidden sm:inline">Tech Recommendations</span>
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
