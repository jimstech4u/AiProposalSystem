import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Search, Users, Building2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { deleteRows, insertRow, isJwtExpired, selectRows, updateRows } from '../../../lib/supabase';
import { can, getStoredRole, getStoredSession } from '../../../lib/permissions';
import { toast } from 'sonner';

type ClientRow = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  industry?: string | null;
  segment?: string | null;
  rating?: number | null;
};

const emptyForm = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  industry: '',
  segment: '',
  address: '',
  notes: '',
  rating: '',
};

export default function ClientDirectory() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const role = getStoredRole();
  const session = getStoredSession();
  const canCreate = can(role, 'clients', 'create');
  const canUpdate = can(role, 'clients', 'update');
  const canDelete = can(role, 'clients', 'delete');

  async function loadClients() {
      if (!session?.accessToken || isJwtExpired(session.accessToken)) {
        setClients([]);
        setLoading(false);
        toast.error('Your Supabase session expired. Sign in again to load client records.');
        return;
      }

      try {
        const rows = await selectRows<ClientRow>('clients', 'select=*&order=created_at.desc');
        setClients(rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Supabase error.';
        toast.error(message.includes('JWT') || message.includes('401') ? 'Your Supabase session is invalid. Sign in again.' : 'Unable to load clients from Supabase. Check your session and client read permissions.');
        console.warn('Unable to load clients:', error);
      } finally {
        setLoading(false);
      }
    }

  useEffect(() => {
    loadClients();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (client: ClientRow) => {
    setEditing(client);
    setForm({
      company_name: client.company_name ?? '',
      contact_name: client.contact_name ?? '',
      contact_email: client.contact_email ?? '',
      contact_phone: client.contact_phone ?? '',
      industry: client.industry ?? '',
      segment: client.segment ?? '',
      address: (client as any).address ?? '',
      notes: (client as any).notes ?? '',
      rating: client.rating == null ? '' : String(client.rating),
    });
    setFormOpen(true);
  };

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      industry: form.industry.trim() || null,
      segment: form.segment.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      rating: form.rating === '' ? null : Number(form.rating),
    };

    try {
      if (editing) {
        await updateRows('clients', `id=eq.${editing.id}`, payload);
        toast.success('Client updated.');
      } else {
        await insertRow('clients', { ...payload, created_by: session?.userId ?? null });
        toast.success('Client created.');
      }
      setFormOpen(false);
      await loadClients();
    } catch (error) {
      toast.error('Client save failed. Check your role permissions.');
      console.warn(error);
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (client: ClientRow) => {
    if (!window.confirm(`Delete ${client.company_name}?`)) return;

    try {
      await deleteRows('clients', `id=eq.${client.id}`);
      toast.success('Client deleted.');
      await loadClients();
    } catch (error) {
      toast.error('Client delete failed. Check your role permissions.');
      console.warn(error);
    }
  };

  const filteredClients = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return clients;

    return clients.filter((client) =>
      [client.company_name, client.contact_name, client.contact_email, client.industry, client.segment]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [clients, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Client Directory</h1>
          <p className="text-gray-600 mt-1">Client records</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} aria-label="New Client" className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Client</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Total Clients</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{clients.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Rated Clients</p>
            <p className="text-3xl font-bold text-sky-700 mt-2">{clients.filter((client) => client.rating != null).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Industries</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{new Set(clients.map((client) => client.industry).filter(Boolean)).size}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-600">Loading clients...</CardContent>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="mx-auto h-10 w-10 text-gray-400" />
            <h2 className="mt-3 font-semibold text-gray-900">No clients found</h2>
            <p className="mt-1 text-sm text-gray-600">Create client records here or through the requirement intake flow.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    {client.company_name.charAt(0)}
                  </div>
                  <Badge variant="default">{client.segment || 'Client'}</Badge>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-1">{client.company_name}</h3>
                <p className="text-sm text-gray-600 mb-3">{client.industry || 'Industry not set'}</p>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{client.contact_name || 'No contact person set'}</span>
                  </div>
                  <p className="text-gray-600">{client.contact_email || 'No email set'}</p>
                  <p className="text-gray-600">{client.contact_phone || 'No phone set'}</p>
                </div>

                <Link to={`/clients/${client.id}`}>
                  <Button variant="outline" className="w-full">
                    View Profile
                  </Button>
                </Link>
                <div className="mt-2 flex gap-2">
                  {canUpdate && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(client)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="danger" size="sm" className="flex-1" onClick={() => deleteClient(client)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveClient} className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:max-h-[90vh] sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editing ? 'Edit Client' : 'New Client'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-md p-2 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Company Name *
                <input required value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Primary Contact
                <input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Email
                <input type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Phone
                <input value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Industry
                <input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Segment
                <input value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Rating
                <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => setForm({ ...form, rating: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                Address
                <textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                Notes
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save Client'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
