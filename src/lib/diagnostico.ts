/*
 * Cómo se cuenta un error en /api/salud.
 *
 * Está acá, aparte de la ruta, para poder probarlo: el chequeo llegó a
 * mostrar "error (?): " —sin código y sin mensaje— porque preguntaba con un
 * HEAD, y una respuesta HEAD no trae cuerpo. Un diagnóstico que no dice nada
 * es peor que no tener diagnóstico: manda a buscar el problema donde no está.
 */

export type ErrorPosible = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null;

/** Todo lo que sepamos del error, sin inventar ni dejar el renglón vacío. */
export function describirError(error: ErrorPosible): string {
  const codigo = error?.code?.trim() || "sin código";
  const mensaje = error?.message?.trim();
  const texto = mensaje || error?.details?.trim() || error?.hint?.trim() || "sin mensaje";
  const pista = mensaje && error?.hint?.trim() ? ` · ${error.hint.trim()}` : "";
  return `error (${codigo}): ${texto}${pista}`;
}

/** Aplana el resultado de una consulta a "ok", "no respondió" o el error. */
export function estadoDeConsulta(resultado: { error: ErrorPosible } | "timeout"): string {
  if (resultado === "timeout") return "no respondió a tiempo";
  return resultado.error ? describirError(resultado.error) : "ok";
}
