import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      if (!id) return;
      try {
        const [row] = await selectRows<RepositoryRow>('project_repository', `select=*&id=eq.${id}`);
        setProject(row ?? null);
      } catch (error) {
        console.warn('Unable to load repository project:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading project record...</div>;
  if (!project) return <div className="p-6 text-sm text-gray-600">Project record was not found.</div>;

  const variance =
    project.estimated_cost && project.actual_cost
      ? ((project.actual_cost - project.estimated_cost) / project.estimated_cost) * 100
      : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{project.project_title}</h1>
        <p className="text-gray-600 mt-1">Archived {new Date(project.archived_at).toLocaleDateString()}</p>
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
    </div>
  );
}
