"use server";

import { redirect } from "next/navigation";
import { registrarAuditoria } from "@/lib/audit";
import { avisarInvitacion } from "@/lib/email/avisos";
import { conRedDeSeguridad } from "@/lib/errores";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";
import { enlaceInvitacion, hashearToken, pareceToken } from "@/lib/tokens";
import { invitacionPorMailSchema } from "@/lib/validation/rental";

export type EstadoInvitacionMail =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; para: string };

/**
 * Manda el link de invitación por mail desde el servidor.
 *
 * El token viaja desde el cliente porque en la base solo vive su hash: no se
 * puede reconstruir el link. Antes de mandar nada verificamos que ese token
 * sea de una invitación viva de un alquiler de quien lo pide, así nadie puede
 * usar nuestro remitente para mandar a cualquier lado lo que se le ocurra.
 */
export async function enviarInvitacionPorMail(
  anterior: EstadoInvitacionMail,
  formData: FormData,
): Promise<EstadoInvitacionMail> {
  return conRedDeSeguridad(
    "enviarInvitacionPorMail",
    () => mandarInvitacion(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function mandarInvitacion(
  _anterior: EstadoInvitacionMail,
  formData: FormData,
): Promise<EstadoInvitacionMail> {
  const parsed = invitacionPorMailSchema.safeParse({
    rental_id: formData.get("rental_id"),
    token: formData.get("token"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { estado: "error", mensaje: parsed.error.issues[0]!.message };
  }

  const { rental_id: rentalId, token, email } = parsed.data;
  if (!pareceToken(token)) {
    return { estado: "error", mensaje: "Este link ya no sirve. Generá uno nuevo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/ingresar?volver_a=/alquileres/${rentalId}`);

  const limite = await consumirIntento("invitacion", await identificadorCliente());
  if (!limite.permitido) return { estado: "error", mensaje: MENSAJE_LIMITE };

  // RLS ya limita a los alquileres propios; además tiene que ser de quien invita.
  const { data: alquiler } = await supabase
    .from("rentals")
    .select("id, neighborhood_label, status, created_by")
    .eq("id", rentalId)
    .maybeSingle();

  if (!alquiler || alquiler.created_by !== user.id || alquiler.status !== "pending") {
    return { estado: "error", mensaje: "Este alquiler ya no está esperando que lo confirmen." };
  }

  const { data: invitacion } = await supabase
    .from("invitations")
    .select("id, invited_role, expires_at")
    .eq("rental_id", rentalId)
    .eq("token_hash", hashearToken(token))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (!invitacion || new Date(invitacion.expires_at) <= new Date()) {
    return { estado: "error", mensaje: "Ese link venció o se reemplazó. Generá uno nuevo." };
  }

  const salio = await avisarInvitacion({
    para: email,
    quienId: user.id,
    barrio: alquiler.neighborhood_label,
    rol: invitacion.invited_role as "owner" | "tenant",
    url: enlaceInvitacion(token),
    rentalId,
  });

  if (!salio) {
    return {
      estado: "error",
      mensaje: "No pudimos mandar el mail. Copiá el link de acá arriba y mandáselo vos.",
    };
  }

  await registrarAuditoria({
    actorId: user.id,
    action: "invitacion.enviada_por_mail",
    entityType: "rental",
    entityId: rentalId,
  });

  return { estado: "listo", para: email };
}
