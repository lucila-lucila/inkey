"use server";

import { cookies } from "next/headers";
import { COOKIE_IDIOMA, COOKIE_IDIOMA_MAXIMA_EDAD } from "@/i18n/idioma";
import { estaActivo } from "@/i18n/activos";
import { esIdioma } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda el idioma elegido.
 *
 * La cookie sirve para cualquiera; el perfil, solo si hay sesión, y es lo que
 * hace que la preferencia viaje con la persona a otro dispositivo y que los
 * mails le lleguen en su idioma.
 *
 * Es una preferencia, no una acción crítica: si el guardado falla, la cookie
 * ya quedó puesta y la persona no se entera de nada.
 */
export async function guardarIdioma(idioma: string): Promise<void> {
  // Nadie puede guardar un idioma que hoy está apagado.
  if (!esIdioma(idioma) || !estaActivo(idioma)) return;

  const almacen = await cookies();
  almacen.set(COOKIE_IDIOMA, idioma, {
    path: "/",
    maxAge: COOKIE_IDIOMA_MAXIMA_EDAD,
    sameSite: "lax",
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({ locale: idioma }).eq("id", user.id);
  } catch (error) {
    console.error("No se pudo guardar el idioma en el perfil", error);
  }
}
