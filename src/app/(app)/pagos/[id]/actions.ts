"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { conRedDeSeguridad, registrarFalla } from "@/lib/errores";
import { MENSAJES_PAGO } from "@/lib/domain/pagos";
import { notaDueñoSchema } from "@/lib/validation/pago";
import { avisarPagoConfirmado } from "@/lib/email/avisos";
import { urlFirmada } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfirmacion =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string };

type Respuesta = { ok: boolean; error?: string; payment_id?: string };

function mensajeDe(error: string | undefined, porDefecto: string): string {
  return (error && MENSAJES_PAGO[error]) ?? porDefecto;
}

/**
 * "Recibido". Quien puede hacerlo es únicamente el dueño del alquiler, y eso
 * lo verifica la función en la base, no esta pantalla.
 */
export async function confirmarPago(
  anterior: EstadoConfirmacion,
  formData: FormData,
): Promise<EstadoConfirmacion> {
  return conRedDeSeguridad(
    "confirmarPago",
    async () => {
      const pagoId = String(formData.get("pago_id") ?? "");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) redirect(`/ingresar?volver_a=/pagos/${pagoId}`);

      const { data, error } = await supabase.rpc("payment_confirm", { p_payment_id: pagoId });

      if (error) {
        const ref = registrarFalla("confirmarPago: rpc payment_confirm", error);
        return {
          estado: "error" as const,
          mensaje: `No se pudo confirmar el pago. Probá de nuevo en un momento. Si sigue pasando, pasanos este código: ${ref}`,
        };
      }

      const respuesta = data as Respuesta;
      if (!respuesta.ok) {
        return {
          estado: "error" as const,
          mensaje: mensajeDe(respuesta.error, "No se pudo confirmar el pago."),
        };
      }

      await avisarPagoConfirmado(pagoId);

      revalidatePath(`/pagos/${pagoId}`);
      revalidatePath("/panel");
      return { estado: "inicial" as const };
    },
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

/** "Todavía no me llegó", con una nota opcional para la otra parte. */
export async function marcarNoRecibido(
  anterior: EstadoConfirmacion,
  formData: FormData,
): Promise<EstadoConfirmacion> {
  return conRedDeSeguridad(
    "marcarNoRecibido",
    async () => {
      const pagoId = String(formData.get("pago_id") ?? "");
      const nota = notaDueñoSchema.safeParse(formData.get("nota") ?? undefined);

      if (!nota.success) {
        return { estado: "error" as const, mensaje: nota.error.issues[0]!.message };
      }

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) redirect(`/ingresar?volver_a=/pagos/${pagoId}`);

      const { data, error } = await supabase.rpc("payment_not_received", {
        p_payment_id: pagoId,
        p_note: nota.data ?? null,
      });

      if (error) {
        const ref = registrarFalla("marcarNoRecibido: rpc payment_not_received", error);
        return {
          estado: "error" as const,
          mensaje: `No se pudo guardar. Probá de nuevo en un momento. Si sigue pasando, pasanos este código: ${ref}`,
        };
      }

      const respuesta = data as Respuesta;
      if (!respuesta.ok) {
        return {
          estado: "error" as const,
          mensaje: mensajeDe(respuesta.error, "No se pudo guardar."),
        };
      }

      revalidatePath(`/pagos/${pagoId}`);
      revalidatePath("/panel");
      return { estado: "inicial" as const };
    },
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

/** URL firmada de un minuto para ver el comprobante. */
export async function verComprobante(
  pagoId: string,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Entrá de nuevo para ver el comprobante." };

  // Si no sos parte del alquiler, RLS no devuelve la fila.
  const { data: pago } = await supabase
    .from("payments")
    .select("receipt_path")
    .eq("id", pagoId)
    .maybeSingle();

  if (!pago?.receipt_path) return { error: "Este pago no tiene comprobante adjunto." };

  const url = await urlFirmada(pago.receipt_path, 60);
  return url ? { url } : { error: "No se pudo abrir el comprobante. Probá de nuevo en un momento." };
}
