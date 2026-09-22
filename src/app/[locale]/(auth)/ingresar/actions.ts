"use server";

import { redirect } from "next/navigation";
import { ingresoSchema, rutaInternaSegura } from "@/lib/validation/auth";
import { codigoSchema } from "@/lib/validation/codigo";
import { intencionSegura, type Intencion } from "@/lib/validation/profile";
import { destinoPostIngreso } from "@/lib/auth/destino";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { conRedDeSeguridad, type EstadoDeError } from "@/lib/errores";

export type EstadoIngreso =
  | { estado: "inicial" }
  | { estado: "enviado"; email: string }
  | EstadoDeError;

function urlCallback(volverA: string, intencion: Intencion | null): string {
  const url = new URL("/auth/callback", serverEnv.siteUrl);
  url.searchParams.set("volver_a", volverA);
  // Sobrevive al viaje por el mail para que el onboarding llegue preseleccionado.
  if (intencion) url.searchParams.set("intencion", intencion);
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
    (mensaje, ref) => ({ estado: "error", mensaje, ref }),
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
  const intencion = intencionSegura(String(formData.get("intencion") ?? ""));

  const limite = await consumirIntento("ingreso", await identificadorCliente());
  if (!limite.permitido) {
    return { estado: "error", mensaje: MENSAJE_LIMITE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: urlCallback(volverA, intencion) },
  });

  if (error) {
    console.error("signInWithOtp falló", error);
    return {
      estado: "error",
      mensaje: "ingreso.errorMail",
    };
  }

  return { estado: "enviado", email: parsed.data.email };
}

export type EstadoCodigo =
  | { estado: "inicial" }
  | EstadoDeError;

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
    (mensaje, ref) => ({ estado: "error", mensaje, ref }),
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
  const intencion = intencionSegura(String(formData.get("intencion") ?? ""));

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
      mensaje: "ingreso.errorCodigo",
    };
  }

  redirect(await destinoPostIngreso(volverA, intencion));
}

/** Arranca el ingreso con Google. */
export async function ingresarConGoogle(formData: FormData): Promise<void> {
  const volverA = rutaInternaSegura(String(formData.get("volver_a") ?? ""), "/panel");
  const intencion = intencionSegura(String(formData.get("intencion") ?? ""));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: urlCallback(volverA, intencion) },
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
