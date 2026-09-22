import type { ResenaPublica } from "./resenas";

/** Las métricas del historial, tal como las devuelve la base. */
export type Metricas = {
  meses_confirmados: number;
  pagos_en_fecha: number;
  porcentaje_en_fecha: number | null;
  contratos_cumplidos: number;
  contratos_totales: number;
  con_comprobante: number;
  con_contrato: number;
  desde: string | null;
  barrios: string[];
  ultimos_12: Array<{ periodo: string; confirmado: boolean }>;
  montos?: {
    total_confirmado: Record<string, string>;
    mensual_actual: { monto: string; moneda: string } | null;
  };
};

export type PerfilPublico =
  | { estado: "inexistente" | "revocado" | "vencido" }
  | {
      estado: "valido";
      rol: "tenant" | "owner";
      nombre: string;
      inicial_apellido: string;
      muestra_montos: boolean;
      metricas: Metricas;
      resenas: ResenaPublica[];
    };

export function nombreVisible(nombre: string, inicial: string): string {
  return inicial ? `${nombre} ${inicial}.` : nombre;
}

export type Nivel = { titulo: string; detalle: string; logrado: boolean };

/**
 * La cifra grande de la tarjeta del historial y la línea que la acompaña.
 *
 * Una sola cosa manda —los meses confirmados— y el resto va en chico. Vive
 * acá porque lo usan la pantalla, el perfil público y el PDF, y los tres
 * tienen que decir exactamente lo mismo.
 */
export function cifraPrincipal(
  metricas: Metricas,
  esInquilino: boolean,
): { numero: number; texto: string } {
  if (esInquilino) {
    return { numero: metricas.meses_confirmados, texto: "meses pagados, confirmados por su dueño" };
  }
  const total = metricas.contratos_totales;
  return { numero: total, texto: total === 1 ? "alquiler en Inkey" : "alquileres en Inkey" };
}

export function resumenDeMetricas(metricas: Metricas, esInquilino: boolean): string {
  const partes: string[] = [];

  if (esInquilino && metricas.porcentaje_en_fecha !== null) {
    partes.push(`${metricas.porcentaje_en_fecha}% en fecha`);
  }
  if (!esInquilino) {
    const pagos = metricas.meses_confirmados;
    partes.push(pagos === 1 ? "1 pago confirmado" : `${pagos} pagos confirmados`);
  }

  const cumplidos = metricas.contratos_cumplidos;
  partes.push(cumplidos === 1 ? "1 contrato cumplido" : `${cumplidos} contratos cumplidos`);

  return partes.join(" · ");
}

/**
 * Niveles de verificación. Son siempre afirmaciones de lo que sí pasó: acá no
 * hay nada que marque a nadie en falta.
 */
export function nivelesDeVerificacion(metricas: Metricas): Nivel[] {
  return [
    {
      titulo: "Confirmado por el dueño",
      detalle:
        metricas.meses_confirmados > 0
          ? `${metricas.meses_confirmados} ${metricas.meses_confirmados === 1 ? "mes confirmado" : "meses confirmados"} por la otra parte`
          : "Todavía sin meses confirmados",
      logrado: metricas.meses_confirmados > 0,
    },
    {
      titulo: "Con comprobante",
      detalle:
        metricas.con_comprobante > 0
          ? `${metricas.con_comprobante} ${metricas.con_comprobante === 1 ? "pago" : "pagos"} con comprobante adjunto`
          : "Sin comprobantes adjuntos",
      logrado: metricas.con_comprobante > 0,
    },
    {
      titulo: "Con contrato adjunto",
      detalle:
        metricas.con_contrato > 0
          ? `${metricas.con_contrato} ${metricas.con_contrato === 1 ? "contrato adjunto" : "contratos adjuntos"}`
          : "Sin contrato adjunto",
      logrado: metricas.con_contrato > 0,
    },
  ];
}

/** El resumen de una línea que va en el preview de WhatsApp. */
export function resumenParaCompartir(metricas: Metricas, rol: "tenant" | "owner"): string {
  if (rol === "owner") {
    const contratos = metricas.contratos_totales;
    return contratos === 1 ? "1 alquiler en Inkey" : `${contratos} alquileres en Inkey`;
  }

  if (metricas.meses_confirmados === 0) return "Historial de alquiler en Inkey";

  const meses = `${metricas.meses_confirmados} ${metricas.meses_confirmados === 1 ? "mes confirmado" : "meses confirmados"}`;
  return metricas.porcentaje_en_fecha !== null
    ? `${meses} · ${metricas.porcentaje_en_fecha}% en fecha`
    : meses;
}

export const ROLES_PERFIL = {
  tenant: { titulo: "Mi historial como inquilino", corto: "Como inquilino" },
  owner: { titulo: "Mi reputación como dueño", corto: "Como dueño" },
} as const;
