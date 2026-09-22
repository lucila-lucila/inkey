"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { conRedDeSeguridad, registrarFalla, type EstadoDeError } from "@/lib/errores";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { avisarPagoConfirmado } from "@/lib/email/avisos";
import { hashearToken, pareceToken } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";
import { notaDueñoSchema } from "@/lib/validation/pago";

export type EstadoDesdeMail = { estado: "inicial" } | EstadoDeError;

type Respuesta = { ok: boolean; error?: string; payment_id?: string };

const MENSAJES: Record<string, string> = {
  inexistente: "Ese link no es válido.",
  usado: "Ese link ya se usó.",
  vencido: "Ese link venció. Entrá a Inkey para responder el pago.",
  ya_confirmado: "Ese pago ya está confirmado.",
};

/**
 * Confirmar desde el mail, sin sesión. El link es la credencial: vale para
 * este pago y nada más, se usa una sola vez y dura poco.
 */
export async function confirmarDesdeMail(
  _anterior: EstadoDesdeMail,
  formData: FormData,
): Promise<EstadoDesdeMail> {
  const token = String(formData.get("token") ?? "");

  return conRedDeSeguridad(
    "confirmarDesdeMail",
    async (): Promise<EstadoDesdeMail> => {
      if (!pareceToken(token)) return { estado: "error" as const, mensaje: MENSAJES.inexistente };

      const limite = await consumirIntento("confirmacion_pago", await identificadorCliente());
      if (!limite.permitido) return { estado: "error" as const, mensaje: MENSAJE_LIMITE };

      const supabase = await createClient();
      const { data, error } = await supabase.rpc("payment_confirm_with_token", {
        p_token_hash: hashearToken(token),
      });

      if (error) {
        const ref = registrarFalla("confirmarDesdeMail", error);
        return {
          estado: "error" as const,
          mensaje: "errores.reintentarConCodigo",
          antes: { mensaje: "errores.confirmar" },
          ref,
        };
      }

      const respuesta = data as Respuesta;
      if (!respuesta.ok) {
        return {
          estado: "error" as const,
          mensaje: MENSAJES[respuesta.error ?? ""] ?? "errores.confirmar",
        };
      }

      if (respuesta.payment_id) await avisarPagoConfirmado(respuesta.payment_id);
      revalidatePath("/panel");
      redirect(`/pagos/confirmar/${token}?resultado=confirmado`);
    },
    (mensaje, ref): EstadoDesdeMail => ({ estado: "error", mensaje, ref }),
  );
}

/** "Todavía no me llegó", también desde el mail. */
export async function noRecibidoDesdeMail(
  _anterior: EstadoDesdeMail,
  formData: FormData,
): Promise<EstadoDesdeMail> {
  const token = String(formData.get("token") ?? "");

  return conRedDeSeguridad(
    "noRecibidoDesdeMail",
    async (): Promise<EstadoDesdeMail> => {
      if (!pareceToken(token)) return { estado: "error" as const, mensaje: MENSAJES.inexistente };

      const nota = notaDueñoSchema.safeParse(formData.get("nota") ?? undefined);
      if (!nota.success) {
        return { estado: "error" as const, mensaje: nota.error.issues[0]!.message };
      }

      const supabase = await createClient();
      const { data, error } = await supabase.rpc("payment_not_received_with_token", {
        p_token_hash: hashearToken(token),
        p_note: nota.data ?? null,
      });

      if (error) {
        const ref = registrarFalla("noRecibidoDesdeMail", error);
        return {
          estado: "error" as const,
          mensaje: "errores.reintentarConCodigo",
          antes: { mensaje: "errores.guardar" },
          ref,
        };
      }

      const respuesta = data as Respuesta;
      if (!respuesta.ok) {
        return {
          estado: "error" as const,
          mensaje: MENSAJES[respuesta.error ?? ""] ?? "errores.guardar",
        };
      }

      revalidatePath("/panel");
      redirect(`/pagos/confirmar/${token}?resultado=no_recibido`);
    },
    (mensaje, ref): EstadoDesdeMail => ({ estado: "error", mensaje, ref }),
  );
}
