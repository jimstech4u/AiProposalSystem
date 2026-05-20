import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import ForgotPasswordPage from './pages/auth/forgot-password';
import ProfilePage from './pages/auth/profile';
import LandingPage from './pages/landing/landing-page';
import DashboardLayout from './layouts/dashboard-layout';
import EngineerDashboard from './pages/dashboards/engineer-dashboard';
import ProjectManagerDashboard from './pages/dashboards/project-manager-dashboard';
import SalesDashboard from './pages/dashboards/sales-dashboard';
import AdminDashboard from './pages/dashboards/admin-dashboard';
import RequirementAnalysis from './pages/requirements/requirement-analysis';
import AnalysisResults from './pages/requirements/analysis-results';
import ProposalGeneration from './pages/proposals/proposal-generation';
import ProposalList from './pages/proposals/proposal-list';
import ProposalReviewPage from './pages/proposals/proposal-review';
import CostEstimation from './pages/estimation/cost-estimation';
import TimelinePrediction from './pages/timeline/timeline-prediction';
import TechnologyRecommendation from './pages/technology/technology-recommendation';
import ProjectRepository from './pages/repository/project-repository';
import ProjectDetail from './pages/repository/project-detail';
import ClientDirectory from './pages/clients/client-directory';
import ClientProfile from './pages/clients/client-profile';
import ReportsAnalytics from './pages/reports/reports-analytics';
import TemplateManagementPage from './pages/templates/template-management';
import IntegrationsPage from './pages/integrations/integrations';
import SecurityAuditPage from './pages/security/security-audit';
import SettingsPage from './pages/settings/settings';
import LegalPolicyPage from './pages/legal/legal-policy';
import { readJson, removeJson, saveJson } from '../lib/storage';
import { isJwtExpired, signOut, type AppRole } from '../lib/supabase';
import { applyTheme, getStoredTheme } from '../lib/theme';

type StoredSession = {
  role: AppRole;
  userId?: string;
  accessToken?: string;
  email?: string;
};

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(() =>
    readJson<StoredSession | null>('session', null)
  );
  const isAuthenticated = Boolean(session?.accessToken && !isJwtExpired(session.accessToken));
  const userRole = session?.role ?? 'engineer';

  const handleLogin = (role: AppRole, accessToken?: string, email?: string, userId?: string) => {
    const nextSession = { role, accessToken, email, userId };
    saveJson('session', nextSession);
    setSession(nextSession);
  };

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    if (session && (!session.accessToken || isJwtExpired(session.accessToken))) {
      removeJson('session');
      setSession(null);
    }
  }, [session]);

  useEffect(() => {
    const expireSession = () => {
      removeJson('session');
      setSession(null);
    };

    window.addEventListener('proposalai:session-expired', expireSession);
    return () => window.removeEventListener('proposalai:session-expired', expireSession);
  }, []);

  const handleLogout = async () => {
    if (session?.accessToken) {
      signOut(session.accessToken).catch((error) => console.warn('Supabase sign out failed:', error));
    }
    removeJson('session');
    setSession(null);
  };

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          {/* Auth Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <LoginPage onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/register" 
            element={
              isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <RegisterPage onLogin={handleLogin} />
            } 
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/terms" element={<LegalPolicyPage type="terms" />} />
          <Route path="/privacy" element={<LegalPolicyPage type="privacy" />} />
          <Route path="/cookies" element={<LegalPolicyPage type="cookies" />} />
          <Route path="/accessibility" element={<LegalPolicyPage type="accessibility" />} />

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <DashboardLayout userRole={userRole} email={session?.email} onLogout={handleLogout}>
                  <Routes>
                    <Route path="/dashboard" element={
                      userRole === 'engineer' ? <EngineerDashboard /> :
                      userRole === 'project-manager' ? <ProjectManagerDashboard /> :
                      userRole === 'sales' ? <SalesDashboard /> :
                      <AdminDashboard />
                    } />
                    <Route path="/requirements/new" element={<RequirementAnalysis />} />
                    <Route path="/requirements/:id/results" element={<AnalysisResults />} />
                    <Route path="/proposals" element={<ProposalList />} />
                    <Route path="/proposals/new" element={<ProposalGeneration />} />
                    <Route path="/proposals/:id" element={<ProposalGeneration />} />
                    <Route path="/estimation" element={<CostEstimation />} />
                    <Route path="/timeline" element={<TimelinePrediction />} />
                    <Route path="/technology" element={<TechnologyRecommendation />} />
                    <Route path="/repository" element={<ProjectRepository />} />
                    <Route path="/repository/:id" element={<ProjectDetail />} />
                    <Route path="/clients" element={<ClientDirectory />} />
                    <Route path="/clients/:id" element={<ClientProfile />} />
                    <Route path="/reports" element={<ReportsAnalytics />} />
                    <Route path="/proposals/review" element={
                      userRole === 'project-manager' || userRole === 'admin' ? 
                      <ProposalReviewPage /> : 
                      <Navigate to="/dashboard" replace />
                    } />
                    <Route path="/templates" element={
                      userRole === 'project-manager' || userRole === 'admin' ? 
                      <TemplateManagementPage /> : 
                      <Navigate to="/dashboard" replace />
                    } />
                    <Route path="/integrations" element={
                      userRole === 'admin' ? 
                      <IntegrationsPage /> : 
                      <Navigate to="/dashboard" replace />
                    } />
                    <Route path="/security" element={
                      userRole === 'admin' ? 
                      <SecurityAuditPage /> : 
                      <Navigate to="/dashboard" replace />
                    } />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </DashboardLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </>
  );
}
