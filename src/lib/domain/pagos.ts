import type { Traductor } from "@/i18n/texto";
import { vencimientoDelPeriodo } from "./alquiler";

/** Un período es un mes: lo representamos como el día 1, en formato YYYY-MM-DD. */
export type Periodo = string;

export function aPeriodo(fecha: Date): Periodo {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function periodoActual(hoy = new Date()): Periodo {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

export function partesDelPeriodo(periodo: Periodo): { anio: number; mes: number } {
  const [anio, mes] = periodo.split("-").map(Number);
  return { anio, mes };
}

/** "octubre de 2026" · con `corto`, "oct. 2026". */
export function nombrePeriodo(periodo: Periodo, corto = false): string {
  const { anio, mes } = partesDelPeriodo(periodo);
  return new Intl.DateTimeFormat("es-AR", {
    month: corto ? "short" : "long",
    year: "numeric",
  }).format(new Date(Date.UTC(anio, mes - 1, 1)));
}

export function vencimientoDe(periodo: Periodo, diaVencimiento: number): string {
  const { anio, mes } = partesDelPeriodo(periodo);
  return vencimientoDelPeriodo(anio, mes, diaVencimiento).toISOString().slice(0, 10);
}

/**
 * Los meses que le corresponden a un alquiler: desde que empezó hasta hoy (o
 * hasta que termina, si ya terminó). Del más nuevo al más viejo.
 */
export function periodosDelAlquiler(
  alquiler: { start_date: string; end_date?: string | null },
  hoy = new Date(),
): Periodo[] {
  const desde = partesDelPeriodo(alquiler.start_date.slice(0, 10));
  const hastaContrato = alquiler.end_date ? partesDelPeriodo(alquiler.end_date.slice(0, 10)) : null;
  const hastaHoy = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };

  const tope =
    hastaContrato && hastaContrato.anio * 12 + hastaContrato.mes < hastaHoy.anio * 12 + hastaHoy.mes
      ? hastaContrato
      : hastaHoy;

  const periodos: Periodo[] = [];
  let anio = tope.anio;
  let mes = tope.mes;

  while (anio * 12 + mes >= desde.anio * 12 + desde.mes) {
    periodos.push(`${anio}-${String(mes).padStart(2, "0")}-01`);
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      anio -= 1;
    }
  }

  return periodos;
}

/*
 * El tono de cada estado. El texto sale del archivo de idiomas, bajo
 * `dominio.estadoPago`.
 *
 * "Todavía no le llegó" va en neutro a propósito: no es un incumplimiento ni
 * una alarma, es un mes que todavía no suma.
 */
export const ESTADOS_PAGO = {
  confirmed: { tono: "confirm" },
  reported: { tono: "primary" },
  not_received: { tono: "neutral" },
} as const;

export type EstadoPago = keyof typeof ESTADOS_PAGO;

/**
 * Un pago cuenta como "en fecha" solo si está confirmado. Sin confirmar no
 * suma: no existe el mes a medias.
 */
export function cuentaEnFecha(pago: { status: string; on_time: boolean | null }): boolean {
  return pago.status === "confirmed" && pago.on_time === true;
}

/*
 * Los códigos que devuelven las funciones de la base. El texto de cada uno
 * vive en `dominio.mensajePago`, y `MENSAJES_PAGO` existe para que un código
 * nuevo sin traducir salte en los tests y no en la cara de la persona.
 */
export const MENSAJES_PAGO = [
  "sin_sesion",
  "no_encontrado",
  "alquiler_inactivo",
  "periodo_fuera_del_contrato",
  "periodo_futuro",
  "monto_invalido",
  "fecha_futura",
  "fecha_muy_vieja",
  "ya_reportado",
  "ya_confirmado",
  "no_sos_el_dueño",
] as const;

/**
 * Insistirle al dueño por WhatsApp.
 *
 * A los 3 días le mandamos un recordatorio por mail (ver el cron). Si a los 7
 * sigue sin responder, el inquilino puede escribirle él mismo: es su alquiler
 * y su historial.
 */
export const DIAS_PARA_INSISTIR = 7;

export function diasDesde(fechaISO: string, hoy = new Date()): number {
  const desde = new Date(fechaISO).getTime();
  if (Number.isNaN(desde)) return 0;
  return Math.floor((hoy.getTime() - desde) / (24 * 60 * 60 * 1000));
}

export function sePuedeInsistir(
  pago: { status: string; reported_at?: string | null },
  hoy = new Date(),
): boolean {
  if (pago.status !== "reported" || !pago.reported_at) return false;
  return diasDesde(pago.reported_at, hoy) >= DIAS_PARA_INSISTIR;
}

/**
 * El mensaje que le manda el inquilino al dueño. El link lleva al pago dentro
 * de la app: para confirmar hay que entrar con el mail del dueño. El link
 * directo del mail confirma sin sesión y es solo para él, así que nunca puede
 * viajar en un mensaje que arma el inquilino.
 */
export function mensajeInsistirPago(datos: {
  t: Traductor;
  mes: string;
  barrio: string;
  url: string;
}): string {
  return `${datos.t("mensajes.insistirPago", { mes: datos.mes, barrio: datos.barrio })}\n\n${datos.url}`;
}
