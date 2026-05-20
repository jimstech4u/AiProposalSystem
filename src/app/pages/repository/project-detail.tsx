import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { selectRows } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/format';

type RepositoryRow = {
  id: string;
  project_title: string;
  project_type?: string | null;
  technologies?: string[] | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  estimated_weeks?: number | null;
  actual_weeks?: number | null;
  outcome?: string | null;
  lessons_learned?: string | null;
  archived_at: string;
};

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<RepositoryRow | null>(null);
  const [similarProjects, setSimilarProjects] = useState<RepositoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      if (!id) return;
      try {
        const [row] = await selectRows<RepositoryRow>('project_repository', `select=*&id=eq.${id}`);
        setProject(row ?? null);
        if (row) {
          const rows = await selectRows<RepositoryRow>('project_repository', 'select=*&order=archived_at.desc');
          const sourceTech = new Set((row.technologies ?? []).map((item) => item.toLowerCase()));
          const matches = rows
            .filter((candidate) => candidate.id !== row.id)
            .map((candidate) => {
              const candidateTech = candidate.technologies ?? [];
              const overlap = candidateTech.filter((item) => sourceTech.has(item.toLowerCase())).length;
              const typeMatch = row.project_type && candidate.project_type === row.project_type ? 1 : 0;
              return { candidate, score: overlap + typeMatch };
            })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((item) => item.candidate);
          setSimilarProjects(matches);
        }
      } catch (error) {
        console.warn('Unable to load repository project:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <Link to="/repository" className="mb-4 inline-flex">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Repository
          </Button>
        </Link>
        <p className="text-sm text-gray-600">Loading project record...</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="p-6">
        <Link to="/repository" className="mb-4 inline-flex">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Repository
          </Button>
        </Link>
        <p className="text-sm text-gray-600">Project record was not found.</p>
      </div>
    );
  }

  const variance =
    project.estimated_cost && project.actual_cost
      ? ((project.actual_cost - project.estimated_cost) / project.estimated_cost) * 100
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">{project.project_title}</h1>
          <p className="text-gray-600 mt-1">Archived {new Date(project.archived_at).toLocaleDateString()}</p>
        </div>
        <Link to="/repository" aria-label="Back to Repository" className="shrink-0">
          <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Estimated Cost</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(project.estimated_cost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Actual Cost</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{project.actual_cost == null ? 'Not recorded' : formatCurrency(project.actual_cost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Cost Variance</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{variance == null ? 'Not available' : `${variance.toFixed(1)}%`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Duration</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{project.actual_weeks ?? project.estimated_weeks ?? 'Not set'} weeks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Project Type</p>
              <p className="font-medium text-gray-900 mt-1">{project.project_type || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Outcome</p>
              <p className="font-medium text-gray-900 mt-1">{project.outcome || 'Not recorded'}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Technologies</p>
            <div className="flex flex-wrap gap-2">
              {(project.technologies ?? []).length === 0 ? (
                <span className="text-sm text-gray-600">No technologies recorded.</span>
              ) : (
                project.technologies?.map((technology) => <Badge key={technology}>{technology}</Badge>)
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Lessons Learned</p>
            <p className="text-gray-700 whitespace-pre-line">{project.lessons_learned || 'No lessons learned were recorded.'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Similar Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {similarProjects.length === 0 ? (
            <p className="text-sm text-gray-600">No similar repository records found by project type or technology overlap.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {similarProjects.map((item) => (
                <Link key={item.id} to={`/repository/${item.id}`} className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                  <p className="font-medium text-gray-900">{item.project_title}</p>
                  <p className="mt-1 text-sm text-gray-600">{item.project_type || 'Type not set'}</p>
                  <p className="mt-2 text-xs text-gray-500">{(item.technologies ?? []).slice(0, 4).join(', ') || 'No technologies recorded'}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
