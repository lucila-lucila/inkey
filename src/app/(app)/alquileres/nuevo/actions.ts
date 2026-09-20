"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { datosAlquilerSchema } from "@/lib/validation/rental";
import { rolInvitado as calcularRolInvitado } from "@/lib/domain/alquiler";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { enlaceInvitacion, generarToken, hashearToken } from "@/lib/tokens";
import { subirDocumento } from "@/lib/storage";
import { registrarAuditoria } from "@/lib/audit";
import { conRedDeSeguridad, registrarFalla } from "@/lib/errores";
import { createClient } from "@/lib/supabase/server";

export type EstadoNuevoAlquiler =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string; campo?: string }
  | {
      estado: "creado";
      rentalId: string;
      /** El link se muestra una sola vez: de la base guardamos solo el hash. */
      url: string;
      barrio: string;
      rolInvitado: "owner" | "tenant";
      nombre: string;
      avisoArchivo?: string;
    };

export async function crearAlquiler(
  anterior: EstadoNuevoAlquiler,
  formData: FormData,
): Promise<EstadoNuevoAlquiler> {
  return conRedDeSeguridad(
    "crearAlquiler",
    () => guardarAlquiler(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function guardarAlquiler(
  _anterior: EstadoNuevoAlquiler,
  formData: FormData,
): Promise<EstadoNuevoAlquiler> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar?volver_a=/alquileres/nuevo");

  const parsed = datosAlquilerSchema.safeParse({
    rol: formData.get("rol"),
    full_address: formData.get("full_address"),
    neighborhood_label: formData.get("neighborhood_label"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    monthly_amount: formData.get("monthly_amount"),
    currency: formData.get("currency"),
    due_day: formData.get("due_day"),
    adjustment_index: formData.get("adjustment_index"),
    adjustment_every_months: formData.get("adjustment_every_months"),
  });

  if (!parsed.success) {
    const problema = parsed.error.issues[0]!;
    return { estado: "error", mensaje: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const limite = await consumirIntento("invitacion", await identificadorCliente());
  if (!limite.permitido) return { estado: "error", mensaje: MENSAJE_LIMITE };

  const datos = parsed.data;
  const esInquilino = datos.rol === "inquilino";

  const { data: alquiler, error: errorAlta } = await supabase
    .from("rentals")
    .insert({
      tenant_id: esInquilino ? user.id : null,
      owner_id: esInquilino ? null : user.id,
      created_by: user.id,
      neighborhood_label: datos.neighborhood_label,
      full_address: datos.full_address,
      start_date: datos.start_date,
      end_date: datos.end_date ?? null,
      monthly_amount: datos.monthly_amount,
      currency: datos.currency,
      due_day: datos.due_day,
      adjustment_index: datos.adjustment_index ?? null,
      adjustment_every_months: datos.adjustment_every_months ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (errorAlta || !alquiler) {
    const ref = registrarFalla("crearAlquiler: insert en rentals", errorAlta);
    return {
      estado: "error",
      mensaje: `No pudimos guardar el alquiler (${errorAlta?.code ?? "sin código"}). Probá de nuevo; si sigue pasando, pasanos este código: ${ref}`,
    };
  }

  // El contrato es opcional: si falla, el alquiler ya quedó creado y lo
  // decimos en vez de perder todo lo que la persona cargó.
  let avisoArchivo: string | undefined;
  const contrato = formData.get("contrato");
  if (contrato instanceof File && contrato.size > 0) {
    const subida = await subirDocumento({
      rentalId: alquiler.id,
      archivo: contrato,
      prefijo: "contrato",
    });
    if (subida.ok) {
      await supabase.from("rentals").update({ contract_path: subida.ruta }).eq("id", alquiler.id);
    } else {
      avisoArchivo = `${subida.mensaje} El alquiler quedó guardado: podés subir el contrato después.`;
    }
  }

  const token = generarToken();
  const rol = calcularRolInvitado(datos.rol);

  const { error: errorInvitacion } = await supabase.from("invitations").insert({
    rental_id: alquiler.id,
    invited_role: rol,
    token_hash: hashearToken(token),
    created_by: user.id,
  });

  if (errorInvitacion) {
    const ref = registrarFalla("crearAlquiler: insert en invitations", errorInvitacion);
    return {
      estado: "error",
      mensaje: `Guardamos el alquiler, pero no pudimos armar el link de invitación. Abrilo desde el panel y generá el link ahí. Código: ${ref}`,
    };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  await registrarAuditoria({
    actorId: user.id,
    action: "alquiler.creado",
    entityType: "rental",
    entityId: alquiler.id,
    metadata: { rol_invitado: rol },
  });

  revalidatePath("/panel");

  return {
    estado: "creado",
    rentalId: alquiler.id,
    url: enlaceInvitacion(token),
    barrio: datos.neighborhood_label,
    rolInvitado: rol,
    nombre: perfil?.first_name ?? "",
    avisoArchivo,
  };
}
