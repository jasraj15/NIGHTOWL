import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { NotificationProvider } from './context/NotificationContext.js';
import { AppLayout } from './layouts/AppLayout.js';
import { LandingPage } from './pages/LandingPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { SelectHostelPage } from './pages/SelectHostelPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CreatePoolPage } from './pages/CreatePoolPage.js';
import { PoolDetailsPage } from './pages/PoolDetailsPage.js';
import { OrdersPage } from './pages/OrdersPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { LegalPage } from './pages/LegalPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { OwlMark } from './components/brand/Logo.js';

/** Scroll to the top on every route change (browsers keep the old offset in SPAs). */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const FullScreenLoader: React.FC = () => (
  <div className="flex min-h-dvh items-center justify-center bg-base" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3">
      <OwlMark className="h-14 w-14 animate-pulse" />
      <p className="text-sm text-muted">Waking NightOwl…</p>
    </div>
  </div>
);

/** Requires a signed-in, verified user. Users who haven't picked a hostel are sent to the hostel screen first. */
const RequireAuth: React.FC<{ requireHostel?: boolean }> = ({ requireHostel = true }) => {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth?mode=login" replace state={{ from: location.pathname }} />;
  if (requireHostel && !user.hostelSelected && location.pathname !== '/select-hostel') return <Navigate to="/select-hostel" replace />;
  return <Outlet />;
};

/** Public-only routes bounce signed-in users to the app. */
const PublicOnly: React.FC = () => {
  const { user, initializing } = useAuth();
  if (initializing) return <FullScreenLoader />;
  if (user) return <Navigate to={user.hostelSelected ? '/dashboard' : '/select-hostel'} replace />;
  return <Outlet />;
};

export const App: React.FC = () => (
  <ThemeProvider>
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route element={<PublicOnly />}>
                <Route path="/auth" element={<AuthPage />} />
              </Route>
              <Route element={<RequireAuth requireHostel={false} />}>
                <Route path="/select-hostel" element={<SelectHostelPage />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/pools/new" element={<CreatePoolPage />} />
                  <Route path="/pools/:id" element={<PoolDetailsPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/:section" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="/history" element={<Navigate to="/orders" replace />} />
              <Route path="/profile" element={<Navigate to="/settings" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  </ThemeProvider>
);

export default App;
