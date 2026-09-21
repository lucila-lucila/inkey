import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReglaLimite = { limite: number; ventanaSegundos: number };

/**
 * Límites por acción. Son deliberadamente holgados para un uso normal y
 * apretados para un script.
 */
export const LIMITES = {
  ingreso: { limite: 5, ventanaSegundos: 15 * 60 },
  invitacion: { limite: 10, ventanaSegundos: 60 * 60 },
  reporte_pago: { limite: 20, ventanaSegundos: 60 * 60 },
  // Un dueño con varias propiedades confirma varios pagos seguidos.
  confirmacion_pago: { limite: 30, ventanaSegundos: 60 * 60 },
  resena: { limite: 10, ventanaSegundos: 60 * 60 },
  // El más pesado de todos: arma el historial completo en cada llamada.
  export_datos: { limite: 5, ventanaSegundos: 60 * 60 },
} satisfies Record<string, ReglaLimite>;

export type AccionLimitada = keyof typeof LIMITES;

/**
 * Identificador del cliente: la IP hasheada con una sal del servidor.
 * Nunca guardamos la IP en claro (Ley 25.326: no juntamos dato personal que
 * no necesitamos).
 *
 * Si no hay sal configurada devuelve null: el rate limiting queda apagado,
 * pero la persona puede seguir usando la app. Nunca tira una excepción.
 */
export async function identificadorCliente(): Promise<string | null> {
  try {
    const sal = serverEnv.rateLimitSalt;
    if (!sal) {
      avisarUnaVez(
        "RATE_LIMIT_SALT no está configurada: el rate limiting está apagado. Cargala en el entorno.",
      );
      return null;
    }
    const lista = await headers();
    const forwarded = lista.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || lista.get("x-real-ip") || "desconocida";
    return createHash("sha256").update(`${sal}:${ip}`).digest("hex");
  } catch (error) {
    console.error("No se pudo identificar al cliente para el rate limiting", error);
    return null;
  }
}

/** Para no llenar los logs con el mismo aviso en cada request. */
const avisosDados = new Set<string>();
function avisarUnaVez(mensaje: string): void {
  if (avisosDados.has(mensaje)) return;
  avisosDados.add(mensaje);
  console.warn(`[inkey] ${mensaje}`);
}

export type ResultadoLimite = {
  permitido: boolean;
  restantes: number;
  esperaSegundos: number;
};

/**
 * Consume un intento de la ventana deslizante. La cuenta vive en Postgres
 * (ver supabase/migrations): sirve igual con varias instancias de Vercel.
 */
const SIN_LIMITE: ResultadoLimite = { permitido: true, restantes: 0, esperaSegundos: 0 };

export async function consumirIntento(
  accion: AccionLimitada,
  identificador: string | null,
): Promise<ResultadoLimite> {
  // El rate limiting es una protección secundaria: si no se puede aplicar, se
  // registra y se deja pasar. Nunca puede impedir que alguien use la app.
  if (!identificador) return SIN_LIMITE;

  try {
    const { limite, ventanaSegundos } = LIMITES[accion];
    const supabase = createAdminClient();
    if (!supabase) {
      avisarUnaVez(
        "SUPABASE_SERVICE_ROLE_KEY no está configurada: el rate limiting está apagado.",
      );
      return SIN_LIMITE;
    }

    const { data, error } = await supabase.rpc("rate_limit_hit", {
      p_bucket: accion,
      p_identifier: identificador,
      p_limit: limite,
      p_window_seconds: ventanaSegundos,
    });

    if (error) {
      console.error("rate_limit_hit falló", error);
      return SIN_LIMITE;
    }

    const fila = data as { allowed: boolean; remaining: number; retry_after_seconds: number };
    return {
      permitido: fila.allowed,
      restantes: fila.remaining,
      esperaSegundos: fila.retry_after_seconds,
    };
  } catch (error) {
    console.error("El rate limiting falló de forma inesperada", error);
    return SIN_LIMITE;
  }
}

/** Mensaje único para no dar pistas sobre el estado interno del limitador. */
export const MENSAJE_LIMITE = "Probaste varias veces seguidas. Esperá unos minutos y volvé a intentar.";
