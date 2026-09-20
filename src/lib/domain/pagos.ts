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

export const ESTADOS_PAGO = {
  confirmed: { texto: "Confirmado", tono: "green" },
  reported: { texto: "Esperando confirmación", tono: "neutral" },
  not_received: { texto: "El dueño no lo recibió", tono: "terra" },
} as const;

export type EstadoPago = keyof typeof ESTADOS_PAGO;

/**
 * Un pago cuenta como "en fecha" solo si está confirmado. Sin confirmar no
 * suma: no existe el mes a medias.
 */
export function cuentaEnFecha(pago: { status: string; on_time: boolean | null }): boolean {
  return pago.status === "confirmed" && pago.on_time === true;
}

export const MENSAJES_PAGO: Record<string, string> = {
  sin_sesion: "Volvé a entrar para seguir.",
  no_encontrado: "No encontramos ese pago.",
  alquiler_inactivo: "Este alquiler todavía no está confirmado por las dos partes.",
  periodo_fuera_del_contrato: "Ese mes queda fuera del contrato.",
  periodo_futuro: "Todavía no se puede reportar un mes que no empezó.",
  monto_invalido: "Revisá el monto.",
  fecha_futura: "La fecha de pago no puede ser posterior a hoy.",
  fecha_muy_vieja: "Esa fecha es demasiado anterior al mes que estás reportando.",
  ya_reportado: "Ese mes ya lo reportaste.",
  ya_confirmado: "Ese pago ya está confirmado.",
  "no_sos_el_dueño": "Solo el dueño del alquiler puede confirmar un pago.",
};
