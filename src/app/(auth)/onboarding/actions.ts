"use server";

import { redirect } from "next/navigation";
import { onboardingSchema } from "@/lib/validation/profile";
import { rutaInternaSegura } from "@/lib/validation/auth";
import { registrarAuditoria } from "@/lib/audit";
import { conRedDeSeguridad } from "@/lib/errores";
import { createClient } from "@/lib/supabase/server";

export type EstadoOnboarding =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string; campo?: string };

export async function completarOnboarding(
  anterior: EstadoOnboarding,
  formData: FormData,
): Promise<EstadoOnboarding> {
  return conRedDeSeguridad(
    "completarOnboarding",
    () => guardarOnboarding(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function guardarOnboarding(
  _anterior: EstadoOnboarding,
  formData: FormData,
): Promise<EstadoOnboarding> {
  const parsed = onboardingSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone"),
    intencion: formData.get("intencion"),
    acepta_terminos: formData.get("acepta_terminos"),
    acepta_privacidad: formData.get("acepta_privacidad"),
  });

  if (!parsed.success) {
    const problema = parsed.error.issues[0]!;
    return {
      estado: "error",
      mensaje: problema.message,
      campo: String(problema.path[0] ?? ""),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  const ahora = new Date().toISOString();
  // RLS ya limita el update a la fila propia; el .eq es el segundo cerrojo.
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      phone: parsed.data.phone,
      initial_intent: parsed.data.intencion,
      accepted_terms_at: ahora,
      accepted_privacy_at: ahora,
    })
    .eq("id", user.id);

  if (error) {
    console.error("No se pudo completar el onboarding", error);
    return { estado: "error", mensaje: "No pudimos guardar tus datos. Probá de nuevo." };
  }

  await registrarAuditoria({
    actorId: user.id,
    action: "onboarding.completado",
    entityType: "profile",
    entityId: user.id,
    metadata: { intencion: parsed.data.intencion },
  });

  redirect(rutaInternaSegura(String(formData.get("volver_a") ?? ""), "/panel"));
}
