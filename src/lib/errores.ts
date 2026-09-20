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

export function mensajeInesperado(ref: string): string {
  return `Algo se rompió de nuestro lado y no pudimos guardarlo. Probá de nuevo; si sigue pasando, pasanos este código: ${ref}`;
}

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
    return alFallar(mensajeInesperado(ref), ref);
  }
}
