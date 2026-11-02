import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Suspense, lazy } from 'react';
import LoadingScreen from './components/LoadingScreen';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Toast from './components/Toast';
import MfaGate from './components/mfa/MfaGate';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/auth/Login'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPassword'));
const SignupPage = lazy(() => import('./pages/auth/Signup'));
const WelcomePage = lazy(() => import('./pages/dashboard/Welcome'));
const DashboardPage = lazy(() => import('./pages/dashboard/Dashboard'));
const UsersPage = lazy(() => import('./pages/dashboard/Users'));
const TransactionsPage = lazy(() => import('./pages/dashboard/Transactions'));
const CalendarPage = lazy(() => import('./pages/dashboard/Calendar'));
const AnalyticsPage = lazy(() => import('./pages/dashboard/Analytics'));
const ActivityPage = lazy(() => import('./pages/dashboard/Activity'));
const KycDataPage = lazy(() => import('./pages/dashboard/KycData'));
const PayoutEventsPage = lazy(() => import('./pages/dashboard/PayoutEvents'));
const ProcessPayoutsPage = lazy(() => import('./pages/dashboard/ProcessPayouts'));
const PayoutPlansPage = lazy(() => import('./pages/dashboard/PayoutPlans'));
const VaultsPage = lazy(() => import('./pages/dashboard/Vaults'));
const VaultDetailsPage = lazy(() => import('./pages/dashboard/VaultDetails'));
const SettingsPage = lazy(() => import('./pages/dashboard/Settings'));
const UserDetailsPage = lazy(() => import('./pages/dashboard/UserDetails'));
const SuperAdminPage = lazy(() => import('./pages/dashboard/SuperAdmin'));
const BannersPage = lazy(() => import('./pages/dashboard/Banners'));
const AppVersionsPage = lazy(() => import('./pages/dashboard/AppVersions'));
const MarketingPage = lazy(() => import('./pages/dashboard/Marketing'));
const NotificationsPage = lazy(() => import('./pages/dashboard/Notifications'));
const BlogPage = lazy(() => import('./pages/dashboard/Blog'));
const AuditLogsPage = lazy(() => import('./pages/dashboard/AuditLogs'));
const EmergencyWithdrawalsPage = lazy(() => import('./pages/dashboard/EmergencyWithdrawals'));
const CompletedPayoutsPage = lazy(() => import('./pages/dashboard/CompletedPayouts'));
const CancelledPayoutsPage = lazy(() => import('./pages/dashboard/CancelledPayouts'));
const UserTransactionsPage = lazy(() => import('./pages/dashboard/UserTransactions'));
const UserEventsPage = lazy(() => import('./pages/dashboard/UserEvents'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));

function App() {
  const { session, isLoading, mfa } = useAuth();

  // Show loading screen while auth is initializing
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Signed in with a password but not yet with the authenticator code (or no authenticator set up
  // yet): nothing of the dashboard renders until 2FA is done
  if (session && mfa.status !== 'ready') {
    return (
      <>
        <MfaGate />
        <Toast />
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Auth Routes */}
          {!session ? (
            <>
              <Route path="/" element={<AuthLayout />}>
                <Route index element={<Navigate to="/login" replace />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              {/* A signed-in user opening an auth URL (e.g. right after login, while the
                  URL is still /login, or via a bookmark) goes to the app instead of a 404 */}
              <Route path="/login" element={<Navigate to="/welcome" replace />} />
              <Route path="/signup" element={<Navigate to="/welcome" replace />} />
              <Route path="/forgot-password" element={<Navigate to="/welcome" replace />} />

              {/* Dashboard Routes */}
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<Navigate to="/welcome" replace />} />
                <Route path="welcome" element={<WelcomePage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="users/:id" element={<UserDetailsPage />} />
                <Route path="users/:id/transactions" element={<UserTransactionsPage />} />
                <Route path="users/:id/events" element={<UserEventsPage />} />
                <Route path="users/:id/completed-payouts" element={<CompletedPayoutsPage />} />
                <Route path="users/:id/cancelled-payouts" element={<CancelledPayoutsPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="kyc-data" element={<KycDataPage />} />
                <Route path="payout-events" element={<PayoutEventsPage />} />
                <Route path="process-payouts" element={<ProcessPayoutsPage />} />
                <Route path="payout-plans" element={<PayoutPlansPage />} />
                <Route path="vaults" element={<VaultsPage />} />
                <Route path="vaults/:id" element={<VaultDetailsPage />} />
                <Route path="super-admin" element={<SuperAdminPage />} />
                <Route path="banners" element={<BannersPage />} />
                <Route path="app-versions" element={<AppVersionsPage />} />
                <Route path="marketing" element={<MarketingPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="blog" element={<BlogPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="emergency-withdrawals" element={<EmergencyWithdrawalsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </>
          )}
        </Routes>
      </Suspense>
      <Toast />
    </>
  );
}

export default App;