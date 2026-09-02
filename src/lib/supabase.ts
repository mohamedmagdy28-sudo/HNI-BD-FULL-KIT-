// Supabase client factory. The anon key + URL ship in the bundle by design
// (Supabase's model); security lives in RLS policies, not key secrecy.
// Both env vars absent → null → the app runs in localStorage mode exactly
// as before accounts existed (dev, unit tests, and the Playwright matrix).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  client = url && key ? createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true } }) : null;
  return client;
}
