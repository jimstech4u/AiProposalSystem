import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { getUserProfile, resendSignupOtp, signInWithPassword, verifyEmailOtp, type AppRole } from '../../../lib/supabase';
import { AuthBrand } from '../../components/auth-brand';

interface LoginPageProps {
  onLogin: (role: AppRole, accessToken?: string, email?: string, userId?: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const isEmailNotConfirmedError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('email not confirmed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      const session = await signInWithPassword(email, password);
      const [profile] = await getUserProfile(session.user.id, session.access_token);
      if (profile && profile.is_active === false) {
        throw new Error('Account is inactive.');
      }
      const metadataRole = session.user.user_metadata?.role as AppRole | undefined;
      onLogin(profile?.role ?? metadataRole ?? 'engineer', session.access_token, session.user.email ?? email, session.user.id);
      toast.success('Signed in successfully');
    } catch (error) {
      if (isEmailNotConfirmedError(error)) {
        try {
          await resendSignupOtp(email);
          setAwaitingConfirmation(true);
          toast.success('A six-digit verification code was sent to your email.');
        } catch (resendError) {
          toast.error('Your email is not confirmed, and a new code could not be sent.');
          console.warn(resendError);
        }
        setSubmitting(false);
        return;
      }
      toast.error('Sign in failed. Check your email and password.');
      console.warn(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyConfirmation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verificationCode.trim().length !== 6) {
      toast.error('Enter the six-digit verification code.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await verifyEmailOtp({
        email,
        token: verificationCode.trim(),
        type: 'signup',
      });
      const [profile] = await getUserProfile(session.user.id, session.access_token);
      const metadataRole = session.user.user_metadata?.role as AppRole | undefined;
      onLogin(profile?.role ?? metadataRole ?? 'engineer', session.access_token, session.user.email ?? email, session.user.id);
      toast.success('Email verified and signed in successfully.');
    } catch (error) {
      toast.error('Verification failed. Check the code and try again.');
      console.warn(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Link to="/" className="absolute right-4 top-4 rounded-full p-2 text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Cancel and return to landing page">
        <X className="h-5 w-5" />
      </Link>
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <AuthBrand />
          <p className="text-gray-600 mt-3">Technical proposals, estimates, and project records</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
            <p className="text-gray-600 mt-1">Sign in to your account</p>
          </div>

          {awaitingConfirmation ? (
            <form onSubmit={handleVerifyConfirmation} className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Verify your email</h3>
                <p className="mt-1 text-sm text-gray-600">
                  A six-digit code was sent to {email}. Enter it to confirm your account.
                </p>
              </div>
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Six-digit code
                </label>
                <Input
                  id="verification-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAwaitingConfirmation(false)}>
                  Back to sign in
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Verifying...' : 'Verify Email'}
                </Button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email or Username
              </label>
              <Input
                id="email"
                type="text"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
