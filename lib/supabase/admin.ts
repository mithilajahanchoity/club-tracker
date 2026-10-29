import "server-only";
import { createClient } from "@supabase/supabase-js";

// SERVER ONLY. Uses the secret/service_role key, which bypasses RLS.
// The "server-only" import makes the build fail if this file is ever
// imported from a client component. Only call this after checking that
// the caller is a super admin (see requireSuperAdmin in lib/auth.ts).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
