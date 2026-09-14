// ============================================
// VHEOA — Supabase client (loaded from CDN)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { https://sqeoddatsnodwxljlyer.supabase.co, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZW9kZGF0c25vZHd4bGpseWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzkzNzIsImV4cCI6MjEwNDk1NTM3Mn0.NHKEiqo16zp0UPU8dZeghRj-2-YVZ-uMakvE2Tjeogg } = window.VHEOA;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },       // no login in Phase 0–3
  global: { headers: { 'x-application-name': 'vheoa-web' } }
});
