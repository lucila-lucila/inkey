"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { conRedDeSeguridad, registrarFalla } from "@/lib/errores";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { claveDeMensajeResena } from "@/lib/domain/mensajes";
import { resenaSchema } from "@/lib/validation/resena";
import { avisarFinDeContrato } from "@/lib/email/avisos";
import { createClient } from "@/lib/supabase/server";

export type EstadoFin = { estado: "inicial" } | { estado: "error"; mensaje: string };

type Respuesta = { ok: boolean; error?: string; publicada?: boolean };

function mensajeDe(error: string | undefined, porDefecto: string): string {
  return claveDeMensajeResena(error, porDefecto);
}

/** Una función por cada paso del fin de contrato: proponer, confirmar, cancelar. */
async function llamarRpc(
  nombre: "rental_request_end" | "rental_confirm_end" | "rental_cancel_end",
  rentalId: string,
  porDefecto: string,
): Promise<EstadoFin> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/ingresar?volver_a=/alquileres/${rentalId}`);

  const { data, error } = await supabase.rpc(nombre, { p_rental_id: rentalId });

  if (error) {
    const ref = registrarFalla(`${nombre}`, error);
    return {
      estado: "error",
      mensaje: `${porDefecto} Probá de nuevo en un momento. Si sigue pasando, pasanos este código: ${ref}`,
    };
  }

  const respuesta = data as Respuesta;
  if (!respuesta.ok) return { estado: "error", mensaje: mensajeDe(respuesta.error, porDefecto) };

  // Al terminar, los dos reciben la invitación a dejar su reseña.
  if (nombre === "rental_confirm_end") await avisarFinDeContrato(rentalId);

  revalidatePath(`/alquileres/${rentalId}`);
  revalidatePath("/panel");
  return { estado: "inicial" };
}

export async function proponerFin(_anterior: EstadoFin, formData: FormData): Promise<EstadoFin> {
  const rentalId = String(formData.get("rental_id") ?? "");
  return conRedDeSeguridad(
    "proponerFin",
    () => llamarRpc("rental_request_end", rentalId, "No se pudo marcar el fin del contrato."),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

export async function confirmarFin(_anterior: EstadoFin, formData: FormData): Promise<EstadoFin> {
  const rentalId = String(formData.get("rental_id") ?? "");
  return conRedDeSeguridad(
    "confirmarFin",
    () => llamarRpc("rental_confirm_end", rentalId, "No se pudo confirmar el fin del contrato."),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

export async function cancelarFin(_anterior: EstadoFin, formData: FormData): Promise<EstadoFin> {
  const rentalId = String(formData.get("rental_id") ?? "");
  return conRedDeSeguridad(
    "cancelarFin",
    () => llamarRpc("rental_cancel_end", rentalId, "No se pudo dar marcha atrás."),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

export type EstadoResena =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string }
  | { estado: "guardada"; publicada: boolean };

/** Dejar la reseña. Se guarda ya; se muestra cuando corresponde. */
export async function dejarResena(
  anterior: EstadoResena,
  formData: FormData,
): Promise<EstadoResena> {
  return conRedDeSeguridad(
    "dejarResena",
    async () => {
      const parsed = resenaSchema.safeParse({
        rental_id: formData.get("rental_id"),
        texto: String(formData.get("texto") ?? "").trim() || undefined,
        etiquetas: formData.getAll("etiquetas").map(String),
      });

      if (!parsed.success) {
        return { estado: "error" as const, mensaje: parsed.error.issues[0]!.message };
      }

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) redirect(`/ingresar?volver_a=/alquileres/${parsed.data.rental_id}`);

      const limite = await consumirIntento("resena", await identificadorCliente());
      if (!limite.permitido) return { estado: "error" as const, mensaje: MENSAJE_LIMITE };

      const { data, error } = await supabase.rpc("review_submit", {
        p_rental_id: parsed.data.rental_id,
        p_text: parsed.data.texto ?? null,
        p_tags: parsed.data.etiquetas,
      });

      if (error) {
        const ref = registrarFalla("dejarResena: rpc review_submit", error);
        return {
          estado: "error" as const,
          mensaje: `No se pudo guardar tu reseña. Probá de nuevo en un momento. Si sigue pasando, pasanos este código: ${ref}`,
        };
      }

      const respuesta = data as Respuesta;
      if (!respuesta.ok) {
        return {
          estado: "error" as const,
          mensaje: mensajeDe(respuesta.error, "No se pudo guardar tu reseña."),
        };
      }

      revalidatePath(`/alquileres/${parsed.data.rental_id}`);
      revalidatePath("/perfil");
      return { estado: "guardada" as const, publicada: Boolean(respuesta.publicada) };
    },
    (mensaje) => ({ estado: "error", mensaje }),
  );
}
