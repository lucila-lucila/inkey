import "server-only";
import {
  anioValido,
  aniosConResumen,
  resumenAnual,
  type PagoDelResumen,
  type ResumenAnual,
} from "@/lib/domain/resumen";
import { nombrePublico } from "@/lib/validation/profile";
import { createClient } from "@/lib/supabase/server";

/*
 * Los datos del resumen anual, una sola vez para la pantalla, el PDF y el CSV.
 *
 * No hay ninguna comprobación de permisos acá: no hace falta. El alquiler se
 * pide con la sesión de la persona, así que si no sos una de las dos partes
 * RLS no devuelve nada y esto termina en 404. Lo mismo con los pagos.
 */

export type DatosDelResumen = {
  resumen: ResumenAnual;
  soyInquilino: boolean;
  barrio: string;
  direccion: string;
  inquilino: string;
  duenio: string;
  /** Años que tienen algo para resumir, del más nuevo al más viejo. */
  anios: number[];
};

export type Cargado =
  | { ok: true; datos: DatosDelResumen }
  | { ok: false; motivo: "sin_sesion" | "no_existe" | "anio_invalido" };

export async function cargarResumen(id: string, anioCrudo: string): Promise<Cargado> {
  const anio = anioValido(anioCrudo);
  if (anio === null) return { ok: false, motivo: "anio_invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "sin_sesion" };

  const { data: alquiler } = await supabase
    .from("rentals")
    .select(
      "id, tenant_id, owner_id, neighborhood_label, full_address, start_date, end_date, due_day",
    )
    .eq("id", id)
    .maybeSingle();
  if (!alquiler) return { ok: false, motivo: "no_existe" };

  const { data: pagos } = await supabase
    .from("payments")
    .select("id, period, status, amount, currency, paid_on, due_date, on_time, receipt_serial")
    .eq("rental_id", id)
    .gte("period", `${anio}-01-01`)
    .lte("period", `${anio}-12-01`);

  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [alquiler.tenant_id, alquiler.owner_id].filter(Boolean) as string[]);

  const nombreDe = (idPersona: string | null) => {
    const perfil = perfiles?.find((fila) => fila.id === idPersona);
    return perfil ? nombrePublico(perfil.first_name ?? "", perfil.last_name ?? "") : "—";
  };

  return {
    ok: true,
    datos: {
      resumen: resumenAnual({
        alquiler,
        anio,
        pagos: (pagos ?? []) as PagoDelResumen[],
      }),
      soyInquilino: alquiler.tenant_id === user.id,
      barrio: alquiler.neighborhood_label,
      direccion: alquiler.full_address,
      inquilino: nombreDe(alquiler.tenant_id),
      duenio: nombreDe(alquiler.owner_id),
      anios: aniosConResumen(alquiler),
    },
  };
}
