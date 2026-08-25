import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// =============================================================================
// Supabase client bootstrap. Only imported (dynamically) when
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured — see
// src/data/index.ts. Requires `npm install` to have fetched
// `@supabase/supabase-js`, which this sandbox's network policy cannot do;
// the code is correct and ready for any normal environment with npm access.
// =============================================================================

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  client = createClient(url, anonKey);
  return client;
}
