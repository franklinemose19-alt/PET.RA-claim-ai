// api/analyze-claim.js
//
// PET.RA Claims AI — AI Damage Analysis Function
//
// Called from the frontend right after a claim + its media rows are inserted.
// Runs server-side only — uses the Anthropic API key and Supabase
// service_role key, neither of which can ever touch the browser.
//
// Required env vars (Vercel Project Settings -> Environment Variables,
// server-side only — do NOT prefix with VITE_):
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   <- service role, never the anon key here

import { createClient } from '@supabase/supabase-js';

const MAX_IMAGES = 6;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYSTEM_PROMPT = `You are an insurance claims evidence analyst for PET.RA Claims AI.

Your job is to assess the QUALITY, COMPLETENESS, and CONSISTENCY of submitted
claim evidence. You do NOT make coverage or payout decisions. You do NOT
determine fault or liability. You surface signals for a human adjuster to
review — nothing you output is a final decision.

Evaluate:
1. Does the visual evidence match the stated incident type?
2. Is evidence complete for this incident type? (e.g. collision claims
   typically need front/rear/side angles and a close-up of damage; theft
   claims need proof of the item/vehicle and scene context)
3. Are there signs the evidence may not be genuine or original (e.g. visible
   screenshot artifacts, watermarks, stock-photo characteristics, reused
   image inconsistencies)? Do not speculate beyond what is visually evident.
4. Does the GPS/timestamp metadata appear plausible relative to the incident
   description? (You will be given metadata as text, not images.)
5. How severe does the visible damage appear, in plain terms?

You must respond with ONLY valid JSON matching this exact shape, and nothing
else — no preamble, no markdown code fences, no explanation outside the JSON:

{
  "risk_score": <integer 0-100, higher = needs more adjuster scrutiny>,
  "damage_severity": "<minor|moderate|severe|unclear>",
  "confidence_score": <integer 0-100, your confidence in this assessment>,
  "missing_evidence": [<array of short strings describing missing angles/evidence, empty array if none>],
  "fraud_indicators": [<array of short plain-language strings, empty array if none observed>],
  "fraud_flag": <boolean, true only if fraud_indicators is non-empty AND indicators are substantive>,
  "summary": "<2-3 sentence adjuster-facing summary in plain language>"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { claim_id } = req.body;
  if (!claim_id) {
    return res.status(400).json({ error: 'claim_id is required' });
  }

  try {
    // 1. Fetch claim metadata
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('claims')
      .select('id, incident_type, incident_description, incident_gps_lat, incident_gps_lng, incident_timestamp, device_info')
      .eq('id', claim_id)
      .single();

    if (claimError || !claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    // 2. Fetch media rows (capped at MAX_IMAGES)
    const { data: mediaRows, error: mediaError } = await supabaseAdmin
      .from('claim_media')
      .select('id, storage_path, angle_label')
      .eq('claim_id', claim_id)
      .limit(MAX_IMAGES);

    if (mediaError) throw mediaError;

    if (!mediaRows || mediaRows.length === 0) {
      await storeResult(claim_id, fallbackResult('No evidence media found for this claim.'));
      return res.status(200).json({ ok: true, manual_review_required: true });
    }

    // 3. Sign URLs and download images as base64 for the vision call
    const imageBlocks = [];
    for (const row of mediaRows) {
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from('claim-evidence')
        .createSignedUrl(row.storage_path, 300);

      if (signError) {
        console.error(`Failed to sign ${row.storage_path}:`, signError.message);
        continue;
      }

      const imageResp = await fetch(signed.signedUrl);
      if (!imageResp.ok) continue;

      const arrayBuffer = await imageResp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = imageResp.headers.get('content-type') || 'image/jpeg';

      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: contentType, data: base64 },
      });
    }

    if (imageBlocks.length === 0) {
      await storeResult(claim_id, fallbackResult('Evidence media could not be retrieved for analysis.'));
      return res.status(200).json({ ok: true, manual_review_required: true });
    }

    // 4. Build metadata text block
    const metadataText = `
