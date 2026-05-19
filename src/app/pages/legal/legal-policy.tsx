import { Link } from 'react-router-dom';
import { Accessibility, Cookie, FileCheck, LockKeyhole } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

type LegalPolicyPageProps = {
  type: 'terms' | 'privacy' | 'cookies' | 'accessibility';
};

const termsSections = [
  {
    title: 'Acceptable Use',
    body: 'Users may use ProposalAI only for authorized business activities, including requirement analysis, proposal preparation, cost estimation, timeline planning, reporting, and client management. Unauthorized access, credential sharing, abusive automation, or attempts to bypass role-based access controls are prohibited.',
  },
  {
    title: 'Account Responsibility',
    body: 'Each user is responsible for maintaining the confidentiality of their account credentials and for all actions performed through their account. Administrators may suspend accounts that are inactive, compromised, or used outside approved organizational workflows.',
  },
  {
    title: 'Generated Content',
    body: 'AI-generated proposal, cost, timeline, and technology recommendations are decision-support outputs. Users must review, edit, and approve all generated content before it is sent to clients or used for contractual commitments.',
  },
  {
    title: 'Business Records',
    body: 'Project requirements, proposals, estimates, reviews, audit logs, and client records stored in the system are organizational records and must be handled according to company policy and applicable law.',
  },
];

const privacySections = [
  {
    title: 'Information Collected',
    body: 'The system stores account profile information, client contact details, project requirements, generated proposal content, cost and timeline estimates, technology recommendations, review decisions, notifications, and audit records needed to operate the platform.',
  },
  {
    title: 'How Information Is Used',
    body: 'Information is used to authenticate users, enforce role-based access, generate proposals and estimates, maintain project history, support reporting, and improve organizational proposal workflows.',
  },
  {
    title: 'Access Control',
    body: 'Access to records is restricted through authenticated sessions and database row-level security policies. Administrative functions are limited to users with approved administrator permissions.',
  },
  {
    title: 'Data Protection',
    body: 'Sensitive keys must remain outside browser code unless they are intended for public client use. Service-role credentials must be stored only in trusted server environments and rotated immediately if exposed.',
  },
];

const cookiesSections = [
  {
    title: 'Essential Browser Storage',
    body: 'ProposalAI uses browser storage to keep the active session, theme preference, and temporary workflow state needed while a user moves between requirement analysis, proposals, estimates, and reports.',
  },
  {
    title: 'No Advertising Tracking',
    body: 'The application does not use advertising cookies. Any third-party request is limited to configured business services such as Supabase authentication and Gemini-assisted generation.',
  },
  {
    title: 'Managing Preferences',
    body: 'Users can clear browser storage to remove local preferences. Doing so signs the user out and removes unsaved temporary workflow state from the device.',
  },
];

const accessibilitySections = [
  {
    title: 'Accessible Navigation',
    body: 'The system supports keyboard navigation, responsive layouts, semantic form labels, clear focus states, and consistent page structure across authenticated and public screens.',
  },
  {
    title: 'Visual Preferences',
    body: 'Light and dark mode are available to support different viewing environments. Content is designed to remain readable on desktop, tablet, and mobile screen sizes.',
  },
  {
    title: 'Support',
    body: 'Users who identify an accessibility barrier should report the affected page, browser, device, and expected behavior to the system administrator for correction.',
  },
];

export default function LegalPolicyPage({ type }: LegalPolicyPageProps) {
  const policy = {
    terms: {
      title: 'Terms and Conditions',
      icon: FileCheck,
      sections: termsSections,
    },
    privacy: {
      title: 'Privacy Policy',
      icon: LockKeyhole,
      sections: privacySections,
    },
    cookies: {
      title: 'Cookie and Storage Notice',
      icon: Cookie,
      sections: cookiesSections,
    },
    accessibility: {
      title: 'Accessibility Statement',
      icon: Accessibility,
      sections: accessibilitySections,
    },
  }[type];
  const Icon = policy.icon;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/login">
          <Button variant="ghost">Back to sign in</Button>
        </Link>

        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">
                  {policy.title}
                </h1>
                <p className="text-sm text-slate-600">Last updated: May 15, 2026</p>
              </div>
            </div>

            {policy.sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
                <p className="leading-7 text-slate-700">{section.body}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
