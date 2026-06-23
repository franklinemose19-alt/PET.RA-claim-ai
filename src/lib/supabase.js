// src/lib/supabase.js
//
// PET.RA Claims AI — Supabase client
//
// Required env vars (Vercel Project Settings -> Environment Variables):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
//
// This is the ANON key — safe for the frontend. The service_role key
// never goes in any file under src/. It only lives in serverless
// function env vars (e.g. api/analyze-claim.js).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------- Storage helpers ----------

const CLAIM_EVIDENCE_BUCKET = 'claim-evidence';

/**
 * Uploads a single claim evidence photo.
 * Path convention: {customer_id}/{claim_id}/{filename}
 * Storage RLS policies (coming in a later file) will check path segments
 * against auth.uid(), so don't change this shape without updating those too.
 */
export async function uploadClaimPhoto(customerId, claimId, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const path = `${customerId}/${claimId}/${fileName}`;

  const { error } = await supabase.storage
    .from(CLAIM_EVIDENCE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  return path;
}

/**
 * Generates a signed URL for private claim evidence (valid 1 hour by default).
 * Use this whenever displaying a photo — never assume public access.
 */
export async function getClaimPhotoUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(CLAIM_EVIDENCE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
