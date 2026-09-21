"use server";

import { redirect } from "next/navigation";
import { ingresoSchema, rutaInternaSegura } from "@/lib/validation/auth";
import { codigoSchema } from "@/lib/validation/codigo";
import { destinoPostIngreso } from "@/lib/auth/destino";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { conRedDeSeguridad } from "@/lib/errores";

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
  anterior: EstadoIngreso,
  formData: FormData,
): Promise<EstadoIngreso> {
  return conRedDeSeguridad(
    "enviarMagicLink",
    () => mandarMagicLink(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function mandarMagicLink(
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
      mensaje: "No se pudo mandar el mail. Probá de nuevo en un momento.",
    };
  }

  return { estado: "enviado", email: parsed.data.email };
}

export type EstadoCodigo =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string };

/**
 * Entrar con el código de 6 dígitos que va en el mismo mail que el link.
 *
 * Existe porque algunos servicios de correo abren los links solos para
 * revisarlos y los gastan antes de que la persona los toque. El código se
 * escribe acá y no depende de que el link sobreviva.
 */
export async function entrarConCodigo(
  anterior: EstadoCodigo,
  formData: FormData,
): Promise<EstadoCodigo> {
  return conRedDeSeguridad(
    "entrarConCodigo",
    () => verificarCodigo(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function verificarCodigo(
  _anterior: EstadoCodigo,
  formData: FormData,
): Promise<EstadoCodigo> {
  const parsed = codigoSchema.safeParse({
    email: formData.get("email"),
    codigo: formData.get("codigo"),
  });

  if (!parsed.success) {
    return { estado: "error", mensaje: parsed.error.issues[0]!.message };
  }

  const volverA = rutaInternaSegura(String(formData.get("volver_a") ?? ""), "/panel");

  // Mismo límite que el link: un código de 6 dígitos no se prueba a mano.
  const limite = await consumirIntento("ingreso", await identificadorCliente());
  if (!limite.permitido) return { estado: "error", mensaje: MENSAJE_LIMITE };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.codigo,
    type: "email",
  });

  if (error) {
    console.error("verifyOtp falló", error.message);
    return {
      estado: "error",
      mensaje: "Ese código no es correcto o ya venció. Revisalo o pedí uno nuevo.",
    };
  }

  redirect(await destinoPostIngreso(volverA));
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
