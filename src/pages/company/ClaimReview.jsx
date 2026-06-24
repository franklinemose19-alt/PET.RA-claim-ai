// src/pages/company/ClaimReview.jsx
//
// PET.RA Claims AI — Claim Review (Insurance Company side)
//
// Full claim detail for an adjuster: evidence, metadata, AI analysis,
// and action buttons. Added: a manual "Re-run AI Analysis" button to
// cover the case where the original analyze-claim trigger never reached
// the server (e.g. customer lost signal right after submitting), or
// when an adjuster wants a fresh pass after new evidence was added.

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, getClaimPhotoUrl } from '../../lib/supabase';

export default function ClaimReview() {
  const { claimId } = useParams();

  const [claim, setClaim] = useState(null);
  const [media, setMedia] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeMessage, setReanalyzeMessage] = useState('');

  const loadClaim = useCallback(async () => {
    const { data: claimData, error: claimError } = await supabase
      .from('claims')
      .select(`
        id, customer_id, incident_type, incident_description, incident_gps_lat, incident_gps_lng,
        incident_timestamp, device_info, status, adjuster_notes, created_at,
        profiles(full_name, phone),
        policies(policy_number, membership_id)
      `)
      .eq('id', claimId)
      .single();

    if (claimError) {
      setError('Could not load this claim.');
      setLoading(false);
      return;
    }
    setClaim(claimData);
    setNotes(claimData.adjuster_notes || '');

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
      .select('*')
      .eq('claim_id', claimId)
      .maybeSingle();
    setAiResult(aiData);

    setLoading(false);
  }, [claimId]);

  useEffect(() => {
    loadClaim();
  }, [loadClaim]);

  // Realtime: pick up the AI result the moment it lands, whether from the
  // original submission trigger or a manual re-run below.
  useEffect(() => {
    const channel = supabase
      .channel(`claim-review:${claimId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_results', filter: `claim_id=eq.${claimId}` },
        () => {
          loadClaim();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [claimId, loadClaim]);

  async function handleReanalyze() {
    setReanalyzing(true);
    setReanalyzeMessage('');
    setError('');
    try {
      const resp = await fetch('/api/analyze-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: claimId }),
      });

      if (!resp.ok) {
        throw new Error('Analysis request failed. Please try again in a moment.');
      }

      setReanalyzeMessage('Re-analysis complete.');
      await loadClaim();
    } catch (err) {
      console.error(err);
      setReanalyzeMessage('');
      setError(err.message || 'Could not re-run analysis. Check your connection and try again.');
    } finally {
      setReanalyzing(false);
    }
  }

  async function updateStatus(newStatus) {
    setUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from('claims')
        .update({ status: newStatus })
        .eq('id', claimId);
      if (updateError) throw updateError;

      const messages = {
        approved: 'Your claim has been approved.',
        rejected: 'Your claim has been rejected. Contact your insurer for details.',
        under_review: 'Your insurer has requested more information on your claim.',
        closed: 'Your claim has been closed.',
      };
      if (claim?.customer_id && messages[newStatus]) {
        await supabase.from('notifications').insert({
          recipient_id: claim.customer_id,
          claim_id: claimId,
          title: 'Claim status updated',
          message: messages[newStatus],
        });
      }

      await loadClaim();
    } catch (err) {
      console.error(err);
      setError('Failed to update claim status.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const { error: notesError } = await supabase
        .from('claims')
        .update({ adjuster_notes: notes })
        .eq('id', claimId);
      if (notesError) throw notesError;
    } catch (err) {
      console.error(err);
      setError('Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return <div className="px-6 py-12 text-center text-slate-400">Loading claim...</div>;
  }

  if (error && !claim) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/company/dashboard" className="text-purple-400 underline">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Claim Review</h1>
          <p className="text-slate-500 text-sm">{claim.id}</p>
        </div>
        <Link to="/company/dashboard" className="text-slate-400 text-sm underline">
          ← Back to dashboard
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <InfoCard title="Customer">
          <Row label="Name" value={claim.profiles?.full_name} />
          <Row label="Phone" value={claim.profiles?.phone} />
          <Row label="Policy" value={claim.policies?.policy_number} />
        </InfoCard>
        <InfoCard title="Incident">
          <Row label="Type" value={capitalize(claim.incident_type)} />
          <Row label="Time" value={claim.incident_timestamp ? new Date(claim.incident_timestamp).toLocaleString() : '—'} />
          <Row
            label="GPS"
            value={claim.incident_gps_lat ? `${claim.incident_gps_lat.toFixed(4)}, ${claim.incident_gps_lng.toFixed(4)}` : '—'}
          />
        </InfoCard>
      </div>

      {claim.incident_description && (
        <InfoCard title="Customer's description">
          <p className="text-slate-300 text-sm">{claim.incident_description}</p>
        </InfoCard>
      )}

      <div>
        <h2 className="text-white font-medium mb-3">Evidence ({media.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {media.map((m) => (
            <div key={m.id} className="relative">
              {photoUrls[m.id] ? (
                <img src={photoUrls[m.id]} alt={m.angle_label} className="w-full h-32 object-cover rounded-lg" />
              ) : (
                <div className="w-full h-32 bg-slate-800 rounded-lg animate-pulse" />
              )}
              <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                {m.angle_label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-blue-950/50 to-purple-950/50 border border-purple-800/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-medium">AI Analysis</h2>
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing || media.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-300 hover:bg-purple-500/10 disabled:opacity-40"
          >
            {reanalyzing ? 'Analyzing...' : aiResult ? 'Re-run Analysis' : 'Run Analysis'}
          </button>
        </div>

        {reanalyzeMessage && <p className="text-emerald-400 text-xs mb-2">{reanalyzeMessage}</p>}

        {!aiResult && !reanalyzing && (
          <p className="text-slate-400 text-sm">
            No analysis on file yet. This can happen if the original analysis never reached our
            server — use "Run Analysis" above.
          </p>
        )}

        {aiResult?.manual_review_required && (
          <p className="text-amber-300 text-sm mb-2">⚠ Flagged for manual review — AI could not complete a full analysis.</p>
        )}

        {aiResult && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-6">
              <Stat label="Risk Score" value={aiResult.risk_score ?? '—'} danger={aiResult.risk_score >= 70} />
              <Stat label="Damage Severity" value={capitalize(aiResult.damage_severity)} />
              <Stat label="Confidence" value={aiResult.confidence_score != null ? `${aiResult.confidence_score}%` : '—'} />
              <Stat label="Fraud Flag" value={aiResult.fraud_flag ? 'Yes' : 'No'} danger={aiResult.fraud_flag} />
            </div>
            {aiResult.fraud_indicators?.length > 0 && (
              <div>
                <p className="text-red-400 mb-1">Fraud indicators:</p>
                <ul className="list-disc list-inside text-slate-300">
                  {aiResult.fraud_indicators.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
            {aiResult.missing_evidence?.length > 0 && (
              <div>
                <p className="text-slate-400 mb-1">Missing evidence:</p>
                <ul className="list-disc list-inside text-slate-300">
                  {aiResult.missing_evidence.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
            <p className="text-slate-300">{aiResult.summary}</p>
          </div>
        )}
      </div>

      <InfoCard title="Adjuster notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-slate-800/50 border border-slate-700 p-2 text-white text-sm"
          placeholder="Internal notes, visible to the customer..."
        />
        <button
          onClick={saveNotes}
          disabled={savingNotes}
          className="mt-2 px-4 py-1.5 rounded-lg bg-slate-700 text-white text-sm disabled:opacity-50"
        >
          {savingNotes ? 'Saving...' : 'Save Notes'}
        </button>
      </InfoCard>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <ActionButton
          label="Approve"
          color="emerald"
          onClick={() => updateStatus('approved')}
          disabled={updatingStatus || claim.status === 'approved'}
        />
        <ActionButton
          label="Reject"
          color="red"
          onClick={() => updateStatus('rejected')}
          disabled={updatingStatus || claim.status === 'rejected'}
        />
        <ActionButton
          label="Request More Info"
          color="amber"
          onClick={() => updateStatus('under_review')}
          disabled={updatingStatus || claim.status === 'under_review'}
        />
        <ActionButton
          label="Close"
          color="slate"
          onClick={() => updateStatus('closed')}
          disabled={updatingStatus || claim.status === 'closed'}
        />
      </div>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
      <h3 className="text-slate-400 text-xs uppercase mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value || '—'}</span>
    </div>
  );
}

function Stat({ label, value, danger }) {
  return (
    <div>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className={`font-medium ${danger ? 'text-red-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function ActionButton({ label, color, onClick, disabled }) {
  const colors = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    red: 'bg-red-600 hover:bg-red-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    slate: 'bg-slate-700 hover:bg-slate-600',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40 ${colors[color]}`}
    >
      {label}
    </button>
  );
}
