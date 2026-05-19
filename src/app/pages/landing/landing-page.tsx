import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Layers3,
  ShieldCheck,
  Sparkles,
  Moon,
  Sun,
  Users,
} from 'lucide-react';
import { AuthBrand } from '../../components/auth-brand';
import { getStoredTheme, setStoredTheme, type ThemeMode } from '../../../lib/theme';

const modules = [
  { icon: FileText, title: 'Requirement Analysis', body: 'Capture client needs, functional scope, constraints, and AI-assisted requirement summaries.' },
  { icon: Sparkles, title: 'Proposal Generation', body: 'Turn approved analysis into structured technical proposals with editable professional sections.' },
  { icon: BarChart3, title: 'Cost Estimation', body: 'Prepare NGN-based module costs, contingency, confidence ranges, and exportable estimation reports.' },
  { icon: Clock, title: 'Timeline Prediction', body: 'Model delivery phases, milestones, dependencies, risk factors, and expected project duration.' },
  { icon: Users, title: 'Client Management', body: 'Maintain client profiles, proposal history, contact details, segmentation, and follow-up context.' },
  { icon: ShieldCheck, title: 'Security & Audit', body: 'Use role-based access, audit records, review controls, and administrative oversight.' },
];

const workflow = [
  'Select or create a client profile',
  'Analyze requirements and project complexity',
  'Generate proposal, cost, timeline, and stack recommendations',
  'Review, approve, export, and track proposal outcomes',
];

export default function LandingPage() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    const syncTheme = (event: Event) => {
      setTheme((event as CustomEvent<ThemeMode>).detail ?? getStoredTheme());
    };

    window.addEventListener('proposalai:theme-change', syncTheme);
    return () => window.removeEventListener('proposalai:theme-change', syncTheme);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setStoredTheme(next);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <AuthBrand />
          <nav className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 sm:px-4">
              Sign In
            </Link>
            <Link to="/register" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:px-4">
              Create Account
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-6 md:py-20">
            <div className="flex flex-col justify-center">
              <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-normal text-slate-950 dark:text-white sm:text-4xl md:text-6xl">
                ProposalAI
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">
                An AI-powered technical proposal and cost estimation system for software development firms, built to standardize requirement analysis, proposal drafting, cost planning, timeline prediction, and approval workflows.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="inline-flex h-12 items-center justify-center rounded-md bg-blue-600 px-6 text-base font-medium text-white hover:bg-blue-700">
                  Start Proposal Workflow
                </Link>
                <Link to="/login" className="inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-base font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-950 p-4 shadow-xl sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-lg" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Proposal Workspace</p>
                    <p className="text-xs text-slate-400">Live workflow preview</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">Ready</span>
              </div>
              <div className="grid gap-4 pt-5 sm:grid-cols-2">
                {[
                  ['Requirements', '24 captured'],
                  ['Proposal Draft', '11 sections'],
                  ['Estimated Value', 'NGN ready'],
                  ['Approvals', 'Role based'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-slate-800 bg-slate-900 p-4">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 text-xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {workflow.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-md bg-slate-900 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                    <span className="text-sm text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="modules" className="mx-auto max-w-7xl px-4 py-14 md:px-6">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">What The System Covers</h2>
              <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
                The platform aligns with the proposal lifecycle: client intake, requirement analysis, AI drafting, estimation, timeline planning, repository learning, reporting, integrations, and audit control.
              </p>
            </div>
            <Layers3 className="hidden h-10 w-10 text-slate-500 md:block" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <article key={module.title} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <Icon className="h-6 w-6 text-blue-600" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{module.body}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:px-6">
          <div>
            <AuthBrand />
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
              Built for software teams that need clearer requirement intake, faster proposal preparation, and more consistent project estimation.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Product</h3>
            <div className="mt-3 space-y-2 text-sm">
              <Link to="/register" className="block text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-300">Create account</Link>
              <Link to="/login" className="block text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-300">Sign in</Link>
              <a href="#modules" className="block text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-300">Modules</a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Legal</h3>
            <div className="mt-3 space-y-2 text-sm">
              <Link to="/terms" className="block text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-300">Terms and Conditions</Link>
              <Link to="/privacy" className="block text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-300">Privacy Policy</Link>
              <Link to="/cookies" className="block text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-300">Cookie Notice</Link>
              <Link to="/accessibility" className="block text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-300">Accessibility</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-4 py-5 dark:border-slate-800">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 ProposalAI. All rights reserved.</p>
            <p>AI-Powered Technical Proposal and Cost Estimation System.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
