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
  lista_espera: { limite: 5, ventanaSegundos: 60 * 60 },
  ingreso: { limite: 5, ventanaSegundos: 15 * 60 },
  invitacion: { limite: 10, ventanaSegundos: 60 * 60 },
  reporte_pago: { limite: 20, ventanaSegundos: 60 * 60 },
} satisfies Record<string, ReglaLimite>;

export type AccionLimitada = keyof typeof LIMITES;

/**
 * Identificador del cliente: la IP hasheada con una sal del servidor.
 * Nunca guardamos la IP en claro (Ley 25.326: no juntamos dato personal que
 * no necesitamos).
 */
export async function identificadorCliente(): Promise<string> {
  const lista = await headers();
  const forwarded = lista.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || lista.get("x-real-ip") || "desconocida";
  return createHash("sha256").update(`${serverEnv.rateLimitSalt}:${ip}`).digest("hex");
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
export async function consumirIntento(
  accion: AccionLimitada,
  identificador: string,
): Promise<ResultadoLimite> {
  const { limite, ventanaSegundos } = LIMITES[accion];
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_bucket: accion,
    p_identifier: identificador,
    p_limit: limite,
    p_window_seconds: ventanaSegundos,
  });

  if (error) {
    // Si el limitador falla no dejamos la puerta abierta de par en par, pero
    // tampoco tiramos abajo el flujo: lo registramos y dejamos pasar.
    console.error("rate_limit_hit falló", error);
    return { permitido: true, restantes: 0, esperaSegundos: 0 };
  }

  const fila = data as { allowed: boolean; remaining: number; retry_after_seconds: number };
  return {
    permitido: fila.allowed,
    restantes: fila.remaining,
    esperaSegundos: fila.retry_after_seconds,
  };
}

/** Mensaje único para no dar pistas sobre el estado interno del limitador. */
export const MENSAJE_LIMITE = "Probaste varias veces seguidas. Esperá unos minutos y volvé a intentar.";
