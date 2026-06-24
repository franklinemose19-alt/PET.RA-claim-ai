// src/pages/admin/SuperAdminDashboard.jsx
//
// PET.RA Claims AI — Super Admin: Insurer Verification
//
// Minimal, read-mostly view: list unverified companies, one button to
// verify them. This is the only place is_verified ever flips to true
// through the UI — everything else (RLS, ConnectInsurer search) depends
// on this flag being set correctly.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function SuperAdminDashboard() {
  const { user } = useAuth();

  const [pending, setPending] = useState([]);
  const [verified, setVerified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);

  const loadCompanies = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('companies')
      .select('id, name, business_email, is_verified, created_at, verified_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Could not load companies.');
      setLoading(false);
      return;
    }

    setPending(data.filter((c) => !c.is_verified));
    setVerified(data.filter((c) => c.is_verified));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  async function handleVerify(companyId) {
    setVerifyingId(companyId);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq('id', companyId);

      if (updateError) throw updateError;
      await loadCompanies();
    } catch (err) {
      console.error(err);
      setError('Failed to verify this company. Please try again.');
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleRevoke(companyId) {
    if (!window.confirm('Revoke verification for this company? They will stop appearing in customer searches and lose dashboard access.')) {
      return;
    }
    setVerifyingId(companyId);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update({ is_verified: false, verified_at: null, verified_by: null })
        .eq('id', companyId);

      if (updateError) throw updateError;
      await loadCompanies();
    } catch (err) {
      console.error(err);
      setError('Failed to revoke verification.');
    } finally {
      setVerifyingId(null);
    }
  }

  if (loading) {
    return <div className="px-6 py-12 text-center text-slate-400">Loading companies...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-1">Insurer Verification</h1>
        <p className="text-slate-500 text-sm">
          Only verified companies appear in customer insurer search and can receive claims.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section>
        <h2 className="text-white font-medium mb-3">
          Pending verification {pending.length > 0 && <span className="text-amber-400">({pending.length})</span>}
        </h2>

        {pending.length === 0 ? (
          <p className="text-slate-500 text-sm">No companies awaiting verification.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
              >
                <div>
                  <p className="text-white font-medium">{c.name}</p>
                  <p className="text-slate-500 text-xs">{c.business_email}</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Registered {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleVerify(c.id)}
                  disabled={verifyingId === c.id}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {verifyingId === c.id ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-white font-medium mb-3">Verified companies ({verified.length})</h2>

        {verified.length === 0 ? (
          <p className="text-slate-500 text-sm">No verified companies yet.</p>
        ) : (
          <div className="space-y-2">
            {verified.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-700 bg-slate-800/50"
              >
                <div>
                  <p className="text-white font-medium">{c.name}</p>
                  <p className="text-slate-500 text-xs">{c.business_email}</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Verified {c.verified_at ? new Date(c.verified_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(c.id)}
                  disabled={verifyingId === c.id}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
