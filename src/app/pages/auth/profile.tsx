import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Building, Briefcase, Shield, Save } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { toast } from 'sonner';
import { readJson } from '../../../lib/storage';
import { getUserProfile, updateRows, type UserProfile } from '../../../lib/supabase';

type StoredSession = {
  userId?: string;
  accessToken?: string;
  email?: string;
};

type EditableProfile = {
  full_name: string;
  email: string;
  phone: string;
  employee_id: string;
  company_name: string;
  job_title: string;
  department: string;
};

const emptyProfile: EditableProfile = {
  full_name: '',
  email: '',
  phone: '',
  employee_id: '',
  company_name: '',
  job_title: '',
  department: '',
};

export default function ProfilePage() {
  const session = readJson<StoredSession | null>('session', null);
  const [profileId, setProfileId] = useState('');
  const [profile, setProfile] = useState<EditableProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const initials = useMemo(() => {
    const source = profile.full_name || profile.email || 'User';
    return source
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile.email, profile.full_name]);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.userId) {
        setLoading(false);
        return;
      }

      try {
        const [row] = await getUserProfile(session.userId, session.accessToken);
        if (row) {
          setProfileId(row.id);
          setProfile({
            full_name: row.full_name ?? '',
            email: row.email ?? session.email ?? '',
            phone: row.phone ?? '',
            employee_id: row.employee_id ?? '',
            company_name: row.company_name ?? '',
            job_title: row.job_title ?? '',
            department: row.department ?? '',
          });
        }
      } catch (error) {
        toast.error('Unable to load your profile.');
        console.warn(error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [session?.accessToken, session?.email, session?.userId]);

  const update = (field: keyof EditableProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!profileId) {
      toast.error('Profile cannot be updated until your session is loaded.');
      return;
    }

    if (!profile.full_name.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setSaving(true);
    try {
      await updateRows<UserProfile>(
        'user_profiles',
        `id=eq.${profileId}`,
        {
          full_name: profile.full_name.trim(),
          phone: profile.phone.trim() || null,
          company_name: profile.company_name.trim() || null,
          job_title: profile.job_title.trim() || null,
          department: profile.department.trim() || null,
        },
        session?.accessToken
      );
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error('Profile update failed. Check your permissions and try again.');
      console.warn(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
            <p className="text-gray-600">Manage your account information</p>
          </div>
          <Link to="/dashboard" aria-label="Back to Dashboard" className="shrink-0">
            <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <p className="text-sm text-gray-600">Loading profile...</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6 pb-6 border-b">
              <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl font-bold">
                {initials}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{profile.full_name || 'Profile'}</h2>
                <p className="text-gray-600">{profile.job_title || 'No job title set'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <Input value={profile.full_name} onChange={(event) => update('full_name', event.target.value)} icon={<User className="w-5 h-5" />} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <Input type="email" value={profile.email} disabled icon={<Mail className="w-5 h-5" />} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <Input value={profile.phone} onChange={(event) => update('phone', event.target.value)} icon={<Phone className="w-5 h-5" />} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                <Input value={profile.employee_id} disabled icon={<Shield className="w-5 h-5" />} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <Input value={profile.company_name} onChange={(event) => update('company_name', event.target.value)} icon={<Building className="w-5 h-5" />} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                <Input value={profile.job_title} onChange={(event) => update('job_title', event.target.value)} icon={<Briefcase className="w-5 h-5" />} />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
