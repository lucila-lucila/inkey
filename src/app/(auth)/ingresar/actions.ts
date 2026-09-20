"use server";

import { redirect } from "next/navigation";
import { ingresoSchema, rutaInternaSegura } from "@/lib/validation/auth";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type EstadoIngreso =
  | { estado: "inicial" }
  | { estado: "enviado"; email: string }
  | { estado: "error"; mensaje: string };

function urlCallback(volverA: string): string {
  const url = new URL("/auth/callback", serverEnv.siteUrl);
  url.searchParams.set("volver_a", volverA);
  return url.toString();
}

/** Manda el magic link. Nunca revela si el mail ya existe o no. */
export async function enviarMagicLink(
  _anterior: EstadoIngreso,
  formData: FormData,
): Promise<EstadoIngreso> {
  const parsed = ingresoSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { estado: "error", mensaje: parsed.error.issues[0]!.message };
  }

  const volverA = rutaInternaSegura(String(formData.get("volver_a") ?? ""), "/panel");

  const limite = await consumirIntento("ingreso", await identificadorCliente());
  if (!limite.permitido) {
    return { estado: "error", mensaje: MENSAJE_LIMITE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: urlCallback(volverA) },
  });

  if (error) {
    console.error("signInWithOtp falló", error);
    return {
      estado: "error",
      mensaje: "No pudimos mandarte el mail. Esperá un momento y probá de nuevo.",
    };
  }

  return { estado: "enviado", email: parsed.data.email };
}

/** Arranca el ingreso con Google. */
export async function ingresarConGoogle(formData: FormData): Promise<void> {
  const volverA = rutaInternaSegura(String(formData.get("volver_a") ?? ""), "/panel");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: urlCallback(volverA) },
  });

  if (error || !data.url) {
    console.error("signInWithOAuth falló", error);
    redirect("/ingresar?error=google");
  }

  redirect(data.url);
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
