import { useEffect, useState } from 'react';
import { Bell, Globe, Moon, Save, Shield, Sun, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { deleteRows, insertRow, selectRows, updateRows } from '../../../lib/supabase';
import { can, getStoredRole, getStoredSession } from '../../../lib/permissions';
import { getStoredTheme, setStoredTheme, type ThemeMode } from '../../../lib/theme';
import { toast } from 'sonner';
import { supportedLocales } from '../../../lib/format';

type SettingsRow = {
  id: string;
  user_id: string;
  email_notifications: boolean;
  proposal_updates: boolean;
  language: string;
  theme: ThemeMode;
  timezone?: string | null;
};

function normalizeLocale(language: string) {
  if (supportedLocales.some((locale) => locale.code === language)) return language;
  if (language.toLowerCase().startsWith('french')) return 'fr-FR';
  if (language.toLowerCase().startsWith('yoruba')) return 'yo-NG';
  return 'en-NG';
}

const emptySettings = {
  email_notifications: true,
  proposal_updates: true,
  language: 'en-NG',
  theme: getStoredTheme(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export default function SettingsPage() {
  const session = getStoredSession();
  const role = getStoredRole();
  const canUpdate = can(role, 'settings', 'update');
  const canDelete = can(role, 'settings', 'delete');
  const [settingsId, setSettingsId] = useState('');
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (!session?.userId) {
        setLoading(false);
        return;
      }

      try {
        const [row] = await selectRows<SettingsRow>('user_settings', `select=*&user_id=eq.${session.userId}`);
        if (row) {
          setSettingsId(row.id);
          setSettings({
            email_notifications: row.email_notifications,
            proposal_updates: row.proposal_updates,
            language: normalizeLocale(row.language),
            theme: row.theme,
            timezone: row.timezone ?? emptySettings.timezone,
          });
          setStoredTheme(row.theme);
        }
      } catch (error) {
        console.warn('Unable to load user settings:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [session?.userId]);

  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (key === 'theme') setStoredTheme(value as ThemeMode);
  };

  const saveSettings = async () => {
    if (!session?.userId) {
      toast.error('You must be signed in to save settings.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: session.userId,
        email_notifications: settings.email_notifications,
        proposal_updates: settings.proposal_updates,
        language: settings.language,
        theme: settings.theme,
        timezone: settings.timezone || null,
      };

      if (settingsId) {
        await updateRows('user_settings', `id=eq.${settingsId}`, payload);
      } else {
        const [row] = await insertRow<SettingsRow>('user_settings', payload as SettingsRow);
        setSettingsId(row?.id ?? '');
      }
      toast.success('Settings saved.');
    } catch (error) {
      toast.error('Settings save failed. Apply the updated database schema if this table is missing.');
      console.warn(error);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (settingsId && canDelete && window.confirm('Reset your saved settings?')) {
      try {
        await deleteRows('user_settings', `id=eq.${settingsId}`);
        setSettingsId('');
        setSettings(emptySettings);
        setStoredTheme(emptySettings.theme);
        toast.success('Settings reset.');
      } catch (error) {
        toast.error('Settings reset failed.');
        console.warn(error);
      }
    } else if (!settingsId) {
      setSettings(emptySettings);
      setStoredTheme(emptySettings.theme);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage user preferences.</p>
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-gray-600">Loading settings...</Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold">Notifications</h2>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm">Email notifications</span>
                <input type="checkbox" checked={settings.email_notifications} onChange={(event) => update('email_notifications', event.target.checked)} className="rounded" disabled={!canUpdate} />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm">Proposal updates</span>
                <input type="checkbox" checked={settings.proposal_updates} onChange={(event) => update('proposal_updates', event.target.checked)} className="rounded" disabled={!canUpdate} />
              </label>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold">Security</h2>
            </div>
            <p className="text-sm text-gray-600">Password recovery uses the six-digit email code flow from the forgot-password page.</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold">Preferences</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Language</label>
                <select value={settings.language} onChange={(event) => update('language', event.target.value)} disabled={!canUpdate} className="w-full rounded-lg border px-3 py-2">
                  {supportedLocales.map((locale) => (
                    <option key={locale.code} value={locale.code}>{locale.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Timezone</label>
                <input value={settings.timezone} onChange={(event) => update('timezone', event.target.value)} disabled={!canUpdate} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Theme</label>
                <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => update('theme', 'light')}
                    disabled={!canUpdate}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm ${settings.theme === 'light' ? 'bg-slate-900 text-white' : 'text-gray-700'}`}
                  >
                    <Sun className="h-4 w-4" />
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => update('theme', 'dark')}
                    disabled={!canUpdate}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm ${settings.theme === 'dark' ? 'bg-slate-900 text-white' : 'text-gray-700'}`}
                  >
                    <Moon className="h-4 w-4" />
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            {canDelete && (
              <Button variant="outline" onClick={resetSettings} aria-label="Reset" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
            {canUpdate && (
              <Button onClick={saveSettings} disabled={saving} aria-label={saving ? 'Saving Settings' : 'Save Settings'} className="h-10 w-10 px-0 sm:w-auto sm:px-4">
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Settings'}</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
