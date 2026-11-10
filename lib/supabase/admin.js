// SERVER ONLY. Uses the service-role key, which bypasses RLS. Import only from route handlers.
import { createClient } from '@supabase/supabase-js';
export function supabaseAdmin() {
  if (typeof window !== 'undefined') throw new Error('supabaseAdmin must never run in the browser');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
