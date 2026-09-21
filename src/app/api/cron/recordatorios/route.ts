import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { registrarFalla } from "@/lib/errores";
import { avisarPagoReportado } from "@/lib/email/avisos";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Lo que corre una vez por día (ver vercel.json):
 *   - recordarle al dueño los pagos que no respondió en 3 días;
 *   - publicar las reseñas que ya cumplieron sus 14 días.
 *
 * Es idempotente: cada aviso se reserva con una clave, así que si el cron
 * corre dos veces no se manda nada dos veces.
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

  const resumen = { recordatorios: 0, resenas_publicadas: 0, errores: [] as string[] };

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

  return NextResponse.json(
    { ok: resumen.errores.length === 0, ...resumen },
    { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}
