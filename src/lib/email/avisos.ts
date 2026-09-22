import "server-only";
import { getTranslations } from "next-intl/server";
import { idiomaParaMostrar } from "@/i18n/idioma";
import type { Traductor } from "@/i18n/texto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { nombreDeContraparte } from "@/lib/validation/profile";
import type { Moneda } from "@/lib/validation/rental";
import { crearLinkDePago, enviarMail, mailDe } from "./enviar";
import {
  comprobantesPorBorrar,
  contratoTerminado,
  invitacion,
  invitacionRespondida,
  pagoConfirmado,
  pagoReportado,
} from "./plantillas";

/*
 * Los avisos que manda la app. Cada uno junta sus datos, arma el mail y lo
 * manda una sola vez. Ninguno puede tirar una excepción hacia afuera: son
 * tareas secundarias y se llaman después de que la acción principal ya quedó
 * guardada.
 */

/**
 * El traductor de quien va a recibir el mail.
 *
 * Los avisos salen de un cron: del otro lado no hay navegador ni cookie, así
 * que el idioma sale del perfil. Quien todavía no eligió, o eligió uno que
 * hoy está apagado, lo recibe en el idioma activo.
 */
async function traductorDe(userId: string | null): Promise<Traductor> {
  let guardado: string | null = null;

  if (userId) {
    const supabase = createAdminClient();
    const { data } = (await supabase
      ?.from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle()) ?? { data: null };
    guardado = data?.locale ?? null;
  }

  const t = await getTranslations({ locale: idiomaParaMostrar(guardado) });
  return t as unknown as Traductor;
}

async function nombreDe(userId: string | null): Promise<string> {
  if (!userId) return "La otra parte";
  const supabase = createAdminClient();
  if (!supabase) return "La otra parte";

  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, deleted_at")
    .eq("id", userId)
    .maybeSingle();

  return nombreDeContraparte(data ?? null);
}

/** Al dueño: le reportaron un pago. Incluye el link para responder sin entrar. */
export async function avisarPagoReportado(paymentId: string, recordatorio = false): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data: pago } = await supabase
      .from("payments")
      .select("id, period, amount, currency, paid_on, status, reported_at, rental_id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!pago || pago.status !== "reported") return;

    const { data: alquiler } = await supabase
      .from("rentals")
      .select("id, owner_id, tenant_id, neighborhood_label")
      .eq("id", pago.rental_id)
      .maybeSingle();
    if (!alquiler?.owner_id) return;

    const para = await mailDe(alquiler.owner_id);
    if (!para) return;

    const links = await crearLinkDePago(pago.id);
    if (!links) return;

    const mail = pagoReportado(
      {
        t: await traductorDe(alquiler.owner_id),
        nombreInquilino: await nombreDe(alquiler.tenant_id),
        periodo: String(pago.period).slice(0, 10),
        monto: String(pago.amount),
        moneda: pago.currency as Moneda,
        pagadoEl: String(pago.paid_on).slice(0, 10),
        barrio: alquiler.neighborhood_label,
        siteUrl: serverEnv.siteUrl,
        urlConfirmar: links.confirmar,
        urlNoRecibido: links.noRecibido,
      },
      recordatorio,
    );

    await enviarMail({
      tipo: recordatorio ? "pago.recordatorio" : "pago.reportado",
      para,
      // El recordatorio se manda una vez por reporte, no una vez por día.
      dedupeKey: `${recordatorio ? "pago.recordatorio" : "pago.reportado"}:${pago.id}:${pago.reported_at}`,
      mail,
      rentalId: alquiler.id,
      paymentId: pago.id,
      destinatarioId: alquiler.owner_id,
    });
  } catch (error) {
    console.error("avisarPagoReportado falló", error);
  }
}

/** Al inquilino: su dueño confirmó el pago. */
export async function avisarPagoConfirmado(paymentId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data: pago } = await supabase
      .from("payments")
      .select("id, period, amount, currency, status, confirmed_at, rental_id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!pago || pago.status !== "confirmed") return;

    const { data: alquiler } = await supabase
      .from("rentals")
      .select("id, tenant_id, neighborhood_label")
      .eq("id", pago.rental_id)
      .maybeSingle();
    if (!alquiler?.tenant_id) return;

    const para = await mailDe(alquiler.tenant_id);
    if (!para) return;

    await enviarMail({
      tipo: "pago.confirmado",
      para,
      dedupeKey: `pago.confirmado:${pago.id}`,
      mail: pagoConfirmado({
        t: await traductorDe(alquiler.tenant_id),
        periodo: String(pago.period).slice(0, 10),
        barrio: alquiler.neighborhood_label,
        monto: String(pago.amount),
        moneda: pago.currency as Moneda,
        urlRecibo: new URL(`/pagos/${pago.id}/recibo`, serverEnv.siteUrl).toString(),
        siteUrl: serverEnv.siteUrl,
      }),
      rentalId: alquiler.id,
      paymentId: pago.id,
      destinatarioId: alquiler.tenant_id,
    });
  } catch (error) {
    console.error("avisarPagoConfirmado falló", error);
  }
}

