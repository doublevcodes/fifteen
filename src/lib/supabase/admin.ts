import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | undefined;

/** Server-only Supabase client (service role). Never import from client components. */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}
