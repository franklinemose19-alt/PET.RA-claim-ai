// src/pages/customer/CustomerClaimsList.jsx
//
// PET.RA Claims AI — "My Claims" list (customer home)
//
// Added: real error state (was silently indistinguishable from "no claims"
// before), and Realtime so a status change from the insurer shows up here
// without navigating away and back.

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const STATUS_STYLES = {
  submitted: 'bg-blue-500/20 text-blue-300',
  under_review: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
  closed: 'bg-slate-500/20 text-slate-300',
};

export default function CustomerClaimsList() {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClaims = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('claims')
      .select('id, incident_type, status, created_at, companies(name)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Could not load your claims. Please try again.');
      setLoading(false);
      return;
    }

    setError('');
    setClaims(data || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  // Realtime: status changes from the insurer's side reflect here live.
  useEffect(() => {
    const channel = supabase
      .channel(`customer-claims:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims', filter: `customer_id=eq.${user.id}` },
        () => {
          loadClaims();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, loadClaims]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">My Claims</h1>
        <Link
          to="/customer/start-claim"
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium"
        >
          + Start Claim
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={loadClaims} className="text-purple-400 text-sm underline">
            Try again
          </button>
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 mb-4">You haven't submitted any claims yet.</p>
          <Link
            to="/customer/connect-insurer"
            className="text-purple-400 underline text-sm"
          >
            Connect an insurer to get started
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <Link
              key={claim.id}
              to={`/customer/claims/${claim.id}`}
              className="block p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-purple-500 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium capitalize">{claim.incident_type}</p>
                  <p className="text-slate-400 text-sm">{claim.companies?.name}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[claim.status] || STATUS_STYLES.submitted}`}>
                  {claim.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                {new Date(claim.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
