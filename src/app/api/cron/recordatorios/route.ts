import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { registrarFalla } from "@/lib/errores";
import { avisarPagoReportado } from "@/lib/email/avisos";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Lo que corre una vez por día:
 *   - recordarle al dueño los pagos que no respondió en 3 días;
 *   - publicar las reseñas que ya cumplieron sus 14 días;
 *   - borrar los archivos de las cuentas dadas de baja, pasados los 30 días.
 *
 * Es idempotente: cada aviso se reserva con una clave, así que si el cron
 * corre dos veces no se manda nada dos veces.
 *
 * El horario está en `vercel.json`: 13:00 UTC, las 10 de la mañana en
 * Argentina. Ahí no se puede explicar nada (Vercel valida ese archivo contra
 * su esquema y rechaza cualquier propiedad que no conozca, incluido un
 * "comment"), así que la explicación vive acá.
 *
 * Un solo cron diario, para entrar en el plan Hobby de Vercel: hasta dos
 * tareas y como mucho una vez por día cada una. Además Vercel dispara en
 * cualquier momento de esa hora, no a las 13:00 en punto. Las dos tareas
 * miden en días, así que la hora exacta no cambia nada.
 */
export async function GET(request: NextRequest) {
  const secreto = serverEnv.cronSecret;

  // Sin secreto configurado el endpoint queda cerrado: mejor que abierto.
  if (!secreto) {
    console.warn("[inkey] CRON_SECRET no está configurado: el cron no corre.");
    return NextResponse.json({ ok: false, error: "sin_configurar" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: "no_autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "sin_service_role" }, { status: 503 });
  }

  const resumen = {
    recordatorios: 0,
    resenas_publicadas: 0,
    archivos_borrados: 0,
    errores: [] as string[],
  };

  try {
    const { data: pendientes, error } = await supabase.rpc("pagos_sin_respuesta", { p_dias: 3 });

    if (error) {
      const ref = registrarFalla("cron: pagos_sin_respuesta", error);
      resumen.errores.push(`pagos_sin_respuesta (${ref})`);
    } else {
      for (const pago of (pendientes ?? []) as Array<{ payment_id: string }>) {
        await avisarPagoReportado(pago.payment_id, true);
        resumen.recordatorios += 1;
      }
    }
  } catch (error) {
    const ref = registrarFalla("cron: recordatorios", error);
    resumen.errores.push(`recordatorios (${ref})`);
  }

  try {
    const { data, error } = await supabase.rpc("reviews_publish_due");
    if (error) {
      const ref = registrarFalla("cron: reviews_publish_due", error);
      resumen.errores.push(`reviews_publish_due (${ref})`);
    } else {
      resumen.resenas_publicadas = Number(data ?? 0);
    }
  } catch (error) {
    const ref = registrarFalla("cron: reseñas", error);
    resumen.errores.push(`reseñas (${ref})`);
  }

  /*
   * Los archivos de las cuentas dadas de baja. El plazo de 30 días es para que
   * la contraparte pueda descargar lo que necesite (ver docs/decisiones.md);
   * cumplido, se borran de verdad del Storage.
   */
  try {
    const { data, error } = await supabase.rpc("archivos_por_borrar");

    if (error) {
      const ref = registrarFalla("cron: archivos_por_borrar", error);
      resumen.errores.push(`archivos_por_borrar (${ref})`);
    } else {
      for (const archivo of (data ?? []) as Array<{ id: string; bucket: string; path: string }>) {
        const { error: errorBorrado } = await supabase.storage
          .from(archivo.bucket)
          .remove([archivo.path]);

        if (errorBorrado) {
          // Si el archivo ya no está, igual hay que cerrar la tarea.
          registrarFalla("cron: borrar archivo", errorBorrado);
        }

        await supabase.rpc("archivo_borrado", { p_id: archivo.id });
        resumen.archivos_borrados += 1;
      }
    }
  } catch (error) {
    const ref = registrarFalla("cron: archivos", error);
    resumen.errores.push(`archivos (${ref})`);
  }

  return NextResponse.json(
    { ok: resumen.errores.length === 0, ...resumen },
    { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}
