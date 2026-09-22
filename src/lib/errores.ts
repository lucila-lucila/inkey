import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Nada falla en silencio.
 *
 * Cuando algo se rompe de forma inesperada generamos una referencia corta, la
 * escribimos en los logs del servidor junto con el error completo, y le
 * mostramos esa misma referencia a la persona. Así, si nos escribe, buscamos
 * "inkey:ref" en los logs de Vercel y vamos directo al problema.
 */
export function registrarFalla(contexto: string, error: unknown): string {
  const ref = randomBytes(3).toString("hex");
  console.error(`[inkey:${ref}] ${contexto}`, error);
  return ref;
}

/*
 * La clave del mensaje que ve la persona. El texto explica qué pasó y qué
 * hacer, sin culpar a nadie, y lo arma el archivo de idiomas con el código
 * de referencia adentro.
 */
export const CLAVE_INESPERADO = "errores.inesperado";

/** Lo que devuelve una acción que salió mal. */
export type EstadoDeError = {
  estado: "error";
  /** Una clave del archivo de idiomas, nunca una frase. */
  mensaje: string;
  /** El código corto que buscamos en los logs si la persona nos escribe. */
  ref?: string;
};

/**
 * Envuelve una acción del servidor: si tira una excepción, la convierte en un
 * estado de error visible en vez de dejar la pantalla como si nada hubiera
 * pasado.
 */
export async function conRedDeSeguridad<T>(
  contexto: string,
  accion: () => Promise<T>,
  alFallar: (mensaje: string, ref: string) => T,
): Promise<T> {
  try {
    return await accion();
  } catch (error) {
    // redirect() y notFound() funcionan tirando una excepción: no las tapamos.
    if (error && typeof error === "object" && "digest" in error) {
      const digest = String((error as { digest?: unknown }).digest ?? "");
      if (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND") throw error;
    }
    const ref = registrarFalla(contexto, error);
    return alFallar(CLAVE_INESPERADO, ref);
  }
}
