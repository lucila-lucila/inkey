import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Cliente con service role: SALTEA RLS.
 * Usalo solo donde no hay otra opción (rate limiting anónimo, cron, borrado de
 * cuenta) y siempre después de verificar la autorización a mano.
 *
 * Devuelve null si falta la clave, en vez de tirar: quien lo use decide si eso
 * es fatal o si puede seguir sin él.
 */
export function createAdminClient() {
  const clave = serverEnv.supabaseServiceRoleKey;
  if (!clave) return null;

  return createClient(serverEnv.supabaseUrl, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
