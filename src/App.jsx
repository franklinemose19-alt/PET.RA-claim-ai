// src/App.tsx
//
// PET.RA Claims AI — Root App Component
//
// Sets up routing and wraps everything in AuthProvider. Route guards check
// `role` from useAuth() — until the insurer dashboard and connect-insurer
// pages exist, their routes point at placeholder components so nothing
// throws a missing-import error.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import StartClaim from './pages/customer/StartClaim';
import ClaimDetail from './pages/customer/ClaimDetail';

// ---------- Placeholder pages (build these next) ----------
function Login() {
  return <div className="p-8 text-slate-300">Login page placeholder.</div>;
}
function ConnectInsurer() {
  return <div className="p-8 text-slate-300">Connect Insurer page placeholder.</div>;
}
function CustomerClaimsList() {
  return <div className="p-8 text-slate-300">My Claims list placeholder.</div>;
}
function CompanyDashboard() {
  return <div className="p-8 text-slate-300">Insurance Company dashboard placeholder.</div>;
}
function SuperAdminDashboard() {
  return <div className="p-8 text-slate-300">Super Admin dashboard placeholder.</div>;
}
function NotFound() {
  return <div className="p-8 text-slate-300">Page not found.</div>;
}

// ---------- Route guard ----------
// Wraps a page and redirects to /login if not authenticated, or away from
// pages that don't match the user's role.
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Array<'customer' | 'company_admin' | 'super_admin'>;
}) {
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

  return <>{children}</>;
}

// ---------- Redirects logged-in users to their role's home ----------
function RoleHomeRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;

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
            <Route path="/login" element={<Login />} />

            {/* Root redirects based on role */}
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
