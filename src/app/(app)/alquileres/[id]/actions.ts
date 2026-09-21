"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { enlaceInvitacion, generarToken, hashearToken } from "@/lib/tokens";
import { BUCKET_DOCUMENTOS, subirDocumento, urlFirmada } from "@/lib/storage";
import { registrarAuditoria } from "@/lib/audit";
import { conRedDeSeguridad, registrarFalla } from "@/lib/errores";
import { MENSAJES_PAGO } from "@/lib/domain/pagos";
import { avisarPagoReportado } from "@/lib/email/avisos";
import { reportePagoSchema } from "@/lib/validation/pago";
import { createClient } from "@/lib/supabase/server";
import { rolInvitado as calcularRolInvitado } from "@/lib/domain/alquiler";

export type EstadoLink =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; url: string; barrio: string; rolInvitado: "owner" | "tenant"; nombre: string };

/**
 * Genera un link nuevo y revoca el anterior. Hace falta cuando el primero se
 * perdió o venció: el token viejo no se puede recuperar, solo reemplazar.
 */
export async function generarNuevoLink(
  anterior: EstadoLink,
  formData: FormData,
): Promise<EstadoLink> {
  return conRedDeSeguridad(
    "generarNuevoLink",
    () => regenerarInvitacion(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function regenerarInvitacion(
  _anterior: EstadoLink,
  formData: FormData,
): Promise<EstadoLink> {
  const rentalId = String(formData.get("rental_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  const limite = await consumirIntento("invitacion", await identificadorCliente());
  if (!limite.permitido) return { estado: "error", mensaje: MENSAJE_LIMITE };

  // RLS ya limita a los alquileres propios; además pedimos que siga pendiente.
  const { data: alquiler } = await supabase
    .from("rentals")
    .select("id, neighborhood_label, status, created_by, tenant_id")
    .eq("id", rentalId)
    .maybeSingle();

  if (!alquiler || alquiler.status !== "pending" || alquiler.created_by !== user.id) {
    return { estado: "error", mensaje: "Este alquiler ya no está esperando que lo confirmen." };
  }

  await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("rental_id", rentalId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const token = generarToken();
  const rol = calcularRolInvitado(alquiler.tenant_id === user.id ? "inquilino" : "propietario");

  const { error } = await supabase.from("invitations").insert({
    rental_id: rentalId,
    invited_role: rol,
    token_hash: hashearToken(token),
    created_by: user.id,
  });

  if (error) {
    console.error("No se pudo regenerar la invitación", error);
    return { estado: "error", mensaje: "No se pudo armar el link. Probá de nuevo en un momento." };
  }

  await registrarAuditoria({
    actorId: user.id,
    action: "invitacion.regenerada",
    entityType: "rental",
    entityId: rentalId,
  });

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath(`/alquileres/${rentalId}`);

  return {
    estado: "listo",
    url: enlaceInvitacion(token),
    barrio: alquiler.neighborhood_label,
    rolInvitado: rol,
    nombre: perfil?.first_name ?? "",
  };
}

/** Cancela un alquiler que todavía nadie confirmó. */
export async function cancelarAlquiler(formData: FormData): Promise<void> {
  const rentalId = String(formData.get("rental_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  // Primero los archivos: si borramos el alquiler, la política de Storage deja
  // de encontrar la fila y quedarían huérfanos para siempre.
  const { data: archivos } = await supabase.storage.from(BUCKET_DOCUMENTOS).list(rentalId);
  if (archivos?.length) {
    await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .remove(archivos.map((archivo) => `${rentalId}/${archivo.name}`));
  }

  // La política solo deja borrar lo propio y todavía sin confirmar.
  const { error } = await supabase.from("rentals").delete().eq("id", rentalId);

  if (error) {
    console.error("No se pudo cancelar el alquiler", error);
    redirect(`/alquileres/${rentalId}?error=cancelar`);
  }

  await registrarAuditoria({
    actorId: user.id,
    action: "alquiler.cancelado",
    entityType: "rental",
    entityId: rentalId,
  });

  revalidatePath("/panel");
  redirect("/panel");
}

/** URL firmada de vida corta para ver el contrato. */
export async function verContrato(rentalId: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Entrá de nuevo para ver el contrato." };

  // Si la persona no es parte del alquiler, RLS no devuelve nada.
  const { data: alquiler } = await supabase
    .from("rentals")
    .select("contract_path")
    .eq("id", rentalId)
    .maybeSingle();

  if (!alquiler?.contract_path) return { error: "Este alquiler no tiene contrato adjunto." };

  const url = await urlFirmada(alquiler.contract_path, 60);
  return url ? { url } : { error: "No se pudo abrir el contrato. Probá de nuevo en un momento." };
}

export type EstadoReporte =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string; campo?: string };

/**
 * El inquilino reporta que pagó. El monto y la fecha los manda él; el
 * vencimiento y la moneda los pone la base a partir del alquiler.
 */
export async function reportarPago(
  anterior: EstadoReporte,
  formData: FormData,
): Promise<EstadoReporte> {
  return conRedDeSeguridad(
    "reportarPago",
    () => guardarReporteDePago(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function guardarReporteDePago(
  _anterior: EstadoReporte,
  formData: FormData,
): Promise<EstadoReporte> {
  const parsed = reportePagoSchema.safeParse({
    rental_id: formData.get("rental_id"),
    period: formData.get("period"),
    amount: formData.get("amount"),
    paid_on: formData.get("paid_on"),
  });

  if (!parsed.success) {
    const problema = parsed.error.issues[0]!;
    return { estado: "error", mensaje: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/ingresar?volver_a=/alquileres/${parsed.data.rental_id}`);

  const limite = await consumirIntento("reporte_pago", await identificadorCliente());
  if (!limite.permitido) return { estado: "error", mensaje: MENSAJE_LIMITE };

  // El comprobante es opcional: si falla la subida lo decimos, pero no
  // perdemos el reporte.
  let comprobante: { ruta: string; tipo: string; tamanio: number } | null = null;
  let avisoArchivo: string | undefined;
  const archivo = formData.get("comprobante");

  if (archivo instanceof File && archivo.size > 0) {
    const subida = await subirDocumento({
      rentalId: parsed.data.rental_id,
      archivo,
      prefijo: `comprobante-${parsed.data.period.slice(0, 7)}`,
    });
    if (subida.ok) {
      comprobante = { ruta: subida.ruta, tipo: archivo.type, tamanio: archivo.size };
    } else {
      avisoArchivo = subida.mensaje;
    }
  }

  const { data, error } = await supabase.rpc("payment_report", {
    p_rental_id: parsed.data.rental_id,
    p_period: parsed.data.period,
    p_amount: parsed.data.amount,
    p_paid_on: parsed.data.paid_on,
    p_receipt_path: comprobante?.ruta ?? null,
    p_receipt_mime: comprobante?.tipo ?? null,
    p_receipt_size_bytes: comprobante?.tamanio ?? null,
  });

  if (error) {
    const ref = registrarFalla("reportarPago: rpc payment_report", error);
    return {
      estado: "error",
      mensaje: `No se pudo guardar el pago. Probá de nuevo en un momento. Si sigue pasando, pasanos este código: ${ref}`,
    };
  }

  const respuesta = data as { ok: boolean; error?: string; payment_id?: string };
  if (!respuesta.ok) {
    return {
      estado: "error",
      mensaje: (respuesta.error && MENSAJES_PAGO[respuesta.error]) ?? "No se pudo guardar el pago.",
    };
  }

  // El aviso va después de guardar: si el mail falla, el pago ya está.
  await avisarPagoReportado(String(respuesta.payment_id));

  if (avisoArchivo) {
    // El pago quedó reportado: lo único que falló fue el archivo.
    return {
      estado: "error",
      mensaje: `${avisoArchivo} El pago quedó reportado igual: podés adjuntar el comprobante desde el pago.`,
    };
  }

  revalidatePath(`/alquileres/${parsed.data.rental_id}`);
  revalidatePath("/panel");
  redirect(`/pagos/${respuesta.payment_id}`);
}

export type EstadoContrato =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo" };

export async function subirContrato(
  anterior: EstadoContrato,
  formData: FormData,
): Promise<EstadoContrato> {
  return conRedDeSeguridad(
    "subirContrato",
    () => guardarContrato(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function guardarContrato(
  _anterior: EstadoContrato,
  formData: FormData,
): Promise<EstadoContrato> {
  const rentalId = String(formData.get("rental_id") ?? "");
  const archivo = formData.get("contrato");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { estado: "error", mensaje: "Elegí un archivo para subir." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: alquiler } = await supabase
    .from("rentals")
    .select("id")
    .eq("id", rentalId)
    .maybeSingle();

  if (!alquiler) return { estado: "error", mensaje: "No encontramos ese alquiler." };

  const subida = await subirDocumento({ rentalId, archivo, prefijo: "contrato" });
  if (!subida.ok) return { estado: "error", mensaje: subida.mensaje };

  const { error } = await supabase
    .from("rentals")
    .update({ contract_path: subida.ruta })
    .eq("id", rentalId);

  if (error) {
    console.error("No se pudo guardar el contrato", error);
    return { estado: "error", mensaje: "El archivo se subió pero no se pudo guardar. Probá de nuevo en un momento." };
  }

  revalidatePath(`/alquileres/${rentalId}`);
  return { estado: "listo" };
}
