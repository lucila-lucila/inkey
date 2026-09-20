"use server";

import { waitlistSchema } from "@/lib/validation/waitlist";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoLista =
  | { estado: "inicial" }
  | { estado: "ok"; rol: "inquilino" | "propietario" }
  | { estado: "error"; mensaje: string };

/**
 * Alta en la lista de espera. Escribe con service role porque la tabla no es
 * accesible desde el cliente: así la lista de mails no se puede enumerar.
 */
export async function sumarseALista(
  _anterior: EstadoLista,
  formData: FormData,
): Promise<EstadoLista> {
  // Trampa para bots: si viene completo, fingimos éxito y no guardamos nada.
  if (String(formData.get("bot-field") ?? "").length > 0) {
    return { estado: "ok", rol: "inquilino" };
  }

  const parsed = waitlistSchema.safeParse({
    email: formData.get("email"),
    rol: formData.get("rol"),
  });

  if (!parsed.success) {
    return {
      estado: "error",
      mensaje: parsed.error.issues[0]?.message ?? "Revisá los datos e intentá de nuevo.",
    };
  }

  try {
    const limite = await consumirIntento("lista_espera", await identificadorCliente());
    if (!limite.permitido) {
      return { estado: "error", mensaje: MENSAJE_LIMITE };
    }

    const supabase = createAdminClient();
    if (!supabase) {
      console.error(
        "[inkey] Falta SUPABASE_SERVICE_ROLE_KEY: no se puede guardar en la lista de espera.",
      );
      return {
        estado: "error",
        mensaje: "No se pudo guardar tu mail. Probá de nuevo en un rato.",
      };
    }

    const { error } = await supabase
      .from("waitlist_signups")
      .upsert(
        { email: parsed.data.email, role: parsed.data.rol },
        { onConflict: "email" },
      );

    if (error) {
      console.error("No se pudo guardar en la lista de espera", error);
      return {
        estado: "error",
        mensaje: "No se pudo guardar tu mail. Revisá tu conexión y probá de nuevo.",
      };
    }

    return { estado: "ok", rol: parsed.data.rol };
  } catch (error) {
    console.error("Lista de espera: fallo inesperado", error);
    return {
      estado: "error",
      mensaje: "No se pudo guardar tu mail. Revisá tu conexión y probá de nuevo.",
    };
  }
}
