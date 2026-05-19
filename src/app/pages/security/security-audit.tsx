import { useEffect, useMemo, useState } from 'react';
import { Shield, FileText, Download, AlertTriangle, Check, X, UserCog, Trash2, Search } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { deleteRows, selectRows, updateRows, type AppRole } from '../../../lib/supabase';
import { downloadTextFile, toReport } from '../../../lib/export';
import { toast } from 'sonner';

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  created_at: string;
};

type UserProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  department?: string | null;
  job_title?: string | null;
  created_at: string;
};

const permissions = [
  { role: 'Engineer', create: true, edit: true, delete: false, approve: false },
  { role: 'Project Manager', create: true, edit: true, delete: true, approve: true },
  { role: 'Sales', create: true, edit: true, delete: false, approve: false },
  { role: 'Admin', create: true, edit: true, delete: true, approve: true },
];

function PermissionIcon({ allowed }: { allowed: boolean }) {
  return allowed ? <Check className="mx-auto h-4 w-4 text-green-700" /> : <X className="mx-auto h-4 w-4 text-red-700" />;
}

export default function SecurityAuditPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  async function loadAuditLogs() {
      try {
        const rows = await selectRows<AuditLog>('audit_logs', 'select=id,action,entity_type,entity_id,created_at&order=created_at.desc&limit=20');
        setAuditLogs(rows);
      } catch (error) {
        console.warn('Unable to load audit logs:', error);
      } finally {
        setLoading(false);
      }
    }

  async function loadUsers() {
    try {
      const rows = await selectRows<UserProfileRow>('user_profiles', 'select=id,email,full_name,role,is_active,department,job_title,created_at&order=created_at.desc');
      setUsers(rows);
    } catch (error) {
      console.warn('Unable to load users:', error);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadAuditLogs();
    loadUsers();
  }, []);

  const filteredAuditLogs = useMemo(() => {
    const value = auditSearch.toLowerCase().trim();
    if (!value) return auditLogs;

    return auditLogs.filter((log) =>
      [log.action, log.entity_type, log.entity_id, log.created_at]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [auditLogs, auditSearch]);

  const filteredUsers = useMemo(() => {
    const value = userSearch.toLowerCase().trim();
    if (!value) return users;

    return users.filter((user) =>
      [user.full_name, user.email, user.role, user.department, user.job_title, user.is_active ? 'active' : 'inactive']
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [users, userSearch]);

  const updateUser = async (user: UserProfileRow, changes: Partial<UserProfileRow>) => {
    try {
      await updateRows<UserProfileRow>('user_profiles', `id=eq.${user.id}`, changes);
      toast.success('User access updated.');
      await loadUsers();
    } catch (error) {
      toast.error('User access update failed.');
      console.warn(error);
    }
  };

  const exportAudit = () => {
    downloadTextFile(
      'audit-log.txt',
      toReport('ProposalAI Audit Log', [
        {
          heading: 'Recent Audit Records',
          body: auditLogs.map((log) => `${new Date(log.created_at).toISOString()} | ${log.action} | ${log.entity_type} | ${log.entity_id ?? ''}`).join('\n') || 'No audit records.',
        },
      ])
    );
  };

  const deleteAuditLog = async (log: AuditLog) => {
    if (!window.confirm('Delete this audit log entry?')) return;
    try {
      await deleteRows('audit_logs', `id=eq.${log.id}`);
      toast.success('Audit log entry deleted.');
      await loadAuditLogs();
    } catch (error) {
      toast.error('Audit log delete failed. Apply the updated admin RLS policy if needed.');
      console.warn(error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Security & Audit</h1>
        <p className="text-gray-600">Monitor database audit records and role permissions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Audit Records</p>
              <p className="text-2xl font-bold">{auditLogs.length}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-700" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">RLS Status</p>
              <p className="text-2xl font-bold">Enabled</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-700" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Security Alerts</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Audit Log</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={auditSearch}
                  onChange={(event) => setAuditSearch(event.target.value)}
                  placeholder="Search audit..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-48"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportAudit}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-600">Loading audit logs...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-gray-600">No audit records have been inserted yet.</p>
          ) : filteredAuditLogs.length === 0 ? (
            <p className="text-sm text-gray-600">No audit records match your search.</p>
          ) : (
            <div className="space-y-3">
              {filteredAuditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-gray-600">{log.entity_type}{log.entity_id ? ` / ${log.entity_id}` : ''}</p>
                    <p className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteAuditLog(log)}>
                    <Trash2 className="h-4 w-4 text-red-700" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Role Permissions Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Role</th>
                  <th className="text-center py-2">Create</th>
                  <th className="text-center py-2">Edit</th>
                  <th className="text-center py-2">Delete</th>
                  <th className="text-center py-2">Approve</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr key={perm.role} className="border-b">
                    <td className="py-2 font-medium">{perm.role}</td>
                    <td className="text-center"><PermissionIcon allowed={perm.create} /></td>
                    <td className="text-center"><PermissionIcon allowed={perm.edit} /></td>
                    <td className="text-center"><PermissionIcon allowed={perm.delete} /></td>
                    <td className="text-center"><PermissionIcon allowed={perm.approve} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-slate-700" />
            <h2 className="font-semibold">User Access Management</h2>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search users..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {usersLoading ? (
          <p className="text-sm text-gray-600">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-600">No user profiles found.</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-gray-600">No user profiles match your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">User</th>
                  <th className="py-2 text-left">Job</th>
                  <th className="py-2 text-left">Role</th>
                  <th className="py-2 text-center">Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="py-3">
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-600">{user.email}</p>
                    </td>
                    <td className="py-3 text-gray-700">{user.job_title || user.department || 'Not set'}</td>
                    <td className="py-3">
                      <select
                        value={user.role}
                        onChange={(event) => updateUser(user, { role: event.target.value as AppRole })}
                        className="rounded-md border border-gray-300 px-2 py-1"
                      >
                        <option value="engineer">Engineer</option>
                        <option value="project-manager">Project Manager</option>
                        <option value="sales">Sales</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.is_active}
                        onChange={(event) => updateUser(user, { is_active: event.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
