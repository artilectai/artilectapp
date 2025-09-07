// lib/supabase/admin.ts
import { createServerClient } from '@supabase/ssr';

// Creates a Supabase client using the Service Role key (server only)
// RLS is bypassed, so always set explicit user_id fields.
export function supabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase admin not configured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  // createServerClient requires cookie handlers; provide no-ops for server-side usage
  return createServerClient(url, serviceKey, {
    cookies: {
      get() { return undefined; },
      set() { /* no-op */ },
      remove() { /* no-op */ }
    }
  });
}
