// ============================================
// VHEOA — Supabase client (loaded from CDN)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.VHEOA;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },       // no login in Phase 0–3
  global: { headers: { 'x-application-name': 'vheoa-web' } }
});
