"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashearToken, pareceToken } from "@/lib/tokens";
import { consumirIntento, identificadorCliente } from "@/lib/ratelimit";
import { avisarRespuestaInvitacion } from "@/lib/email/avisos";
import { createClient } from "@/lib/supabase/server";

type Respuesta = { ok: boolean; error?: string; rental_id?: string };

/** Acepta la invitación y deja a la persona adentro del alquiler. */
export async function aceptarInvitacion(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!pareceToken(token)) redirect("/invitacion/invalido");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/ingresar?volver_a=/invitacion/${token}`);

  const { data, error } = await supabase.rpc("invitation_accept", {
    p_token_hash: hashearToken(token),
  });

  if (error) {
    console.error("invitation_accept falló", error);
    redirect(`/invitacion/${token}?error=servidor`);
  }

  const respuesta = data as Respuesta;
  if (!respuesta.ok) redirect(`/invitacion/${token}?error=${respuesta.error ?? "servidor"}`);

  await avisarRespuestaInvitacion(String(respuesta.rental_id), true);

  revalidatePath("/panel");
  redirect(`/alquileres/${respuesta.rental_id}`);
}

/**
 * "No soy el dueño de esta propiedad."
 * No pedimos sesión: quien recibió el link por error tiene que poder decir que
 * no sin crearse una cuenta.
 */
export async function rechazarInvitacion(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!pareceToken(token)) redirect("/invitacion/invalido");

  const limite = await consumirIntento("invitacion", await identificadorCliente());
  if (!limite.permitido) redirect(`/invitacion/${token}?error=demasiados_intentos`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invitation_reject", {
    p_token_hash: hashearToken(token),
  });

  if (error) {
    console.error("invitation_reject falló", error);
    redirect(`/invitacion/${token}?error=servidor`);
  }

  const respuesta = data as Respuesta;
  if (!respuesta.ok) redirect(`/invitacion/${token}?error=${respuesta.error ?? "servidor"}`);

  if (respuesta.rental_id) await avisarRespuestaInvitacion(respuesta.rental_id, false);

  redirect(`/invitacion/${token}?resultado=rechazada`);
}
