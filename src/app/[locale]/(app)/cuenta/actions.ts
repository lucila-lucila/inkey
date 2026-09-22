"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "@/lib/audit";
import { avisarBajaDeCuenta } from "@/lib/email/avisos";
import { conRedDeSeguridad, registrarFalla } from "@/lib/errores";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { datosPersonalesSchema } from "@/lib/validation/profile";

export type EstadoDatos =
  | { estado: "inicial" }
  | { estado: "guardado" }
  | { estado: "error"; mensaje: string; campo?: string };

/** Editar nombre, apellido y celular. */
export async function guardarDatos(
  anterior: EstadoDatos,
  formData: FormData,
): Promise<EstadoDatos> {
  return conRedDeSeguridad(
    "guardarDatos",
    () => actualizarDatos(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function actualizarDatos(
  _anterior: EstadoDatos,
  formData: FormData,
): Promise<EstadoDatos> {
  const parsed = datosPersonalesSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    const problema = parsed.error.issues[0]!;
    return { estado: "error", mensaje: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/cuenta");

  // RLS ya limita el update al propio perfil.
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);

  if (error) {
    const ref = registrarFalla("guardarDatos: update profiles", error);
    return {
      estado: "error",
      mensaje: `No se pudieron guardar los datos. Probá de nuevo. Si sigue pasando, pasanos este código: ${ref}`,
    };
  }

  revalidatePath("/cuenta");
  revalidatePath("/panel");
  return { estado: "guardado" };
}

export type EstadoBaja = { estado: "inicial" } | { estado: "error"; mensaje: string };

/**
 * Darse de baja.
 *
 * No borra el historial: lo despersonaliza (ver docs/decisiones.md). Después
 * de la baja libera el mail, para que esa persona pueda volver a registrarse y
 * empezar de cero, y cierra la sesión.
 */
export async function borrarCuenta(anterior: EstadoBaja, formData: FormData): Promise<EstadoBaja> {
  return conRedDeSeguridad(
    "borrarCuenta",
    () => darDeBaja(anterior, formData),
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

async function darDeBaja(_anterior: EstadoBaja, formData: FormData): Promise<EstadoBaja> {
  // Una baja no se hace sin querer: hay que escribirlo.
  const confirmacion = String(formData.get("confirmacion") ?? "").trim().toUpperCase();
  if (confirmacion !== "BORRAR") {
    return { estado: "error", mensaje: 'Para confirmar, escribí BORRAR en el campo.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data, error } = await supabase.rpc("account_delete");

  if (error) {
    const ref = registrarFalla("borrarCuenta: rpc account_delete", error);
    return {
      estado: "error",
      mensaje: `No se pudo dar de baja la cuenta. Escribinos y lo resolvemos a mano. Código: ${ref}`,
    };
  }

  const respuesta = data as {
    ok: boolean;
    avisar_a?: Array<{ user_id: string; rental_id: string; barrio: string }>;
    archivos_vencen?: string;
  };

  if (!respuesta?.ok) {
    return { estado: "error", mensaje: "No se pudo dar de baja la cuenta. Probá de nuevo." };
  }

  /*
   * El aviso de los 30 días a la contraparte y la liberación del mail son
   * tareas secundarias: si fallan, la baja ya está hecha y no se deshace.
   */
  await avisarBajaDeCuenta(respuesta.avisar_a ?? [], respuesta.archivos_vencen ?? null);
  await liberarElMail(user.id);

  await registrarAuditoria({
    actorId: user.id,
    action: "cuenta.baja_confirmada",
    entityType: "profile",
    entityId: user.id,
  });

  await supabase.auth.signOut();
  redirect("/?baja=lista");
}

/**
 * Libera el mail sin borrar la fila de auth.
 *
 * La fila tiene que sobrevivir: de ella cuelga el historial que también es de
 * la contraparte. Lo que se libera es la dirección, para que esa persona pueda
 * volver a registrarse con el mismo mail y empezar de cero.
 */
async function liberarElMail(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) {
      console.warn("[inkey] Sin service role no se puede liberar el mail de la baja.");
      return;
    }

    const { error } = await admin.auth.admin.updateUserById(userId, {
      email: `baja-${randomUUID()}@cuentas.invalid`,
      email_confirm: true,
      user_metadata: {},
    });

    if (error) registrarFalla("borrarCuenta: liberar el mail", error);
  } catch (error) {
    registrarFalla("borrarCuenta: liberar el mail", error);
  }
}
