import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { deleteRows, insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { can, getStoredRole, getStoredSession } from '../../../lib/permissions';
import { downloadTextFile, toReport } from '../../../lib/export';
import { toast } from 'sonner';

type TemplateRow = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  sections?: string[] | null;
  placeholders?: Record<string, string> | null;
  version: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

const emptyForm = {
  name: '',
  category: '',
  description: '',
  sections: 'Cover Page\nExecutive Summary\nProject Background\nScope and Objectives\nTechnical Approach\nSystem Architecture\nTimeline and Milestones\nCost Breakdown\nTerms and Conditions',
  placeholders: 'client_name=\nproject_name=\nprepared_by=',
  is_default: false,
};

function parsePlaceholders(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const [key, ...rest] = line.split('=');
      if (key.trim()) acc[key.trim()] = rest.join('=').trim();
      return acc;
    }, {});
}

function placeholdersToText(value?: Record<string, string> | null) {
  return Object.entries(value ?? {})
    .map(([key, entry]) => `${key}=${entry}`)
    .join('\n');
}

export default function TemplateManagementPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const role = getStoredRole();
  const session = getStoredSession();
  const canCreate = can(role, 'templates', 'create');
  const canUpdate = can(role, 'templates', 'update');
  const canDelete = can(role, 'templates', 'delete');

  async function loadTemplates() {
    try {
      const rows = await selectRows<TemplateRow>('proposal_templates', 'select=*&order=updated_at.desc');
      setTemplates(rows);
    } catch (error) {
      console.warn('Unable to load templates:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  const categories = useMemo(() => new Set(templates.map((template) => template.category).filter(Boolean)).size, [templates]);
  const filteredTemplates = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return templates;

    return templates.filter((template) =>
      [
        template.name,
        template.category,
        template.description,
        ...(template.sections ?? []),
        ...Object.keys(template.placeholders ?? {}),
      ].filter(Boolean).some((field) => String(field).toLowerCase().includes(value))
    );
  }, [search, templates]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (template: TemplateRow) => {
    setEditing(template);
    setForm({
      name: template.name ?? '',
      category: template.category ?? '',
      description: template.description ?? '',
      sections: (template.sections ?? []).join('\n'),
      placeholders: placeholdersToText(template.placeholders),
      is_default: template.is_default,
    });
    setFormOpen(true);
  };

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      sections: form.sections.split('\n').map((section) => section.trim()).filter(Boolean),
      placeholders: parsePlaceholders(form.placeholders),
      is_default: form.is_default,
      created_by: session?.userId ?? null,
    };

    try {
      if (editing) {
        await updateRows('proposal_templates', `id=eq.${editing.id}`, {
          ...payload,
          version: editing.version + 1,
        });
        toast.success('Template updated.');
      } else {
        await insertRow('proposal_templates', payload);
        toast.success('Template created.');
      }
      setFormOpen(false);
      await loadTemplates();
    } catch (error) {
      toast.error('Template save failed. Check your role permissions.');
      console.warn(error);
    } finally {
      setSaving(false);
    }
  };

  const duplicateTemplate = async (template: TemplateRow) => {
    try {
      await insertRow('proposal_templates', {
        name: `${template.name} Copy`,
        category: template.category,
        description: template.description,
        sections: template.sections ?? [],
        placeholders: template.placeholders ?? {},
        version: 1,
        is_default: false,
        created_by: session?.userId ?? null,
      });
      toast.success('Template duplicated.');
      await loadTemplates();
    } catch (error) {
      toast.error('Unable to duplicate template.');
      console.warn(error);
    }
  };

  const deleteTemplate = async (template: TemplateRow) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      await deleteRows('proposal_templates', `id=eq.${template.id}`);
      toast.success('Template deleted.');
      await loadTemplates();
    } catch (error) {
      toast.error('Template delete failed. Check your role permissions.');
      console.warn(error);
    }
  };

  const exportTemplate = (template: TemplateRow) => {
    downloadTextFile(
      `${template.name}.txt`,
      toReport(template.name, [
        { heading: 'Description', body: template.description || 'No description.' },
        { heading: 'Sections', body: (template.sections ?? []).map((section) => `- ${section}`).join('\n') },
        { heading: 'Placeholders', body: placeholdersToText(template.placeholders) || 'No placeholders.' },
      ])
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Template Management</h1>
          <p className="text-gray-600 mt-1">Create, edit, duplicate, export, and delete proposal templates.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} aria-label="New Template" className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Template</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="p-6">
          <p className="text-sm text-gray-600">Templates</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{templates.length}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Categories</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{categories}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Default Templates</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{templates.filter((template) => template.is_default).length}</p>
        </Card>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search templates..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-gray-600">Loading templates...</Card>
      ) : templates.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-400" />
          <h2 className="mt-3 font-semibold text-gray-900">No templates found</h2>
          <p className="mt-1 text-sm text-gray-600">Create the first proposal template to make proposal generation repeatable.</p>
        </Card>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-400" />
          <h2 className="mt-3 font-semibold text-gray-900">No templates match your search</h2>
          <p className="mt-1 text-sm text-gray-600">Try a different name, category, section, or placeholder.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-700" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {template.is_default && <Badge variant="success">Default</Badge>}
                  <Badge>{template.category || 'Uncategorized'}</Badge>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
              <p className="mt-2 min-h-10 text-sm text-gray-600">{template.description || 'No description provided.'}</p>

              <div className="my-4 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Sections</span>
                  <span className="font-medium">{template.sections?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="font-medium">{template.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Modified</span>
                  <span className="font-medium">{new Date(template.updated_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canUpdate && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(template)}>
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                )}
                {canCreate && (
                  <Button variant="outline" size="sm" onClick={() => duplicateTemplate(template)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => exportTemplate(template)}>
                  <Download className="w-4 h-4" />
                </Button>
                {canDelete && (
                  <Button variant="danger" size="sm" onClick={() => deleteTemplate(template)}>
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
          <form onSubmit={saveTemplate} className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:max-h-[90vh] sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editing ? 'Edit Template' : 'New Template'}</h2>
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
                Category
                <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
                Description
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Sections
                <textarea value={form.sections} onChange={(event) => setForm({ ...form, sections: event.target.value })} className="min-h-60 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Placeholders
                <textarea value={form.placeholders} onChange={(event) => setForm({ ...form, placeholders: event.target.value })} className="min-h-60 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.is_default} onChange={(event) => setForm({ ...form, is_default: event.target.checked })} />
                Default template
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
