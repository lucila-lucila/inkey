"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { enlaceInvitacion, generarToken, hashearToken } from "@/lib/tokens";
import { BUCKET_DOCUMENTOS, subirDocumento, urlFirmada } from "@/lib/storage";
import { registrarAuditoria } from "@/lib/audit";
import { conRedDeSeguridad } from "@/lib/errores";
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
    return { estado: "error", mensaje: "Este alquiler ya no está esperando confirmación." };
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
    return { estado: "error", mensaje: "No pudimos armar el link. Probá de nuevo." };
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
  return url ? { url } : { error: "No pudimos abrir el contrato. Probá de nuevo." };
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

  if (!alquiler) return { estado: "error", mensaje: "No encontramos el alquiler." };

  const subida = await subirDocumento({ rentalId, archivo, prefijo: "contrato" });
  if (!subida.ok) return { estado: "error", mensaje: subida.mensaje };

  const { error } = await supabase
    .from("rentals")
    .update({ contract_path: subida.ruta })
    .eq("id", rentalId);

  if (error) {
    console.error("No se pudo guardar el contrato", error);
    return { estado: "error", mensaje: "Subimos el archivo pero no pudimos guardarlo. Probá de nuevo." };
  }

  revalidatePath(`/alquileres/${rentalId}`);
  return { estado: "listo" };
}
