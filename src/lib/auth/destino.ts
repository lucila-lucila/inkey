import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * A dónde va la persona después de ingresar: si todavía no completó el
 * onboarding, primero el onboarding.
 */
export async function destinoPostIngreso(volverA: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/ingresar";

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name, last_name, accepted_terms_at, accepted_privacy_at, initial_intent")
    .eq("id", user.id)
    .maybeSingle();

  const completo =
    Boolean(perfil?.first_name) &&
    Boolean(perfil?.last_name) &&
    Boolean(perfil?.accepted_terms_at) &&
    Boolean(perfil?.accepted_privacy_at);

  if (!completo) {
    const url = new URL("/onboarding", "http://local");
    if (volverA !== "/panel") url.searchParams.set("volver_a", volverA);
    return `${url.pathname}${url.search}`;
  }

  return volverA;
}
