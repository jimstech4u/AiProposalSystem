import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Plug, Plus, Search, Settings, Trash2, X, XCircle, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { deleteRows, insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { can, getStoredRole, getStoredSession } from '../../../lib/permissions';
import { toast } from 'sonner';

type IntegrationRow = {
  id: string;
  provider: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  config?: Record<string, unknown> | null;
  sync_schedule?: string | null;
  last_sync_at?: string | null;
  created_at: string;
};

const emptyForm = {
  provider: '',
  category: 'CRM',
  status: 'disconnected' as IntegrationRow['status'],
  sync_schedule: '',
  config: '{\n  "endpoint": "",\n  "api_key_reference": "",\n  "api_key": ""\n}',
};

function parseConfig(config: string) {
  if (!config.trim()) return {};
  return JSON.parse(config);
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const role = getStoredRole();
  const session = getStoredSession();
  const canCreate = can(role, 'integrations', 'create');
  const canUpdate = can(role, 'integrations', 'update');
  const canDelete = can(role, 'integrations', 'delete');

  async function loadIntegrations() {
    try {
      const rows = await selectRows<IntegrationRow>('integrations', 'select=*&order=created_at.desc');
      setIntegrations(rows);
    } catch (error) {
      console.warn('Unable to load integrations:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntegrations();
  }, []);

  const statusCounts = useMemo(
    () => ({
      connected: integrations.filter((integration) => integration.status === 'connected').length,
      disconnected: integrations.filter((integration) => integration.status === 'disconnected').length,
      error: integrations.filter((integration) => integration.status === 'error').length,
    }),
    [integrations]
  );
  const filteredIntegrations = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return integrations;

    return integrations.filter((integration) =>
      [
        integration.provider,
        integration.category,
        integration.status,
        integration.sync_schedule,
        JSON.stringify(integration.config ?? {}),
      ].filter(Boolean).some((field) => String(field).toLowerCase().includes(value))
    );
  }, [integrations, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (integration: IntegrationRow) => {
    setEditing(integration);
    setForm({
      provider: integration.provider ?? '',
      category: integration.category ?? 'CRM',
      status: integration.status ?? 'disconnected',
      sync_schedule: integration.sync_schedule ?? '',
      config: JSON.stringify(integration.config ?? {}, null, 2),
    });
    setFormOpen(true);
  };

  const saveIntegration = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        provider: form.provider.trim(),
        category: form.category.trim(),
        status: form.status,
        sync_schedule: form.sync_schedule.trim() || null,
        config: parseConfig(form.config),
        created_by: session?.userId ?? null,
      };

      if (editing) {
        await updateRows('integrations', `id=eq.${editing.id}`, payload);
        toast.success('Integration updated.');
      } else {
        await insertRow('integrations', payload);
        toast.success('Integration created.');
      }
      setFormOpen(false);
      await loadIntegrations();
    } catch (error) {
      toast.error(error instanceof SyntaxError ? 'Integration config must be valid JSON.' : 'Integration save failed.');
      console.warn(error);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (integration: IntegrationRow, status: IntegrationRow['status']) => {
    try {
      await updateRows('integrations', `id=eq.${integration.id}`, {
        status,
        last_sync_at: status === 'connected' ? new Date().toISOString() : integration.last_sync_at,
      });
      toast.success('Integration status updated.');
      await loadIntegrations();
    } catch (error) {
      toast.error('Integration status update failed.');
      console.warn(error);
    }
  };

  const testConnection = async (integration: IntegrationRow) => {
    const config = integration.config ?? {};
    const endpoint = String(config.endpoint ?? '').trim();

    if (!endpoint) {
      toast.error('Add an endpoint URL before testing this integration.');
      return;
    }

    try {
      await updateRows('integrations', `id=eq.${integration.id}`, { status: 'syncing' });
      setIntegrations((current) => current.map((item) => item.id === integration.id ? { ...item, status: 'syncing' } : item));
      const token = String(config.api_key ?? config.token ?? '').trim();
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const nextStatus = response.ok ? 'connected' : 'error';
      await updateRows('integrations', `id=eq.${integration.id}`, {
        status: nextStatus,
        last_sync_at: new Date().toISOString(),
      });
      toast[response.ok ? 'success' : 'error'](response.ok ? 'Connection test passed.' : `Connection test failed with HTTP ${response.status}.`);
      await loadIntegrations();
    } catch (error) {
      await updateRows('integrations', `id=eq.${integration.id}`, { status: 'error' }).catch(() => undefined);
      setIntegrations((current) => current.map((item) => item.id === integration.id ? { ...item, status: 'error' } : item));
      toast.error('Connection test failed. Check the endpoint, credentials, and CORS settings.');
      console.warn(error);
    }
  };

  const deleteIntegration = async (integration: IntegrationRow) => {
    if (!window.confirm(`Delete ${integration.provider} integration?`)) return;
    try {
      await deleteRows('integrations', `id=eq.${integration.id}`);
      toast.success('Integration deleted.');
      await loadIntegrations();
    } catch (error) {
      toast.error('Integration delete failed.');
      console.warn(error);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Integrations & API</h1>
          <p className="text-gray-600 mt-1">Manage real integration records and connection settings.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} aria-label="New Integration" className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Integration</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="p-6">
          <p className="text-sm text-gray-600">Connected</p>
          <p className="mt-2 text-3xl font-bold text-green-700">{statusCounts.connected}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Disconnected</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{statusCounts.disconnected}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Errors</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{statusCounts.error}</p>
        </Card>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search integrations..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-gray-600">Loading integrations...</Card>
      ) : integrations.length === 0 ? (
        <Card className="p-10 text-center">
          <Plug className="mx-auto h-10 w-10 text-gray-400" />
          <h2 className="mt-3 font-semibold text-gray-900">No integrations configured</h2>
          <p className="mt-1 text-sm text-gray-600">Create integration records for CRM, project management, accounting, calendar, email, or webhook services.</p>
        </Card>
      ) : filteredIntegrations.length === 0 ? (
        <Card className="p-10 text-center">
          <Plug className="mx-auto h-10 w-10 text-gray-400" />
          <h2 className="mt-3 font-semibold text-gray-900">No integrations match your search</h2>
          <p className="mt-1 text-sm text-gray-600">Try a provider, category, status, schedule, or config value.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => (
            <Card key={integration.id} className="p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                  <Plug className="h-6 w-6 text-slate-700" />
                </div>
                <Badge variant={integration.status === 'connected' ? 'success' : integration.status === 'error' ? 'danger' : 'secondary'}>
                  {integration.status === 'connected' ? (
                    <><CheckCircle className="w-3 h-3 mr-1" />Connected</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" />{integration.status}</>
                  )}
                </Badge>
              </div>

              <h3 className="text-lg font-semibold text-gray-900">{integration.provider}</h3>
              <p className="mt-1 text-sm text-gray-600">{integration.category}</p>
              <div className="my-4 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Sync schedule</span>
                  <span className="font-medium">{integration.sync_schedule || 'Manual'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last sync</span>
                  <span className="font-medium">{integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : 'Never'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canUpdate && (
                  <Button
                    variant={integration.status === 'connected' ? 'outline' : 'primary'}
                    size="sm"
                    className="flex-1"
                    onClick={() => updateStatus(integration, integration.status === 'connected' ? 'disconnected' : 'connected')}
                  >
                    {integration.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </Button>
                )}
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => openEdit(integration)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => testConnection(integration)}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button variant="danger" size="sm" onClick={() => deleteIntegration(integration)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveIntegration} className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:max-h-[90vh] sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editing ? 'Edit Integration' : 'New Integration'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-md p-2 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Provider *
                <input required value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Category *
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  <option>CRM</option>
                  <option>Project Management</option>
                  <option>Accounting</option>
                  <option>Calendar</option>
                  <option>Email</option>
                  <option>Webhook</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as IntegrationRow['status'] })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="connected">Connected</option>
                  <option value="disconnected">Disconnected</option>
                  <option value="syncing">Syncing</option>
                  <option value="error">Error</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Sync Schedule
                <input value={form.sync_schedule} onChange={(event) => setForm({ ...form, sync_schedule: event.target.value })} placeholder="Daily, weekly, manual" className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                JSON Config
                <textarea value={form.config} onChange={(event) => setForm({ ...form, config: event.target.value })} className="min-h-56 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save Integration'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
