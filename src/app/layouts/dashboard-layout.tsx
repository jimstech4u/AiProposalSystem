import { useEffect, useMemo, useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { selectRows, updateRows } from '../../lib/supabase';
import { getStoredSession } from '../../lib/permissions';

interface DashboardLayoutProps {
  children: ReactNode;
  userRole: string;
  email?: string;
  onLogout: () => void;
}

type SearchResult = {
  id: string;
  label: string;
  meta: string;
  path: string;
  haystack: string;
};

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['engineer', 'project-manager', 'sales', 'admin'] },
  { icon: Plus, label: 'New Proposal', path: '/proposals/new', variant: 'primary', roles: ['engineer', 'project-manager', 'sales'] },
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; read_at?: string | null; created_at: string }>>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState<SearchResult[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const location = useLocation();
  const navigate = useNavigate();
  const displayEmail = email ?? 'user@company.com';
  const initials = displayEmail.slice(0, 2).toUpperCase();
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const allowedNavigation = useMemo(() => navigationItems.filter((item) => item.roles.includes(userRole)), [userRole]);
  const trimmedGlobalSearch = globalSearch.trim().toLowerCase();
  const navResults = useMemo<SearchResult[]>(() => {
    if (!trimmedGlobalSearch) return [];

    return allowedNavigation
      .filter((item) => item.label.toLowerCase().includes(trimmedGlobalSearch) || item.path.toLowerCase().includes(trimmedGlobalSearch))
      .map((item) => ({
        id: `nav-${item.path}`,
        label: item.label,
        meta: 'Page',
        path: item.path,
        haystack: `${item.label} ${item.path}`,
      }));
  }, [allowedNavigation, trimmedGlobalSearch]);
  const visibleGlobalResults = [...navResults, ...globalResults].slice(0, 8);
  const showGlobalResults = searchFocused && Boolean(globalSearch.trim());

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

  useEffect(() => {
    async function loadNotifications() {
      const session = getStoredSession();
      if (!session?.userId) return;

      try {
        const rows = await selectRows<{ id: string; title: string; message: string; read_at?: string | null; created_at: string }>(
          'notifications',
          `select=id,title,message,read_at,created_at&user_id=eq.${session.userId}&order=created_at.desc&limit=8`
        );
        setNotifications(rows);
      } catch (error) {
        console.warn('Unable to load notifications:', error);
      }
    }

    loadNotifications();
  }, [location.pathname]);

  useEffect(() => {
    setGlobalSearch('');
    setSearchFocused(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    async function loadGlobalResults() {
      const value = globalSearch.trim().toLowerCase();
      if (value.length < 2) {
        setGlobalResults([]);
        return;
      }

      try {
        const requests: Promise<SearchResult[]>[] = [
          selectRows<any>('projects', 'select=id,title,status,project_type,description&order=created_at.desc&limit=25').then((rows) =>
            rows.map((project) => ({
              id: `project-${project.id}`,
              label: project.title ?? 'Untitled project',
              meta: `Project${project.status ? ` / ${project.status}` : ''}`,
              path: `/repository/${project.id}`,
              haystack: [project.title, project.status, project.project_type, project.description].filter(Boolean).join(' '),
            }))
          ),
          selectRows<any>('proposals', 'select=id,title,status,template_name,executive_summary&order=created_at.desc&limit=25').then((rows) =>
            rows.map((proposal) => ({
              id: `proposal-${proposal.id}`,
              label: proposal.title ?? 'Untitled proposal',
              meta: `Proposal${proposal.status ? ` / ${proposal.status}` : ''}`,
              path: `/proposals/${proposal.id}`,
              haystack: [proposal.title, proposal.status, proposal.template_name, proposal.executive_summary].filter(Boolean).join(' '),
            }))
          ),
        ];

        if (['sales', 'project-manager', 'admin'].includes(userRole)) {
          requests.push(
            selectRows<any>('clients', 'select=id,company_name,contact_name,industry,email&order=created_at.desc&limit=25').then((rows) =>
              rows.map((client) => ({
                id: `client-${client.id}`,
                label: client.company_name ?? 'Unnamed client',
                meta: `Client${client.industry ? ` / ${client.industry}` : ''}`,
                path: `/clients/${client.id}`,
                haystack: [client.company_name, client.contact_name, client.industry, client.email].filter(Boolean).join(' '),
              }))
            )
          );
        }

        if (['project-manager', 'admin'].includes(userRole)) {
          requests.push(
            selectRows<any>('proposal_templates', 'select=id,name,category,description&order=updated_at.desc&limit=25').then((rows) =>
              rows.map((template) => ({
                id: `template-${template.id}`,
                label: template.name ?? 'Untitled template',
                meta: `Template${template.category ? ` / ${template.category}` : ''}`,
                path: '/templates',
                haystack: [template.name, template.category, template.description].filter(Boolean).join(' '),
              }))
            )
          );
        }

        const settled = await Promise.allSettled(requests);
        if (!active) return;

        const results = settled
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .filter((result) => result.haystack.toLowerCase().includes(value));
        setGlobalResults(results);
      } catch (error) {
        if (active) setGlobalResults([]);
        console.warn('Global search failed:', error);
      }
    }

    const timer = window.setTimeout(loadGlobalResults, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [globalSearch, userRole]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setStoredTheme(next);
  };

  const searchInput = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder="Search projects, clients, proposals..."
        value={globalSearch}
        onChange={(event) => setGlobalSearch(event.target.value)}
        onFocus={() => setSearchFocused(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && visibleGlobalResults[0]) {
            navigate(visibleGlobalResults[0].path);
          }
          if (event.key === 'Escape') {
            setSearchFocused(false);
          }
        }}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {showGlobalResults && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setSearchFocused(false)} />
          <div className="absolute left-0 right-0 top-11 z-20 rounded-lg border border-gray-200 bg-white shadow-lg">
            {visibleGlobalResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-600">
                {trimmedGlobalSearch.length < 2 ? 'Type at least 2 characters to search records.' : 'No matching records found.'}
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto py-1">
                {visibleGlobalResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => navigate(result.path)}
                    className="block w-full px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="block text-sm font-medium text-gray-900">{result.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-600">{result.meta}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
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
          {allowedNavigation.map((item) => {
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navigation */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 md:px-6">
          <div className="flex min-h-10 items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="mr-3 rounded-lg p-2 hover:bg-gray-100 md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
            <div className="hidden flex-1 max-w-2xl md:block">{searchInput}</div>

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
              <div className="relative">
                <button
                  type="button"
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  aria-label="Open notifications"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 min-h-2 min-w-2 rounded-full bg-red-500" />}
                </button>
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotificationsOpen(false)} />
                    <div className="fixed inset-x-4 top-32 z-20 rounded-lg border border-gray-200 bg-white shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-80">
                      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">Notifications</p>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            onClick={async () => {
                              const unread = notifications.filter((notification) => !notification.read_at);
                              await Promise.all(unread.map((notification) => updateRows('notifications', `id=eq.${notification.id}`, { read_at: new Date().toISOString() })));
                              setNotifications((current) => current.map((notification) => ({ ...notification, read_at: notification.read_at ?? new Date().toISOString() })));
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto py-1">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-6 text-center text-sm text-gray-600">No notifications yet.</p>
                        ) : (
                          notifications.map((notification) => (
                            <div key={notification.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                              <div className="flex items-start gap-2">
                                {!notification.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-600" />}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                  <p className="mt-1 text-xs text-gray-600">{notification.message}</p>
                                  <p className="mt-1 text-xs text-gray-500">{new Date(notification.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

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
          <div className="mt-3 md:hidden">{searchInput}</div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
