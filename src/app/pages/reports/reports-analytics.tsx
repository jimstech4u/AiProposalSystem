import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Download, Pencil, Plus, Trash2, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardData } from '../dashboards/use-dashboard-data';
import { deleteRows, insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { can, getStoredRole, getStoredSession } from '../../../lib/permissions';
import { downloadTextFile, toReport } from '../../../lib/export';
import { toast } from 'sonner';

type ReportConfig = {
  id: string;
  name: string;
  description?: string | null;
  report_type: string;
  filters: Record<string, unknown>;
  schedule?: string | null;
  recipients?: string[] | null;
  created_at: string;
  updated_at?: string | null;
};

const emptyForm = {
  name: '',
  description: '',
  report_type: 'proposal_status',
  filters: '{\n  "dateRange": "all"\n}',
  schedule: '',
  recipients: '',
};

function parseJson(value: string) {
  return value.trim() ? JSON.parse(value) : {};
}

export default function ReportsAnalytics() {
  const { projects, proposals, clients, stats, loading } = useDashboardData();
  const [reports, setReports] = useState<ReportConfig[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReportConfig | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const role = getStoredRole();
  const session = getStoredSession();
  const canCreate = can(role, 'reports', 'create');
  const canUpdate = can(role, 'reports', 'update');
  const canDelete = can(role, 'reports', 'delete');

  async function loadReports() {
    try {
      const rows = await selectRows<ReportConfig>('report_configs', 'select=*&order=created_at.desc');
      setReports(rows);
    } catch (error) {
      console.warn('Unable to load report configs:', error);
    } finally {
      setReportsLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const statusData = Object.entries(
    proposals.reduce<Record<string, number>>((acc, proposal) => {
      acc[proposal.status] = (acc[proposal.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, total]) => ({ name, total }));

  const projectTypeData = useMemo(() => {
    return Object.entries(
      projects.reduce<Record<string, number>>((acc, project) => {
        const key = project.project_type || 'Unspecified';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([name, total]) => ({ name, total }));
  }, [projects]);

  const exportCurrentReport = () => {
    downloadTextFile(
      'proposalai-analytics-report.txt',
      toReport('ProposalAI Analytics Report', [
        { heading: 'Summary', body: `Projects: ${stats.projects}\nActive Projects: ${stats.activeProjects}\nProposals: ${stats.proposals}\nClients: ${stats.clients}` },
        { heading: 'Proposal Status', body: statusData.map((item) => `- ${item.name}: ${item.total}`).join('\n') || 'No proposal status data.' },
        { heading: 'Project Types', body: projectTypeData.map((item) => `- ${item.name}: ${item.total}`).join('\n') || 'No project type data.' },
      ])
    );
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (report: ReportConfig) => {
    setEditing(report);
    setForm({
      name: report.name,
      description: report.description ?? '',
      report_type: report.report_type,
      filters: JSON.stringify(report.filters ?? {}, null, 2),
      schedule: report.schedule ?? '',
      recipients: (report.recipients ?? []).join(', '),
    });
    setFormOpen(true);
  };

  const saveReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        report_type: form.report_type,
        filters: parseJson(form.filters),
        schedule: form.schedule.trim() || null,
        recipients: form.recipients.split(',').map((recipient) => recipient.trim()).filter(Boolean),
        created_by: session?.userId ?? null,
      };

      if (editing) {
        await updateRows('report_configs', `id=eq.${editing.id}`, payload);
        toast.success('Report configuration updated.');
      } else {
        await insertRow('report_configs', payload);
        toast.success('Report configuration created.');
      }
      setFormOpen(false);
      await loadReports();
    } catch (error) {
      toast.error(error instanceof SyntaxError ? 'Report filters must be valid JSON.' : 'Report save failed.');
      console.warn(error);
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (report: ReportConfig) => {
    if (!window.confirm(`Delete report configuration "${report.name}"?`)) return;
    try {
      await deleteRows('report_configs', `id=eq.${report.id}`);
      toast.success('Report configuration deleted.');
      await loadReports();
    } catch (error) {
      toast.error('Report delete failed.');
      console.warn(error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Metrics and saved report configurations calculated from Supabase records.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportCurrentReport}>
            <Download className="w-4 h-4" />
            Export Analytics
          </Button>
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              New Report
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Projects', value: stats.projects },
          { label: 'Active Projects', value: stats.activeProjects },
          { label: 'Proposals', value: stats.proposals },
          { label: 'Clients', value: stats.clients },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{metric.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>
              <p className="text-sm text-slate-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Live count
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Proposal Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-600">Loading analytics...</p>
            ) : statusData.length === 0 ? (
              <p className="text-sm text-gray-600">No proposal data is available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0369a1" name="Proposals" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-600">Loading records...</p>
            ) : projectTypeData.length === 0 ? (
              <p className="text-sm text-gray-600">No project records exist yet for reporting.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0f766e" name="Projects" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Report Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <p className="text-sm text-gray-600">Loading saved reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-600">No saved report configurations found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Report</th>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Type</th>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Schedule</th>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Recipients</th>
                    {(canUpdate || canDelete) && <th className="py-3 px-4 text-right font-medium text-gray-700">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{report.name}</p>
                        <p className="text-sm text-gray-600">{report.description || 'No description.'}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{report.report_type}</td>
                      <td className="py-3 px-4 text-gray-700">{report.schedule || 'Manual'}</td>
                      <td className="py-3 px-4 text-gray-700">{report.recipients?.length ?? 0}</td>
                      {(canUpdate || canDelete) && (
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            {canUpdate && (
                              <Button variant="outline" size="sm" onClick={() => openEdit(report)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="danger" size="sm" onClick={() => deleteReport(report)}>
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
          <form onSubmit={saveReport} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editing ? 'Edit Report' : 'New Report'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-md p-2 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Name *
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Report Type
                <select value={form.report_type} onChange={(event) => setForm({ ...form, report_type: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="proposal_status">Proposal Status</option>
                  <option value="win_loss">Win/Loss</option>
                  <option value="client_activity">Client Activity</option>
                  <option value="estimation_accuracy">Estimation Accuracy</option>
                  <option value="technology_usage">Technology Usage</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                Description
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Schedule
                <input value={form.schedule} onChange={(event) => setForm({ ...form, schedule: event.target.value })} placeholder="Weekly Monday 09:00" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Recipients
                <input value={form.recipients} onChange={(event) => setForm({ ...form, recipients: event.target.value })} placeholder="admin@example.com, pm@example.com" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                JSON Filters
                <textarea value={form.filters} onChange={(event) => setForm({ ...form, filters: event.target.value })} className="min-h-40 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Report'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
