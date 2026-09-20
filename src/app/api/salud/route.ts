import { NextResponse } from "next/server";
import { variablesFaltantes } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/*
 * Diagnóstico de la instalación: /api/salud
 *
 * Dice QUÉ falta, nunca el valor de nada. Sirve para responder en diez
 * segundos "¿por qué no anda en producción?" sin tener que leer logs.
 */
/** Ninguna revisión puede colgar el diagnóstico. */
async function conTiempoLimite<T>(promesa: PromiseLike<T>, ms = 3000): Promise<T | "timeout"> {
  return Promise.race([
    Promise.resolve(promesa),
    new Promise<"timeout">((resolver) => setTimeout(() => resolver("timeout"), ms)),
  ]);
}

export async function GET() {
  const faltan = variablesFaltantes();

  const revisiones: Record<string, string> = {};

  try {
    const supabase = await createClient();

    // ¿PostgREST ve las tablas? (si las migraciones se aplicaron recién, el
    // caché del esquema puede estar viejo y esto lo delata)
    for (const tabla of ["profiles", "rentals", "invitations", "payments", "share_links"]) {
      const resultado = await conTiempoLimite(
        supabase.from(tabla).select("id", { head: true, count: "exact" }),
      );
      revisiones[`tabla:${tabla}`] =
        resultado === "timeout"
          ? "no respondió a tiempo"
          : resultado.error
            ? `error (${resultado.error.code ?? "?"}): ${resultado.error.message}`
            : "ok";
    }

    // ¿Existen las funciones de invitación?
    const rpc = await conTiempoLimite(
      supabase.rpc("invitation_preview", { p_token_hash: "0".repeat(64) }),
    );
    revisiones["rpc:invitation_preview"] =
      rpc === "timeout"
        ? "no respondió a tiempo"
        : rpc.error
          ? `error (${rpc.error.code ?? "?"}): ${rpc.error.message}`
          : "ok";

    // ¿Existe el bucket de documentos?
    const perfilPublico = await conTiempoLimite(
      supabase.rpc("public_profile", { p_token_hash: "0".repeat(64), p_contar: false }),
    );
    revisiones["rpc:public_profile"] =
      perfilPublico === "timeout"
        ? "no respondió a tiempo"
        : perfilPublico.error
          ? `error (${perfilPublico.error.code ?? "?"}): ${perfilPublico.error.message}`
          : "ok";

    const storage = await conTiempoLimite(supabase.storage.from("documentos").list("", { limit: 1 }));
    revisiones["storage:documentos"] =
      storage === "timeout"
        ? "no respondió a tiempo"
        : storage.error
          ? `error: ${storage.error.message}`
          : "ok";
  } catch (error) {
    revisiones["supabase"] = `no se pudo conectar: ${(error as Error).message}`;
  }

  const todoOk =
    faltan.imprescindibles.length === 0 &&
    faltan.secundarias.length === 0 &&
    Object.values(revisiones).every((valor) => valor === "ok");

  return NextResponse.json(
    {
      ok: todoOk,
      variables_faltantes: faltan,
      revisiones,
      ayuda: todoOk
        ? undefined
        : "Cargá lo que falte en las variables de entorno del proyecto y volvé a deployar. Las tablas que den error suelen ser migraciones sin aplicar.",
    },
    {
      status: todoOk ? 200 : 503,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    },
  );
}
