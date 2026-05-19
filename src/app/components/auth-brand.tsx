import { Link } from 'react-router-dom';

type AuthBrandProps = {
  className?: string;
};

export function AuthBrand({ className = '' }: AuthBrandProps) {
  return (
    <Link to="/" className={`inline-flex items-center justify-center gap-3 ${className}`} aria-label="Back to dashboard">
      <img src="/favicon.svg" alt="" className="h-11 w-11 flex-shrink-0 rounded-xl shadow-sm" />
      <span className="text-3xl font-bold tracking-normal text-slate-900">ProposalAI</span>
    </Link>
  );
}
