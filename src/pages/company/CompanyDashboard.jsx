// src/pages/company/CompanyDashboard.jsx
//
// PET.RA Claims AI — Insurance Company Dashboard
//
// Claims list with filters + search. New claims and status/AI-result
// changes for this company now arrive in real time via Supabase Realtime,
// so an adjuster watching the dashboard sees a new claim land without
// refreshing.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Pending' },
  { value: 'under_review', label: 'High Risk / Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_STYLES = {
  submitted: 'bg-blue-500/20 text-blue-300',
  under_review: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
  closed: 'bg-slate-500/20 text-slate-300',
};

export default function CompanyDashboard() {
  const { companyId } = useAuth();

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [newClaimPulse, setNewClaimPulse] = useState(false);

  const loadClaims = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('claims')
      .select(`
        id, incident_type, status, created_at,
        profiles(full_name),
        policies(policy_number),
        ai_results(risk_score, fraud_flag, manual_review_required)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!error && data) setClaims(data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  // Realtime: new claims, status changes, and AI result updates for this
  // company refresh the list automatically. We re-fetch on any change
  // rather than trying to patch individual rows in place, since claims
  // come with joined data (profiles, policies, ai_results) that a single
  // changed row wouldn't include.
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`company-claims:${companyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'claims', filter: `company_id=eq.${companyId}` },
        () => {
          setNewClaimPulse(true);
          setTimeout(() => setNewClaimPulse(false), 3000);
          loadClaims();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'claims', filter: `company_id=eq.${companyId}` },
        () => {
          loadClaims();
        }
      )
      .on(
        // ai_results doesn't have company_id directly, so we can't filter
        // server-side here — just refresh on any ai_results insert/update
        // and let loadClaims() re-fetch the correctly scoped set.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_results' },
        () => {
          loadClaims();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, loadClaims]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const claimsToday = claims.filter((c) => new Date(c.created_at).toDateString() === today).length;
    const pending = claims.filter((c) => c.status === 'submitted').length;
    const highRisk = claims.filter((c) => (c.ai_results?.[0]?.risk_score ?? 0) >= 70 || c.ai_results?.[0]?.fraud_flag).length;
    const scores = claims.map((c) => c.ai_results?.[0]?.risk_score).filter((s) => s != null);
    const avgRisk = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { claimsToday, pending, highRisk, avgRisk };
  }, [claims]);

  const filteredClaims = claims.filter((claim) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'under_review' && (claim.status === 'under_review' || claim.ai_results?.[0]?.fraud_flag)) ||
      claim.status === filter;

    const matchesSearch =
      !search ||
      claim.id.toLowerCase().includes(search.toLowerCase()) ||
      claim.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      claim.policies?.policy_number?.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Claims Dashboard</h1>
        {newClaimPulse && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 animate-pulse">
            New claim received
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Claims Today" value={stats.claimsToday} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="High Risk" value={stats.highRisk} highlight={stats.highRisk > 0} />
        <StatCard label="Avg Risk Score" value={stats.avgRisk ?? '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                filter === f.value ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by claim ID, customer, or policy..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto flex-1 min-w-[200px] rounded-lg bg-slate-800/50 border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
        />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading claims...</p>
      ) : filteredClaims.length === 0 ? (
        <p className="text-slate-400 text-sm py-12 text-center">No claims match these filters.</p>
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400 text-xs">
              <tr>
                <th className="text-left px-4 py-3">Claim</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Policy</th>
                <th className="text-left px-4 py-3">Risk</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => {
                const ai = claim.ai_results?.[0];
                return (
                  <tr key={claim.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <Link to={`/company/claims/${claim.id}`} className="text-purple-400 hover:underline">
                        {claim.id.slice(0, 8)}…
                      </Link>
                      <div className="text-slate-500 text-xs capitalize">{claim.incident_type}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{claim.profiles?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{claim.policies?.policy_number || '—'}</td>
                    <td className="px-4 py-3">
                      {ai?.risk_score != null ? (
                        <span className={ai.risk_score >= 70 ? 'text-red-400' : ai.risk_score >= 40 ? 'text-amber-400' : 'text-emerald-400'}>
                          {ai.risk_score}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      {ai?.fraud_flag && <span className="ml-1 text-red-400 text-xs">⚠</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[claim.status] || STATUS_STYLES.submitted}`}>
                        {claim.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-red-500/40 bg-red-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}
