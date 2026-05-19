import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { getUserProfile, signUpWithPassword, verifyEmailOtp, type AppRole } from '../../../lib/supabase';
import { AuthBrand } from '../../components/auth-brand';

type RegisterPageProps = {
  onLogin: (role: AppRole, accessToken?: string, email?: string, userId?: string) => void;
};

export default function RegisterPage({ onLogin }: RegisterPageProps) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    employeeId: '',
    companyName: '',
    jobTitle: '',
    department: 'Engineering',
    role: 'engineer' as AppRole,
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUpWithPassword(form);
      if (result.access_token && result.user?.id) {
        const [profile] = await getUserProfile(result.user.id, result.access_token);
        onLogin(profile?.role ?? form.role, result.access_token, result.user.email ?? form.email, result.user.id);
        toast.success('Account created and signed in.');
        return;
      }

      setAwaitingCode(true);
      toast.success('Account created. Enter the six-digit verification code sent to your email.');
    } catch (error) {
      toast.error('Registration could not be completed. Check authentication settings and network access.');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verificationCode.trim().length !== 6) {
      toast.error('Enter the six-digit verification code.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await verifyEmailOtp({
        email: form.email,
        token: verificationCode.trim(),
        type: 'signup',
      });
      const [profile] = await getUserProfile(session.user.id, session.access_token);
      onLogin(profile?.role ?? form.role, session.access_token, session.user.email ?? form.email, session.user.id);
      toast.success('Email verified and account activated.');
    } catch (error) {
      toast.error('Verification failed. Check the code and try again.');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Link to="/" className="absolute right-4 top-4 rounded-full p-2 text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Cancel and return to landing page">
        <X className="h-5 w-5" />
      </Link>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <AuthBrand />
          <h1 className="mt-5 text-3xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-600 mt-2">Join ProposalAI to streamline your workflow</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {awaitingCode ? (
            <form className="space-y-6" onSubmit={handleVerify}>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Verify your email</h2>
                <p className="mt-1 text-sm text-gray-600">
                  A six-digit code was sent to {form.email}. Enter it to activate your account.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Six-digit code</label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAwaitingCode(false)}>
                  Edit account details
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Verifying...' : 'Verify Account'}
                </Button>
              </div>
            </form>
          ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <Input placeholder="Full legal name" required value={form.fullName} onChange={(event) => update('fullName', event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                <Input type="email" placeholder="name@company.com" required value={form.email} onChange={(event) => update('email', event.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <Input type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee ID</label>
                <Input placeholder="EMP-12345" value={form.employeeId} onChange={(event) => update('employeeId', event.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name *</label>
                <Input placeholder="Company name" required value={form.companyName} onChange={(event) => update('companyName', event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
                <Input placeholder="Software Engineer" value={form.jobTitle} onChange={(event) => update('jobTitle', event.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.department} onChange={(event) => update('department', event.target.value)}>
                  <option>Engineering</option>
                  <option>Sales</option>
                  <option>Management</option>
                  <option>Administration</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role *</label>
                <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.role} onChange={(event) => update('role', event.target.value)}>
                  <option value="engineer">Software Engineer</option>
                  <option value="project-manager">Project Manager</option>
                  <option value="sales">Sales Team</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                <Input type="password" placeholder="Password" required value={form.password} onChange={(event) => update('password', event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password *</label>
                <Input type="password" placeholder="Confirm password" required value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} />
              </div>
            </div>

            <div className="flex items-start">
              <input type="checkbox" required className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <label className="ml-2 text-sm text-gray-600">
                I agree to the <Link to="/terms" className="text-blue-600 hover:text-blue-700">Terms & Conditions</Link> and <Link to="/privacy" className="text-blue-600 hover:text-blue-700">Privacy Policy</Link>
              </label>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
