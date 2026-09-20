import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Cliente con service role: SALTEA RLS.
 * Usalo solo donde no hay otra opción (rate limiting anónimo, cron, borrado de
 * cuenta) y siempre después de verificar la autorización a mano.
 */
export function createAdminClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
