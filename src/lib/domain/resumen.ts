import type { Traductor } from "@/i18n/texto";
import { celda } from "@/lib/exportar";
import type { Moneda } from "@/lib/validation/rental";
import {
  partesDelPeriodo,
  periodosDelAlquiler,
  vencimientoDe,
  type EstadoPago,
  type Periodo,
} from "./pagos";

/*
 * El resumen anual de un alquiler.
 *
 * Lo ven las dos partes, cada una del lado que le toca, y es privado: acá sí
 * aparecen los meses que todavía no están confirmados, porque entre inquilino
 * y dueño eso no es una marca negativa sino una tarea pendiente. Al perfil
 * público no llega nada de esto.
 *
 * La plata se suma en centavos y no en decimales: `numeric(12,2)` llega como
 * texto ("450000.00") y sumar doce de esos con punto flotante termina, tarde o
 * temprano, en un centavo de diferencia que nadie sabe explicar.
 */

/** "450000.00" → 45000000. Redondea al centavo: no existe la fracción de centavo. */
export function aCentavos(monto: number | string): number {
  const numero = typeof monto === "string" ? Number(monto) : monto;
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export function aMonto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export type PagoDelResumen = {
  id: string;
  period: string;
  status: EstadoPago;
  amount: number | string;
  currency: Moneda;
  paid_on: string | null;
  due_date: string;
  on_time: boolean | null;
  receipt_serial: number | null;
};

export type MesDelResumen = {
  periodo: Periodo;
  vence: string;
  pago: PagoDelResumen | null;
};

export type TotalDelAnio = { moneda: Moneda; total: string; meses: number };

/** Cómo se movió el alquiler dentro del año, mirando solo lo confirmado. */
export type MovimientoDelAnio = {
  moneda: Moneda;
  desde: string;
  hasta: string;
  primerMes: Periodo;
  ultimoMes: Periodo;
  /** Redondeado a un decimal. Positivo si subió. */
  porcentaje: number;
};

export type ResumenAnual = {
  anio: number;
  meses: MesDelResumen[];
  /** Meses del contrato que caen en el año. */
  cantidadDeMeses: number;
  confirmados: number;
  enFecha: number;
  /** Sobre los confirmados. `null` cuando no hay ninguno: 0 % diría otra cosa. */
  puntualidad: number | null;
  totales: TotalDelAnio[];
  movimiento: MovimientoDelAnio | null;
};

/**
 * El año viene de la URL, o sea de cualquiera. Cualquier cosa que no sea un
 * año de cuatro dígitos dentro de un rango razonable se rechaza antes de
 * llegar a la base.
 */
export function anioValido(crudo: string): number | null {
  if (!/^\d{4}$/.test(crudo)) return null;
  const anio = Number(crudo);
  return anio >= 2000 && anio <= 2100 ? anio : null;
}

type Alquiler = { start_date: string; end_date?: string | null };

/**
 * Los años de los que hay algo para resumir, del más nuevo al más viejo.
 * Un mes del contrato alcanza: un año puede terminar sin ningún pago
 * confirmado y el resumen sigue siendo la respuesta correcta.
 */
export function aniosConResumen(alquiler: Alquiler, hoy = new Date()): number[] {
  const anios = new Set(
    periodosDelAlquiler(alquiler, hoy).map((periodo) => partesDelPeriodo(periodo).anio),
  );
  return [...anios].sort((a, b) => b - a);
}

/** Los meses del contrato que caen en ese año, del más viejo al más nuevo. */
export function periodosDelAnio(alquiler: Alquiler, anio: number, hoy = new Date()): Periodo[] {
  return periodosDelAlquiler(alquiler, hoy)
    .filter((periodo) => partesDelPeriodo(periodo).anio === anio)
    .reverse();
}

export function resumenAnual(opciones: {
  alquiler: Alquiler & { due_day: number };
  anio: number;
  pagos: PagoDelResumen[];
  hoy?: Date;
}): ResumenAnual {
  const { alquiler, anio, pagos, hoy = new Date() } = opciones;

  const porPeriodo = new Map(pagos.map((pago) => [String(pago.period).slice(0, 10), pago]));
  const meses: MesDelResumen[] = periodosDelAnio(alquiler, anio, hoy).map((periodo) => {
    const pago = porPeriodo.get(periodo) ?? null;
    return {
      periodo,
      // El vencimiento que quedó grabado en el pago manda: es la foto de ese
      // mes. Sin pago todavía, el que sale del alquiler de hoy.
      vence: pago ? String(pago.due_date).slice(0, 10) : vencimientoDe(periodo, alquiler.due_day),
      pago,
    };
  });

  const confirmados = meses
    .map((mes) => mes.pago)
    .filter((pago): pago is PagoDelResumen => pago?.status === "confirmed");

  const enFecha = confirmados.filter((pago) => pago.on_time === true).length;

  const porMoneda = new Map<Moneda, { centavos: number; meses: number }>();
  for (const pago of confirmados) {
    const acumulado = porMoneda.get(pago.currency) ?? { centavos: 0, meses: 0 };
    acumulado.centavos += aCentavos(pago.amount);
    acumulado.meses += 1;
    porMoneda.set(pago.currency, acumulado);
  }

  return {
    anio,
    meses,
    cantidadDeMeses: meses.length,
    confirmados: confirmados.length,
    enFecha,
    puntualidad:
      confirmados.length === 0 ? null : Math.round((enFecha / confirmados.length) * 100),
    /* Pesos primero: es la moneda de casi todos los alquileres. */
    totales: [...porMoneda.entries()]
      .sort(([a], [b]) => (a === b ? 0 : a === "ARS" ? -1 : 1))
      .map(([moneda, acumulado]) => ({
        moneda,
        total: aMonto(acumulado.centavos),
        meses: acumulado.meses,
      })),
    movimiento: movimientoDelAnio(confirmados),
  };
}

/*
 * De cuánto a cuánto se movió el alquiler en el año. Es la pregunta que se
 * hace cualquiera al mirar doce meses seguidos, y acá se responde sin cuentas:
 * el primer mes confirmado y el último.
 *
 * Solo si los dos están en la misma moneda: un alquiler que pasó de pesos a
 * dólares no cambió de precio un 0,03 %, cambió de moneda, y esa cuenta no
 * significa nada.
 */
function movimientoDelAnio(confirmados: PagoDelResumen[]): MovimientoDelAnio | null {
  if (confirmados.length < 2) return null;

  const enOrden = [...confirmados].sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const primero = enOrden[0];
  const ultimo = enOrden[enOrden.length - 1];

  if (primero.currency !== ultimo.currency) return null;

  const desde = aCentavos(primero.amount);
  const hasta = aCentavos(ultimo.amount);
  if (desde === 0 || desde === hasta) return null;

  return {
    moneda: primero.currency,
    desde: aMonto(desde),
    hasta: aMonto(hasta),
    primerMes: String(primero.period).slice(0, 10),
    ultimoMes: String(ultimo.period).slice(0, 10),
    porcentaje: Math.round(((hasta - desde) / desde) * 1000) / 10,
  };
}

/*
 * El resumen en CSV.
 *
 * Las fechas van en ISO (2026-03-12) y no en palabras: el CSV se abre en una
 * planilla, y ahí una fecha tiene que poder ordenarse y restarse. La versión
 * para leer es el PDF.
 */
export function csvDelResumen(opciones: {
  t: Traductor;
  resumen: ResumenAnual;
  barrio: string;
  direccion: string;
  inquilino: string;
  duenio: string;
  generadoEl?: string;
}): string {
  const { t, resumen, generadoEl = new Date().toISOString().slice(0, 10) } = opciones;
  const tr = (clave: string, valores?: Record<string, string | number>) =>
    t(`resumen.${clave}`, valores);

  const encabezado = [
    [`Inkey · ${tr("archivo")}`, String(resumen.anio)],
    [tr("propiedad"), opciones.barrio],
    ["", opciones.direccion],
    [tr("inquilino"), opciones.inquilino],
    [tr("propietario"), opciones.duenio],
    [tr("mesesConfirmados"), `${resumen.confirmados}/${resumen.cantidadDeMeses}`],
    ...(resumen.puntualidad === null
      ? []
      : [[tr("puntualidad"), `${resumen.puntualidad}%`]]),
    ...resumen.totales.map((total) => [
      `${tr("totalConfirmado")} (${total.moneda})`,
      total.total,
    ]),
    [tr("generadoEl", { fecha: generadoEl }), ""],
  ];

  const columnas = [
    tr("columnaMes"),
    tr("columnaMonto"),
    tr("columnaMoneda"),
    tr("columnaPagado"),
    tr("columnaVence"),
    tr("columnaEstado"),
    tr("columnaEnFecha"),
    tr("columnaRecibo"),
  ];

  const filas = resumen.meses.map((mes) => {
    const pago = mes.pago;
    return [
      mes.periodo.slice(0, 7),
      pago ? aMonto(aCentavos(pago.amount)) : "",
      pago?.currency ?? "",
      pago?.paid_on ? String(pago.paid_on).slice(0, 10) : "",
      mes.vence,
      pago ? t(`dominio.estadoPago.${pago.status}`) : tr("sinReportar"),
      pago?.status === "confirmed" ? (pago.on_time ? tr("si") : tr("no")) : "",
      pago?.status === "confirmed" && pago.receipt_serial ? String(pago.receipt_serial) : "",
    ];
  });

  const lineas = [
    ...encabezado.map((fila) => fila.map(celda).join(",")),
    "",
    columnas.map(celda).join(","),
    ...filas.map((fila) => fila.map(celda).join(",")),
    "",
    celda(tr("nota")),
  ];

  // BOM: sin esto Excel en Windows abre los acentos rotos.
  return `﻿${lineas.join("\n")}\n`;
}