/** A quien recibe la invitación, cuando quien invita da un mail. */
export async function avisarInvitacion(datos: {
  para: string;
  quienId: string;
  barrio: string;
  rol: "owner" | "tenant";
  url: string;
  rentalId: string;
}): Promise<boolean> {
  try {
    return await enviarMail({
      tipo: "invitacion.enviada",
      para: datos.para,
      dedupeKey: `invitacion.enviada:${datos.rentalId}:${datos.para}:${Date.now()}`,
      mail: invitacion({
        // A quien recibe la invitación todavía no lo conocemos: idioma activo.
        t: await traductorDe(null),
        quien: await nombreDe(datos.quienId),
        barrio: datos.barrio,
        rol: datos.rol,
        url: datos.url,
        siteUrl: serverEnv.siteUrl,
      }),
      rentalId: datos.rentalId,
    });
  } catch (error) {
    console.error("avisarInvitacion falló", error);
    return false;
  }
}

/** A quien invitó: la otra parte aceptó o dijo que no era suya. */
export async function avisarRespuestaInvitacion(rentalId: string, acepto: boolean): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data: alquiler } = await supabase
      .from("rentals")
      .select("id, created_by, neighborhood_label")
      .eq("id", rentalId)
      .maybeSingle();
    if (!alquiler) return;

    const para = await mailDe(alquiler.created_by);
    if (!para) return;

    await enviarMail({
      tipo: acepto ? "invitacion.aceptada" : "invitacion.rechazada",
      para,
      dedupeKey: `invitacion.respondida:${alquiler.id}`,
      mail: invitacionRespondida({
        t: await traductorDe(alquiler.created_by),
        acepto,
        barrio: alquiler.neighborhood_label,
        url: new URL(`/alquileres/${alquiler.id}`, serverEnv.siteUrl).toString(),
        siteUrl: serverEnv.siteUrl,
      }),
      rentalId: alquiler.id,
      destinatarioId: alquiler.created_by,
    });
  } catch (error) {
    console.error("avisarRespuestaInvitacion falló", error);
  }
}

/** A las dos partes: terminó el contrato y pueden dejarse una reseña. */
export async function avisarFinDeContrato(rentalId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data: alquiler } = await supabase
      .from("rentals")
      .select("id, tenant_id, owner_id, neighborhood_label, status")
      .eq("id", rentalId)
      .maybeSingle();
    if (!alquiler || alquiler.status !== "ended") return;

    const url = new URL(`/alquileres/${alquiler.id}`, serverEnv.siteUrl).toString();

    for (const [quien, elOtro] of [
      [alquiler.tenant_id, alquiler.owner_id],
      [alquiler.owner_id, alquiler.tenant_id],
    ] as const) {
      const para = await mailDe(quien);
      if (!para) continue;

      await enviarMail({
        tipo: "contrato.terminado",
        para,
        dedupeKey: `contrato.terminado:${alquiler.id}:${quien}`,
        mail: contratoTerminado({
          t: await traductorDe(quien),
          barrio: alquiler.neighborhood_label,
          quien: await nombreDe(elOtro),
          url,
          siteUrl: serverEnv.siteUrl,
        }),
        rentalId: alquiler.id,
        destinatarioId: quien,
      });
    }
  } catch (error) {
    console.error("avisarFinDeContrato falló", error);
  }
}

/**
 * A la contraparte de quien se dio de baja: tiene 30 días para descargar los
 * comprobantes antes de que se borren.
 *
 * Como todos los avisos, no puede tirar una excepción: la baja ya está hecha y
 * no se deshace porque un mail no salga.
 */
export async function avisarBajaDeCuenta(
  aQuienes: Array<{ user_id: string; rental_id: string; barrio: string }>,
  venceISO: string | null,
): Promise<void> {
  try {
    if (aQuienes.length === 0 || !venceISO) return;
    const vence = venceISO.slice(0, 10);

    for (const aviso of aQuienes) {
      const para = await mailDe(aviso.user_id);
      if (!para) continue;

      await enviarMail({
        tipo: "cuenta.baja",
        para,
        dedupeKey: `cuenta.baja:${aviso.rental_id}:${aviso.user_id}`,
        mail: comprobantesPorBorrar({
          t: await traductorDe(aviso.user_id),
          barrio: aviso.barrio,
          url: new URL(`/alquileres/${aviso.rental_id}`, serverEnv.siteUrl).toString(),
          vence,
          siteUrl: serverEnv.siteUrl,
        }),
        rentalId: aviso.rental_id,
        destinatarioId: aviso.user_id,
      });
    }
  } catch (error) {
    console.error("avisarBajaDeCuenta falló", error);
  }
}
