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

/**
 * Cliente sin sesión de nadie: el de un visitante cualquiera.
 *
 * Sirve para comprobar desde el servidor qué puede ver alguien que no entró.
 * No usa las cookies del pedido a propósito: si lo mirara con la sesión de
 * quien abrió la página, diría que todo se ve y sería mentira.
 */
export function createAnonClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
