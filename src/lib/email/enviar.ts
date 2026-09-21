import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarToken, hashearToken } from "@/lib/tokens";
import { serverEnv } from "@/lib/env";
import { createEmailClient, remitente, respuestaA } from "./cliente";
import type { Mail } from "./plantillas";

/*
 * Mandar un mail es una tarea secundaria: si Resend no está configurado o
 * falla, se registra y la app sigue. Nunca tira una excepción hacia afuera.
 */

export type EnvioPedido = {
  tipo: string;
  para: string;
  /** Lo que impide mandar dos veces el mismo aviso. */
  dedupeKey: string;
  mail: Mail;
  rentalId?: string | null;
  paymentId?: string | null;
  destinatarioId?: string | null;
};

export async function enviarMail(pedido: EnvioPedido): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    if (!supabase) {
      console.warn(`[inkey] Sin service role no se pueden mandar mails (${pedido.tipo}).`);
      return false;
    }

    // Reserva: si ya se mandó este aviso, no se manda de nuevo.
    const { data: reservado, error: errorReserva } = await supabase.rpc("notification_claim", {
      p_dedupe_key: pedido.dedupeKey,
      p_type: pedido.tipo,
      p_rental_id: pedido.rentalId ?? null,
      p_payment_id: pedido.paymentId ?? null,
      p_recipient_id: pedido.destinatarioId ?? null,
      p_recipient_email: pedido.para,
    });

    if (errorReserva) {
      console.error("No se pudo reservar el aviso", errorReserva);
      return false;
    }
    if (!reservado) return false;

    const resend = createEmailClient();
    if (!resend) {
      console.warn(`[inkey] RESEND_API_KEY no está configurada: no salió el mail ${pedido.tipo}.`);
      await supabase.rpc("notification_settle", {
        p_dedupe_key: pedido.dedupeKey,
        p_error: "sin configurar",
      });
      return false;
    }

    const responder = respuestaA();
    const { error } = await resend.emails.send({
      from: remitente(),
      to: pedido.para,
      ...(responder ? { replyTo: responder } : {}),
      subject: pedido.mail.asunto,
      html: pedido.mail.html,
      text: pedido.mail.texto,
    });

    await supabase.rpc("notification_settle", {
      p_dedupe_key: pedido.dedupeKey,
      p_error: error ? error.message : null,
    });

    if (error) {
      console.error(`No se pudo mandar el mail ${pedido.tipo}`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`El envío de ${pedido.tipo} falló de forma inesperada`, error);
    return false;
  }
}

/** El mail de una persona. Vive en auth, no en nuestras tablas. */
export async function mailDe(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const supabase = createAdminClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      console.error("No se pudo buscar el mail de la persona", error);
      return null;
    }
    return data.user?.email ?? null;
  } catch (error) {
    console.error("La búsqueda del mail falló", error);
    return null;
  }
}

/**
 * El link firmado que confirma UN pago desde el mail.
 * Guardamos solo el hash; el token vive en el link y se usa una sola vez.
 */
export async function crearLinkDePago(
  paymentId: string,
  horas = 72,
): Promise<{ confirmar: string; noRecibido: string } | null> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return null;

    const token = generarToken();
    const { error } = await supabase.from("action_tokens").insert({
      id: randomUUID(),
      token_hash: hashearToken(token),
      purpose: "confirm_payment",
      payment_id: paymentId,
      expires_at: new Date(Date.now() + horas * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
      console.error("No se pudo crear el link del pago", error);
      return null;
    }

    const base = new URL(`/pagos/confirmar/${token}`, serverEnv.siteUrl).toString();
    return { confirmar: base, noRecibido: `${base}?respuesta=no` };
  } catch (error) {
    console.error("La creación del link del pago falló", error);
    return null;
  }
}