Incident type: ${claim.incident_type}
Customer's description: ${claim.incident_description || '(none provided)'}
GPS: ${claim.incident_gps_lat ?? 'unknown'}, ${claim.incident_gps_lng ?? 'unknown'}
Incident timestamp: ${claim.incident_timestamp || 'unknown'}
Device info: ${claim.device_info || 'unknown'}
Number of evidence photos submitted: ${mediaRows.length}
Photo angle labels: ${mediaRows.map(m => m.angle_label || 'unlabeled').join(', ')}
    `.trim();

    // 5. Call Claude
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: `Claim metadata:\n${metadataText}\n\nAnalyze this claim evidence now.` },
            ],
          },
        ],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      console.error('Claude API error:', errText);
      await storeResult(claim_id, fallbackResult('AI analysis service error — manual review required.'));
      return res.status(200).json({ ok: true, manual_review_required: true });
    }

    const claudeData = await claudeResp.json();
    const textBlock = claudeData.content?.find(b => b.type === 'text');
    const rawText = textBlock?.text || '';

    // 6. Parse + validate JSON
    let parsed = tryParseJson(rawText);
    if (!parsed) {
      await storeResult(claim_id, { ...fallbackResult('AI response could not be parsed — manual review required.'), raw_response: rawText });
      return res.status(200).json({ ok: true, manual_review_required: true });
    }

    const validated = validateAndNormalize(parsed);
    await storeResult(claim_id, { ...validated, raw_response: rawText });

    // 7. Bump status for adjuster priority if high risk/fraud — never auto-approve/reject
    if (validated.fraud_flag || validated.risk_score >= 70) {
      await supabaseAdmin
        .from('claims')
        .update({ status: 'under_review' })
        .eq('id', claim_id)
        .eq('status', 'submitted');
    }

    return res.status(200).json({ ok: true, result: validated });
  } catch (err) {
    console.error('analyze-claim error:', err);
    try {
      await storeResult(claim_id, fallbackResult('Unexpected error during analysis — manual review required.'));
    } catch (innerErr) {
      console.error('Failed to store fallback result:', innerErr);
    }
    return res.status(500).json({ error: 'Analysis failed', manual_review_required: true });
  }
}

function tryParseJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function validateAndNormalize(parsed) {
  const validSeverity = ['minor', 'moderate', 'severe', 'unclear'];
  const riskScore = clampInt(parsed.risk_score, 0, 100, 50);
  const confidenceScore = clampInt(parsed.confidence_score, 0, 100, 0);
  const damageSeverity = validSeverity.includes(parsed.damage_severity) ? parsed.damage_severity : 'unclear';
  const missingEvidence = Array.isArray(parsed.missing_evidence) ? parsed.missing_evidence.map(String) : [];
  const fraudIndicators = Array.isArray(parsed.fraud_indicators) ? parsed.fraud_indicators.map(String) : [];
  const fraudFlag = Boolean(parsed.fraud_flag) && fraudIndicators.length > 0;
  const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 1000) : '';

  return {
    risk_score: riskScore,
    damage_severity: damageSeverity,
    confidence_score: confidenceScore,
    missing_evidence: missingEvidence,
    fraud_indicators: fraudIndicators,
    fraud_flag: fraudFlag,
    summary,
    manual_review_required: false,
  };
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function fallbackResult(summary) {
  return {
    risk_score: null,
    damage_severity: 'unclear',
    confidence_score: 0,
    missing_evidence: [],
    fraud_indicators: [],
    fraud_flag: false,
    summary,
    manual_review_required: true,
  };
}

async function storeResult(claimId, result) {
  const { error } = await supabaseAdmin
    .from('ai_results')
    .upsert({ claim_id: claimId, ...result }, { onConflict: 'claim_id' });
  if (error) throw error;
}
