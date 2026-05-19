import { useEffect, useState, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Clock,
  Lightbulb,
  FolderOpen,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  User,
  Plus,
  CheckCircle,
  FileStack,
  Plug,
  Shield,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getStoredTheme, setStoredTheme, type ThemeMode } from '../../lib/theme';

interface DashboardLayoutProps {
  children: ReactNode;
  userRole: string;
  email?: string;
  onLogout: () => void;
}

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['engineer', 'project-manager', 'sales', 'admin'] },
  { icon: Plus, label: 'New Proposal', path: '/requirements/new', variant: 'primary', roles: ['engineer', 'project-manager', 'sales'] },
  { icon: FileText, label: 'Requirements', path: '/requirements/new', roles: ['engineer', 'project-manager', 'sales'] },
  { icon: FileText, label: 'Proposals', path: '/proposals', roles: ['engineer', 'project-manager', 'sales', 'admin'] },
  { icon: CheckCircle, label: 'Proposal Review', path: '/proposals/review', roles: ['project-manager', 'admin'] },
  { icon: DollarSign, label: 'Cost Estimation', path: '/estimation', roles: ['engineer', 'project-manager', 'sales'] },
  { icon: Clock, label: 'Timeline', path: '/timeline', roles: ['engineer', 'project-manager'] },
  { icon: Lightbulb, label: 'Technology', path: '/technology', roles: ['engineer', 'project-manager'] },
  { icon: FolderOpen, label: 'Repository', path: '/repository', roles: ['engineer', 'project-manager', 'sales', 'admin'] },
  { icon: Users, label: 'Clients', path: '/clients', roles: ['sales', 'project-manager', 'admin'] },
  { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['project-manager', 'sales', 'admin'] },
  { icon: FileStack, label: 'Templates', path: '/templates', roles: ['project-manager', 'admin'] },
  { icon: Plug, label: 'Integrations', path: '/integrations', roles: ['admin'] },
  { icon: Shield, label: 'Security & Audit', path: '/security', roles: ['admin'] },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['engineer', 'project-manager', 'sales', 'admin'] },
];

export default function DashboardLayout({ children, userRole, email, onLogout }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const location = useLocation();
  const displayEmail = email ?? 'user@company.com';
  const initials = displayEmail.slice(0, 2).toUpperCase();

  const getRoleName = (role: string) => {
    switch (role) {
      case 'engineer': return 'Software Engineer';
      case 'project-manager': return 'Project Manager';
      case 'sales': return 'Sales Team';
      case 'admin': return 'Administrator';
      default: return 'User';
    }
  };

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
    <div className="h-screen flex overflow-hidden bg-slate-50">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0 md:w-64' : '-translate-x-full md:translate-x-0 md:w-20'
        } fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white flex flex-col transition-all duration-300 ease-in-out md:relative`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg" />
              <span className="font-bold text-lg tracking-normal">ProposalAI</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navigationItems
            .filter(item => item.roles.includes(userRole))
            .map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                } ${!sidebarOpen && 'justify-center'}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        {sidebarOpen && (
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center font-medium text-slate-950">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{displayEmail}</p>
                <p className="text-xs text-gray-400 truncate">{getRoleName(userRole)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-3 rounded-lg p-2 hover:bg-gray-100 md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5 text-gray-700" />
          </button>
          <div className="hidden flex-1 max-w-2xl md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects, clients, proposals..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 md:ml-6">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-gray-600" /> : <Moon className="w-5 h-5 text-gray-600" />}
            </button>
            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                  {initials}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-medium text-sm">{getRoleName(userRole)}</p>
                      <p className="text-xs text-gray-500">{displayEmail}</p>
                    </div>
                    <Link to="/profile" className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="flex-1">View Profile</span>
                    </Link>
                    <Link to="/settings" className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span className="flex-1">Settings</span>
                    </Link>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={onLogout}
                        className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
