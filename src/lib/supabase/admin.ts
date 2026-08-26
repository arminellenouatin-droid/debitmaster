// DebitManager: service-role client for signed provider webhooks only. Never import this module in client components.
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serverKey) throw new Error("Configuration Supabase serveur absente.");
  return createClient(url, serverKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
