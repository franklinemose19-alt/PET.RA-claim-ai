// src/pages/customer/ClaimDetail.jsx
//
// PET.RA Claims AI — Customer Claim Tracking Page
//
// Shows claim status, submitted evidence, and AI analysis summary.
// Now uses Supabase Realtime instead of polling: claim status changes
// and the AI result landing both update this page live, with no refresh
// and no fixed timeout giving up after ~40 seconds.

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, getClaimPhotoUrl } from '../../lib/supabase';

const STATUS_LABELS = {
  submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-300' },
  under_review: { label: 'Under Review', color: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300' },
  closed: { label: 'Closed', color: 'bg-slate-500/20 text-slate-300' },
};

export default function ClaimDetail() {
  const { claimId } = useParams();

  const [claim, setClaim] = useState(null);
  const [media, setMedia] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [justUpdated, setJustUpdated] = useState(false);

  const loadClaim = useCallback(async () => {
    const { data: claimData, error: claimError } = await supabase
      .from('claims')
      .select('id, incident_type, incident_description, incident_gps_lat, incident_gps_lng, incident_timestamp, status, adjuster_notes, created_at, companies(name, logo_url)')
      .eq('id', claimId)
      .single();

    if (claimError) {
      setError('Could not load this claim.');
      setLoading(false);
      return;
    }
    setClaim(claimData);

    const { data: mediaData } = await supabase
      .from('claim_media')
      .select('id, storage_path, angle_label')
      .eq('claim_id', claimId);

    if (mediaData) {
      setMedia(mediaData);
      const urls = {};
      for (const m of mediaData) {
        try {
          urls[m.id] = await getClaimPhotoUrl(m.storage_path);
        } catch (e) {
          console.error('Failed to sign photo URL:', e);
        }
      }
      setPhotoUrls(urls);
    }

    const { data: aiData } = await supabase
      .from('ai_results')
      .select('risk_score, damage_severity, confidence_score, missing_evidence, fraud_flag, summary, manual_review_required')
      .eq('claim_id', claimId)
      .maybeSingle();

    setAiResult(aiData);
    setLoading(false);
  }, [claimId]);

  useEffect(() => {
    loadClaim();
  }, [loadClaim]);

  // Realtime: this specific claim's status/notes, and its ai_results row,
  // update live. No more guessing how long to poll for.
  useEffect(() => {
    const channel = supabase
      .channel(`claim-detail:${claimId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'claims', filter: `id=eq.${claimId}` },
        () => {
          pulseUpdated();
          loadClaim();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_results', filter: `claim_id=eq.${claimId}` },
        () => {
          pulseUpdated();
          loadClaim();
        }
      )
      .subscribe();

    function pulseUpdated() {
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 2500);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [claimId, loadClaim]);

  if (loading) {
    return <div className="px-6 py-12 text-center text-slate-400">Loading claim...</div>;
  }

  if (error || !claim) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-red-400 mb-4">{error || 'Claim not found.'}</p>
        <Link to="/customer/claims" className="text-purple-400 underline">Back to my claims</Link>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[claim.status] || STATUS_LABELS.submitted;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Claim Details</h1>
        <div className="flex items-center gap-2">
          {justUpdated && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 animate-pulse">
              Updated
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 space-y-2 text-sm">
        <Row label="Insurer" value={claim.companies?.name} />
        <Row label="Incident type" value={capitalize(claim.incident_type)} />
        <Row label="Description" value={claim.incident_description || '—'} />
        <Row label="Submitted" value={new Date(claim.created_at).toLocaleString()} />
        {claim.incident_gps_lat && (
          <Row label="Location" value={`${claim.incident_gps_lat.toFixed(4)}, ${claim.incident_gps_lng.toFixed(4)}`} />
        )}
      </div>

      <div>
        <h2 className="text-white font-medium mb-3">Evidence ({media.length})</h2>
        <div className="grid grid-cols-3 gap-3">
          {media.map((m) => (
            <div key={m.id} className="relative">
              {photoUrls[m.id] ? (
                <img src={photoUrls[m.id]} alt={m.angle_label} className="w-full h-24 object-cover rounded-lg" />
              ) : (
                <div className="w-full h-24 bg-slate-800 rounded-lg animate-pulse" />
              )}
              <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                {m.angle_label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-blue-950/50 to-purple-950/50 border border-purple-800/30 p-4">
        <h2 className="text-white font-medium mb-3">AI Analysis</h2>

        {!aiResult && (
          <p className="text-slate-400 text-sm">
            Your evidence is being analyzed. This page will update automatically once it's ready.
          </p>
        )}

        {aiResult?.manual_review_required && (
          <p className="text-amber-300 text-sm">
            This claim has been flagged for manual review by your insurer's team.
          </p>
        )}

        {aiResult && !aiResult.manual_review_required && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-4">
              <Stat label="Risk Score" value={aiResult.risk_score ?? '—'} />
              <Stat label="Damage Severity" value={capitalize(aiResult.damage_severity)} />
              <Stat label="Confidence" value={aiResult.confidence_score != null ? `${aiResult.confidence_score}%` : '—'} />
            </div>
            {aiResult.missing_evidence?.length > 0 && (
              <div>
                <p className="text-slate-400 mb-1">Suggested additional evidence:</p>
                <ul className="list-disc list-inside text-slate-300">
                  {aiResult.missing_evidence.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
            <p className="text-slate-300">{aiResult.summary}</p>
          </div>
        )}
      </div>

      {claim.adjuster_notes && (
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
          <h2 className="text-white font-medium mb-2">Note from your insurer</h2>
          <p className="text-slate-300 text-sm">{claim.adjuster_notes}</p>
        </div>
      )}

      <Link to="/customer/claims" className="block text-center text-purple-400 underline text-sm">
        Back to my claims
      </Link>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className="text-white font-medium">{value}</div>
    </div>
  );
}

function capitalize(s) {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
