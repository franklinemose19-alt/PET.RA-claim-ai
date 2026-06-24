// src/App.jsx
//
// PET.RA Claims AI — Root App Component
//
// Sets up routing and wraps everything in AuthProvider. Route guards check
// `role` from useAuth(). Logged-out visitors hitting "/" see the Landing
// page directly; logged-in visitors hitting "/" redirect to their role's
// home. Super Admin dashboard is still a placeholder — build that next so
// insurers can actually be verified and go live.

import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';
import AppLayout from './components/AppLayout';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Landing from './pages/Landing';
import Login from './pages/Login';
import ConnectInsurer from './pages/customer/ConnectInsurer';
import CustomerClaimsList from './pages/customer/CustomerClaimsList';
import StartClaim from './pages/customer/StartClaim';
import ClaimDetail from './pages/customer/ClaimDetail';
import CompanyDashboard from './pages/company/CompanyDashboard';
import ClaimReview from './pages/company/ClaimReview';

// ---------- Placeholder (build next) ----------

function NotFound() {
  return <div className="p-8 text-slate-300">Page not found.</div>;
}

// ---------- Route guard ----------
// Wraps a page and redirects to /login if not authenticated, or away from
// pages that don't match the user's role.

function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// ---------- Handles "/" ----------
// Logged-out visitors see the marketing page directly.
// Logged-in visitors redirect to their role's home.
function RoleHomeRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  }

  if (!user) return <Landing />;

  if (role === 'customer') return <Navigate to="/customer/claims" replace />;
  if (role === 'company_admin') return <Navigate to="/company/dashboard" replace />;
  if (role === 'super_admin') return <Navigate to="/admin/dashboard" replace />;

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950">
          <Routes>
            {/* Public */}
            <Route path="/welcome" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Root: Landing for logged-out visitors, role-redirect for logged-in */}
            <Route path="/" element={<RoleHomeRedirect />} />

            {/* Customer routes */}
            <Route
              path="/customer/claims"
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <CustomerClaimsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/claims/:claimId"
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <ClaimDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/start-claim"
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <StartClaim />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer/connect-insurer"
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <ConnectInsurer />
                </ProtectedRoute>
              }
            />

            {/* Insurance company routes */}
            <Route
              path="/company/dashboard"
              element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <CompanyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/claims/:claimId"
              element={
                <ProtectedRoute allowedRoles={['company_admin']}>
                  <ClaimReview />
                </ProtectedRoute>
              }
            />

            {/* Super admin routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
