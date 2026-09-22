"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { conRedDeSeguridad, registrarFalla, type EstadoDeError } from "@/lib/errores";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { claveDeMensajePago } from "@/lib/domain/mensajes";
import { notaDueñoSchema } from "@/lib/validation/pago";
import { avisarPagoConfirmado } from "@/lib/email/avisos";
import { urlFirmada } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfirmacion =
  | { estado: "inicial" }
  | EstadoDeError;

type Respuesta = { ok: boolean; error?: string; payment_id?: string };

function mensajeDe(error: string | undefined, porDefecto: string): string {
  return claveDeMensajePago(error, porDefecto);
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
    async (): Promise<EstadoConfirmacion> => {
      const pagoId = String(formData.get("pago_id") ?? "");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) redirect(`/ingresar?volver_a=/pagos/${pagoId}`);

      const limite = await consumirIntento("confirmacion_pago", await identificadorCliente());
      if (!limite.permitido) return { estado: "error" as const, mensaje: MENSAJE_LIMITE };

      const { data, error } = await supabase.rpc("payment_confirm", { p_payment_id: pagoId });

      if (error) {
        const ref = registrarFalla("confirmarPago: rpc payment_confirm", error);
        return {
          estado: "error" as const,
          mensaje: "errores.reintentarConCodigo",
          antes: { mensaje: "errores.confirmarPago" },
          ref,
        };
      }

      const respuesta = data as Respuesta;
      if (!respuesta.ok) {
        return {
          estado: "error" as const,
          mensaje: mensajeDe(respuesta.error, "errores.confirmarPago"),
        };
      }

      await avisarPagoConfirmado(pagoId);

      revalidatePath(`/pagos/${pagoId}`);
      revalidatePath("/panel");
      return { estado: "inicial" as const };
    },
    (mensaje, ref): EstadoConfirmacion => ({ estado: "error", mensaje, ref }),
  );
}

/** "Todavía no me llegó", con una nota opcional para la otra parte. */
export async function marcarNoRecibido(
  anterior: EstadoConfirmacion,
  formData: FormData,
): Promise<EstadoConfirmacion> {
  return conRedDeSeguridad(
    "marcarNoRecibido",
    async (): Promise<EstadoConfirmacion> => {
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

      const limite = await consumirIntento("confirmacion_pago", await identificadorCliente());
      if (!limite.permitido) return { estado: "error" as const, mensaje: MENSAJE_LIMITE };

      const { data, error } = await supabase.rpc("payment_not_received", {
        p_payment_id: pagoId,
        p_note: nota.data ?? null,
      });

      if (error) {
        const ref = registrarFalla("marcarNoRecibido: rpc payment_not_received", error);
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
          mensaje: mensajeDe(respuesta.error, "errores.guardar"),
        };
      }

      revalidatePath(`/pagos/${pagoId}`);
      revalidatePath("/panel");
      return { estado: "inicial" as const };
    },
    (mensaje, ref): EstadoConfirmacion => ({ estado: "error", mensaje, ref }),
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
  if (!user) return { error: "errores.entraDeNuevoComprobante" };

  // Si no sos parte del alquiler, RLS no devuelve la fila.
  const { data: pago } = await supabase
    .from("payments")
    .select("receipt_path")
    .eq("id", pagoId)
    .maybeSingle();

  if (!pago?.receipt_path) return { error: "errores.sinComprobante" };

  const url = await urlFirmada(pago.receipt_path, 60);
  return url ? { url } : { error: "errores.abrirComprobante" };
}
