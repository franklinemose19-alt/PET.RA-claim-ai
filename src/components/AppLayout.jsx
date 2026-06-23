// src/components/AppLayout.jsx
//
// PET.RA Claims AI — Shared Authenticated Layout
//
// Wraps every logged-in page (customer, company, admin) with a consistent
// header: logo, notification bell, role-aware nav links, logout. Mount this
// inside ProtectedRoute so it only ever shows for authenticated users.

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function AppLayout({ children }) {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/welcome');
  }

  const homeLink =
    role === 'customer' ? '/customer/claims' :
    role === 'company_admin' ? '/company/dashboard' :
    role === 'super_admin' ? '/admin/dashboard' :
    '/';

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-white/5 sticky top-0 z-40 backdrop-blur-md bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={homeLink} className="font-mono text-sm tracking-wide text-white">
            PET<span className="text-[#E8A33D]">.</span>RA
            <span className="text-slate-500 ml-2 text-xs hidden sm:inline">CLAIMS AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            {role === 'customer' && (
              <>
                <Link to="/customer/claims" className="hover:text-white transition">My Claims</Link>
                <Link to="/customer/connect-insurer" className="hover:text-white transition">Connect Insurer</Link>
              </>
            )}
            {role === 'company_admin' && (
              <Link to="/company/dashboard" className="hover:text-white transition">Dashboard</Link>
            )}
            {role === 'super_admin' && (
              <Link to="/admin/dashboard" className="hover:text-white transition">Admin</Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:block text-right">
              <p className="text-white text-sm leading-tight">{profile?.full_name || 'Account'}</p>
              <p className="text-slate-500 text-xs leading-tight capitalize">{role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
