import type { Traductor } from "@/i18n/texto";
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

export type Nivel = { clave: string; cantidad: number; logrado: boolean };

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
): { numero: number; clave: string } {
  return esInquilino
    ? { numero: metricas.meses_confirmados, clave: "dominio.cifra.inquilino" }
    : { numero: metricas.contratos_totales, clave: "dominio.cifra.propietario" };
}

/*
 * Las partes de la línea de abajo del número. Devuelve claves y números, no
 * frases: el plural de cada idioma lo resuelve el archivo de textos, que es
 * donde se puede escribir bien en cada uno.
 */
export function resumenDeMetricas(
  metricas: Metricas,
  esInquilino: boolean,
): Array<{ clave: string; cantidad: number }> {
  const partes: Array<{ clave: string; cantidad: number }> = [];

  if (esInquilino && metricas.porcentaje_en_fecha !== null) {
    partes.push({ clave: "dominio.resumen.enFecha", cantidad: metricas.porcentaje_en_fecha });
  }
  if (!esInquilino) {
    partes.push({ clave: "dominio.resumen.pagosConfirmados", cantidad: metricas.meses_confirmados });
  }
  partes.push({ clave: "dominio.resumen.contratosCumplidos", cantidad: metricas.contratos_cumplidos });

  return partes;
}

/**
 * Niveles de verificación. Son siempre afirmaciones de lo que sí pasó: acá no
 * hay nada que marque a nadie en falta.
 */
export function nivelesDeVerificacion(metricas: Metricas): Nivel[] {
  return [
    {
      clave: "confirmadoPorElDueno",
      cantidad: metricas.meses_confirmados,
      logrado: metricas.meses_confirmados > 0,
    },
    {
      clave: "conComprobante",
      cantidad: metricas.con_comprobante,
      logrado: metricas.con_comprobante > 0,
    },
    {
      clave: "conContrato",
      cantidad: metricas.con_contrato,
      logrado: metricas.con_contrato > 0,
    },
  ];
}

/**
 * El resumen de una línea que va en el preview de WhatsApp.
 *
 * Recibe el traductor porque esto sale en el mismo idioma en que la persona
 * armó el link: es lo primero que ve quien lo abre.
 */
export function resumenParaCompartir(
  t: Traductor,
  metricas: Metricas,
  rol: "tenant" | "owner",
): string {
  if (rol === "owner") {
    return t("dominio.compartir.propietario", { cantidad: metricas.contratos_totales });
  }
  if (metricas.meses_confirmados === 0) return t("dominio.compartir.sinHistorial");

  const meses = t("dominio.compartir.meses", { cantidad: metricas.meses_confirmados });
  return metricas.porcentaje_en_fecha !== null
    ? `${meses} · ${t("dominio.resumen.enFecha", { cantidad: metricas.porcentaje_en_fecha })}`
    : meses;
}

/** Los dos lados del perfil propio. El texto vive en `dominio.rolPerfil`. */
export const ROLES_PERFIL = ["tenant", "owner"] as const;
export type RolPerfil = (typeof ROLES_PERFIL)[number];
