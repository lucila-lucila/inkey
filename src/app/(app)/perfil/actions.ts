"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "@/lib/audit";
import { conRedDeSeguridad, registrarFalla } from "@/lib/errores";
import { enlacePerfil, hashearToken, tokenDeLink } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";

export type EstadoLinkPerfil =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string }
  // El id viaja de vuelta para poder abrir ese link en la lista.
  | { estado: "listo"; id: string; url: string };

const SIN_CLAVE =
  "Falta configurar la clave de los links compartibles (SHARE_LINK_SECRET). Revisá /api/salud.";

/** Crea un link para compartir el historial. */
export async function crearLink(
  anterior: EstadoLinkPerfil,
  formData: FormData,
): Promise<EstadoLinkPerfil> {
  return conRedDeSeguridad(
    "crearLink",
    async () => {
      const rol = formData.get("rol") === "owner" ? "owner" : "tenant";
      const etiqueta = String(formData.get("etiqueta") ?? "").trim();
      const montos = formData.get("montos") === "on";

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) redirect("/ingresar?volver_a=/perfil");

      // El token se deriva del id, así que el id lo elegimos nosotros.
      const id = randomUUID();
      const token = tokenDeLink(id);
      if (!token) {
        console.error("[inkey] Falta SHARE_LINK_SECRET: no se pueden crear links de perfil.");
        return { estado: "error" as const, mensaje: SIN_CLAVE };
      }

      const { error } = await supabase.from("share_links").insert({
        id,
        user_id: user.id,
        subject_role: rol,
        token_hash: hashearToken(token),
        label: etiqueta === "" ? null : etiqueta.slice(0, 60),
        show_amounts: montos,
      });

      if (error) {
        const ref = registrarFalla("crearLink: insert en share_links", error);
        return {
          estado: "error" as const,
          mensaje: `No se pudo crear el link. Probá de nuevo en un momento. Si sigue pasando, pasanos este código: ${ref}`,
        };
      }

      await registrarAuditoria({
        actorId: user.id,
        action: "link.creado",
        entityType: "share_link",
        entityId: id,
        metadata: { rol, muestra_montos: montos },
      });

      revalidatePath("/perfil");
      return { estado: "listo" as const, id, url: enlacePerfil(token) };
    },
    (mensaje) => ({ estado: "error", mensaje }),
  );
}

/** Revoca un link: deja de mostrar el perfil en el acto. */
export async function revocarLink(formData: FormData): Promise<void> {
  const id = String(formData.get("link_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/perfil");

  // RLS ya limita a los links propios.
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    registrarFalla("revocarLink", error);
    redirect("/perfil?error=revocar");
  }

  await registrarAuditoria({
    actorId: user.id,
    action: "link.revocado",
    entityType: "share_link",
    entityId: id,
  });

  revalidatePath("/perfil");
  redirect("/perfil");
}

/** Muestra u oculta los montos en un link ya creado. */
export async function cambiarMontos(formData: FormData): Promise<void> {
  const id = String(formData.get("link_id") ?? "");
  const mostrar = formData.get("mostrar") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/perfil");

  const { error } = await supabase.from("share_links").update({ show_amounts: mostrar }).eq("id", id);
  if (error) {
    registrarFalla("cambiarMontos", error);
    redirect("/perfil?error=montos");
  }

  revalidatePath("/perfil");
  redirect("/perfil");
}

/** Vuelve a armar el link de un link ya creado, para copiarlo de nuevo. */
export async function verLink(idLink: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Entrá de nuevo para ver el link." };

  const { data: link } = await supabase
    .from("share_links")
    .select("id, revoked_at")
    .eq("id", idLink)
    .maybeSingle();

  if (!link) return { error: "No encontramos ese link." };
  if (link.revoked_at) return { error: "Ese link está revocado." };

  const token = tokenDeLink(link.id);
  return token ? { url: enlacePerfil(token) } : { error: SIN_CLAVE };
}
