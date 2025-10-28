import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Suspense, lazy } from 'react';
import LoadingScreen from './components/LoadingScreen';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Toast from './components/Toast';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/auth/Login'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPassword'));
const SignupPage = lazy(() => import('./pages/auth/Signup'));
const DashboardPage = lazy(() => import('./pages/dashboard/Dashboard'));
const UsersPage = lazy(() => import('./pages/dashboard/Users'));
const TransactionsPage = lazy(() => import('./pages/dashboard/Transactions'));
const AnalyticsPage = lazy(() => import('./pages/dashboard/Analytics'));
const ActivityPage = lazy(() => import('./pages/dashboard/Activity'));
const KycDataPage = lazy(() => import('./pages/dashboard/KycData'));
const PayoutEventsPage = lazy(() => import('./pages/dashboard/PayoutEvents'));
const SettingsPage = lazy(() => import('./pages/dashboard/Settings'));
const UserDetailsPage = lazy(() => import('./pages/dashboard/UserDetails'));
const SuperAdminPage = lazy(() => import('./pages/dashboard/SuperAdmin'));
const BannersPage = lazy(() => import('./pages/dashboard/Banners'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));

function App() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
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
              {/* Dashboard Routes */}
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="users/:id" element={<UserDetailsPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="kyc-data" element={<KycDataPage />} />
                <Route path="payout-events" element={<PayoutEventsPage />} />
                <Route path="super-admin" element={<SuperAdminPage />} />
                <Route path="banners" element={<BannersPage />} />
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