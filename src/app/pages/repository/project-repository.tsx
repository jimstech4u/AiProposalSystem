import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Search, FolderOpen, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { deleteRows, insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { can, getStoredRole } from '../../../lib/permissions';
import { toast } from 'sonner';
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
  archived_at: string;
};

const emptyForm = {
  project_title: '',
  project_type: '',
  technologies: '',
  estimated_cost: '',
  actual_cost: '',
  estimated_weeks: '',
  actual_weeks: '',
  outcome: '',
  lessons_learned: '',
};

export default function ProjectRepository() {
  const [projects, setProjects] = useState<RepositoryRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RepositoryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const role = getStoredRole();
  const canCreate = can(role, 'repository', 'create');
  const canUpdate = can(role, 'repository', 'update');
  const canDelete = can(role, 'repository', 'delete');

  async function loadProjects() {
      try {
        const rows = await selectRows<RepositoryRow>('project_repository', 'select=*&order=archived_at.desc');
        setProjects(rows);
      } catch (error) {
        console.warn('Unable to load repository:', error);
      } finally {
        setLoading(false);
      }
    }

  useEffect(() => {
    loadProjects();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (project: RepositoryRow) => {
    setEditing(project);
    setForm({
      project_title: project.project_title ?? '',
      project_type: project.project_type ?? '',
      technologies: (project.technologies ?? []).join(', '),
      estimated_cost: project.estimated_cost == null ? '' : String(project.estimated_cost),
      actual_cost: project.actual_cost == null ? '' : String(project.actual_cost),
      estimated_weeks: project.estimated_weeks == null ? '' : String(project.estimated_weeks),
      actual_weeks: project.actual_weeks == null ? '' : String(project.actual_weeks),
      outcome: project.outcome ?? '',
      lessons_learned: (project as any).lessons_learned ?? '',
    });
    setFormOpen(true);
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      project_title: form.project_title.trim(),
      project_type: form.project_type.trim() || null,
      technologies: form.technologies.split(',').map((item) => item.trim()).filter(Boolean),
      estimated_cost: form.estimated_cost === '' ? null : Number(form.estimated_cost),
      actual_cost: form.actual_cost === '' ? null : Number(form.actual_cost),
      estimated_weeks: form.estimated_weeks === '' ? null : Number(form.estimated_weeks),
      actual_weeks: form.actual_weeks === '' ? null : Number(form.actual_weeks),
      outcome: form.outcome.trim() || null,
      lessons_learned: form.lessons_learned.trim() || null,
    };

    try {
      if (editing) {
        await updateRows('project_repository', `id=eq.${editing.id}`, payload);
        toast.success('Repository record updated.');
      } else {
        await insertRow('project_repository', payload);
        toast.success('Repository record created.');
      }
      setFormOpen(false);
      await loadProjects();
    } catch (error) {
      toast.error('Repository save failed. Check your role permissions.');
      console.warn(error);
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (project: RepositoryRow) => {
    if (!window.confirm(`Delete repository record "${project.project_title}"?`)) return;
    try {
      await deleteRows('project_repository', `id=eq.${project.id}`);
      toast.success('Repository record deleted.');
      await loadProjects();
    } catch (error) {
      toast.error('Repository delete failed. Check your role permissions.');
      console.warn(error);
    }
  };

  const filteredProjects = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return projects;
    return projects.filter((project) =>
      [project.project_title, project.project_type, project.outcome, ...(project.technologies ?? [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [projects, search]);

  const completedProjects = projects.filter((project) => project.outcome).length;
  const totalEstimated = projects.reduce((sum, project) => sum + Number(project.estimated_cost || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Project Repository</h1>
          <p className="text-gray-600 mt-1">Historical project records</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} aria-label="New Record" className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Record</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Total Projects</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{projects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">With Outcomes</p>
            <p className="text-3xl font-bold text-sky-700 mt-2">{completedProjects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Estimated Value</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(totalEstimated)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-gray-600">Loading repository...</p>
          ) : filteredProjects.length === 0 ? (
            <div className="py-10 text-center">
              <FolderOpen className="mx-auto h-10 w-10 text-gray-400" />
              <h2 className="mt-3 font-semibold text-gray-900">No repository records found</h2>
              <p className="mt-1 text-sm text-gray-600">Archive completed projects to use the repository.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Est. Cost</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Actual Cost</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Duration</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Outcome</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Archived</th>
                    {(canUpdate || canDelete) && <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link to={`/repository/${project.id}`} className="font-medium text-sky-700 hover:text-sky-800">
                          {project.project_title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="default">{project.project_type || 'Not set'}</Badge>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-700">{formatCurrency(project.estimated_cost)}</td>
                      <td className="text-right py-3 px-4 text-gray-700">
                        {project.actual_cost == null ? 'Not recorded' : formatCurrency(project.actual_cost)}
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">
                        {project.actual_weeks ?? project.estimated_weeks ?? 'Not set'} weeks
                      </td>
                      <td className="py-3 px-4 text-gray-700">{project.outcome || 'Not recorded'}</td>
                      <td className="py-3 px-4 text-gray-700 text-sm">{new Date(project.archived_at).toLocaleDateString()}</td>
                      {(canUpdate || canDelete) && (
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            {canUpdate && (
                              <Button variant="outline" size="sm" onClick={() => openEdit(project)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="danger" size="sm" onClick={() => deleteProject(project)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveProject} className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:max-h-[90vh] sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editing ? 'Edit Repository Record' : 'New Repository Record'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-md p-2 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Project Title *
                <input required value={form.project_title} onChange={(event) => setForm({ ...form, project_title: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Project Type
                <input value={form.project_type} onChange={(event) => setForm({ ...form, project_type: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                Technologies
                <input value={form.technologies} onChange={(event) => setForm({ ...form, technologies: event.target.value })} placeholder="React, PostgreSQL, Node.js" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Estimated Cost
                <input type="number" min="0" value={form.estimated_cost} onChange={(event) => setForm({ ...form, estimated_cost: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Actual Cost
                <input type="number" min="0" value={form.actual_cost} onChange={(event) => setForm({ ...form, actual_cost: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Estimated Weeks
                <input type="number" min="0" value={form.estimated_weeks} onChange={(event) => setForm({ ...form, estimated_weeks: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Actual Weeks
                <input type="number" min="0" value={form.actual_weeks} onChange={(event) => setForm({ ...form, actual_weeks: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Outcome
                <input value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                Lessons Learned
                <textarea value={form.lessons_learned} onChange={(event) => setForm({ ...form, lessons_learned: event.target.value })} className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save Record'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
