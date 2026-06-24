// src/pages/customer/StartClaim.jsx
//
// PET.RA Claims AI — Claim Submission Flow (Customer)
//
// Step 3 offers a real live camera capture experience (CameraCapture
// component) alongside a file-picker fallback for devices/browsers where
// camera access isn't available or the customer prefers picking existing
// photos.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, uploadClaimPhoto } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import CameraCapture from '../../components/CameraCapture';

const INCIDENT_TYPES = [
  { value: 'collision', label: 'Collision' },
  { value: 'theft', label: 'Theft' },
  { value: 'fire', label: 'Fire' },
  { value: 'flood', label: 'Flood' },
  { value: 'other', label: 'Other' },
];

const SUGGESTED_ANGLES = ['front', 'rear', 'left', 'right', 'damage_closeup'];

export default function StartClaim() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [policies, setPolicies] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);

  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [gps, setGps] = useState({ lat: null, lng: null });
  const [gpsError, setGpsError] = useState('');

  const [photos, setPhotos] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  const claimIdRef = useRef(null);

  useEffect(() => {
    async function loadPolicies() {
      const { data, error } = await supabase
        .from('policies')
        .select('id, policy_number, company_id, companies(name, logo_url)')
        .eq('customer_id', user.id)
        .eq('status', 'active');

      if (!error && data) setPolicies(data);
      setLoadingPolicies(false);
    }
    loadPolicies();
  }, [user.id]);

  const captureGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError('');
      },
      () => setGpsError('Could not get GPS location. You can still submit without it.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map((file, idx) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      angleLabel: SUGGESTED_ANGLES[photos.length + idx] || 'additional',
      uploaded: false,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  }

  function handleCameraCapture({ file, angleLabel }) {
    setPhotos((prev) => [
      ...prev,
      { file, previewUrl: URL.createObjectURL(file), angleLabel, uploaded: false },
    ]);
  }

  function removePhoto(index) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateAngleLabel(index, label) {
    setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, angleLabel: label } : p)));
  }

  async function ensureClaimExists(policy) {
    if (claimIdRef.current) return claimIdRef.current;

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .insert({
        customer_id: user.id,
        company_id: policy.company_id,
        policy_id: policy.id,
        incident_type: incidentType,
        incident_description: incidentDescription,
        incident_gps_lat: gps.lat,
        incident_gps_lng: gps.lng,
        incident_timestamp: new Date().toISOString(),
        device_info: navigator.userAgent,
      })
      .select()
      .single();

    if (claimError) throw claimError;
    claimIdRef.current = claim.id;
    return claim.id;
  }

  async function handleSubmit() {
    setSubmitError('');

    if (!selectedPolicyId || !incidentType || photos.length === 0) {
      setSubmitError('Please complete all steps before submitting.');
      return;
    }

    setSubmitting(true);
    const policy = policies.find((p) => p.id === selectedPolicyId);

    try {
      const claimId = await ensureClaimExists(policy);

      const pending = photos.filter((p) => !p.uploaded);
      setUploadProgress({ done: photos.length - pending.length, total: photos.length });

      for (let i = 0; i < photos.length; i++) {
        if (photos[i].uploaded) continue;

        try {
          const storagePath = await uploadClaimPhoto(user.id, claimId, photos[i].file);
          const { error: mediaError } = await supabase.from('claim_media').insert({
            claim_id: claimId,
            storage_path: storagePath,
            media_type: 'photo',
            angle_label: photos[i].angleLabel,
          });
          if (mediaError) throw mediaError;

          setPhotos((prev) => prev.map((p, idx) => (idx === i ? { ...p, uploaded: true } : p)));
          setUploadProgress((prog) => ({ ...prog, done: prog.done + 1 }));
        } catch (photoErr) {
          console.error(`Photo ${i + 1} failed:`, photoErr);
          throw new Error(
            `Upload failed on photo ${i + 1} of ${photos.length} ("${photos[i].angleLabel}"). ` +
            `Your claim was saved — tap "Submit Claim" again to retry the remaining photos.`
          );
        }
      }

      fetch('/api/analyze-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: claimId }),
      }).catch((err) => console.error('AI analysis trigger failed:', err));

      await supabase.from('notifications').insert({
        recipient_id: user.id,
        claim_id: claimId,
        title: 'Claim submitted',
        message: `Your ${incidentType} claim has been submitted and is being reviewed.`,
      });

      navigate(`/customer/claims/${claimId}`);
    } catch (err) {
      console.error(err);
      setSubmitError(err.message || 'Something went wrong submitting your claim. Please try again.');
      setSubmitting(false);
    }
  }

  if (loadingPolicies) {
    return <div className="px-6 py-12 text-center text-slate-400">Loading your policies...</div>;
  }

  if (policies.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-slate-300 mb-4">You need to connect an insurer before starting a claim.</p>
        <button
          onClick={() => navigate('/customer/connect-insurer')}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium"
        >
          Connect Insurer
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Start a Claim</h1>

      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-4">
          <label className="block text-slate-300 text-sm mb-2">Select your insurer policy</label>
          {policies.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPolicyId(p.id)}
              className={`w-full text-left p-4 rounded-xl border transition ${
                selectedPolicyId === p.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-slate-700 bg-slate-800/50'
              }`}
            >
              <div className="text-white font-medium">{p.companies?.name}</div>
              <div className="text-slate-400 text-sm">Policy: {p.policy_number}</div>
            </button>
          ))}
          <NavButtons onNext={() => setStep(2)} nextDisabled={!selectedPolicyId} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <label className="block text-slate-300 text-sm mb-2">Incident type</label>
          <div className="grid grid-cols-2 gap-2">
            {INCIDENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setIncidentType(t.value)}
                className={`p-3 rounded-xl border text-sm ${
                  incidentType === t.value
                    ? 'border-purple-500 bg-purple-500/10 text-white'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="block text-slate-300 text-sm mb-2 mt-4">What happened?</label>
          <textarea
            value={incidentDescription}
            onChange={(e) => setIncidentDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl bg-slate-800/50 border border-slate-700 p-3 text-white"
            placeholder="Briefly describe the incident..."
          />

          <button onClick={captureGps} className="text-sm text-purple-400 underline">
            {gps.lat ? 'Location captured' : 'Capture current location'}
          </button>
          {gpsError && <p className="text-amber-400 text-sm">{gpsError}</p>}

          <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!incidentType} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <label className="block text-slate-300 text-sm mb-2">Capture evidence photos</label>
          <p className="text-slate-500 text-xs mb-2">
            Aim for front, rear, left, right, and a close-up of damage. More angles = faster review.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowCamera(true)}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium"
            >
              Open camera
            </button>
            <label className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium text-center cursor-pointer">
              Upload from device
              <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
            </label>
          </div>

          {showCamera && (
            <CameraCapture
              onCapture={handleCameraCapture}
              onClose={() => setShowCamera(false)}
            />
          )}

          <div className="grid grid-cols-3 gap-3 mt-4">
            {photos.map((p, idx) => (
              <div key={idx} className="relative">
                <img src={p.previewUrl} alt="" className="w-full h-24 object-cover rounded-lg" />
                <select
                  value={p.angleLabel}
                  onChange={(e) => updateAngleLabel(idx, e.target.value)}
                  className="w-full mt-1 text-xs bg-slate-800 text-slate-300 rounded"
                >
                  {SUGGESTED_ANGLES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                  <option value="additional">additional</option>
                </select>
                <button
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={photos.length === 0} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-white font-medium">Review your claim</h2>
          <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 space-y-2 text-sm">
            <p className="text-slate-400">Insurer: <span className="text-white">{policies.find(p => p.id === selectedPolicyId)?.companies?.name}</span></p>
            <p className="text-slate-400">Incident: <span className="text-white">{incidentType}</span></p>
            <p className="text-slate-400">Photos: <span className="text-white">{photos.length}</span></p>
            <p className="text-slate-400">GPS: <span className="text-white">{gps.lat ? 'Captured' : 'Not captured'}</span></p>
          </div>

          {submitting && uploadProgress.total > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Uploading evidence...</span>
                <span>{uploadProgress.done} of {uploadProgress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {submitError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-red-400 text-sm">{submitError}</p>
            </div>
          )}

          <NavButtons
            onBack={() => setStep(3)}
            onNext={handleSubmit}
            nextLabel={submitting ? 'Submitting...' : submitError ? 'Retry Submit' : 'Submit Claim'}
            nextDisabled={submitting}
          />
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }) {
  return (
    <div className="flex gap-2 mb-8">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-slate-700'}`} />
      ))}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled, nextLabel = 'Next' }) {
  return (
    <div className="flex gap-3 pt-4">
      {onBack && (
        <button onClick={onBack} className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300">
          Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium disabled:opacity-40"
      >
        {nextLabel}
      </button>
    </div>
  );
}
