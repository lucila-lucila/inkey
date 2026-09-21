/*
 * Los links de ingreso que ya no sirven.
 *
 * Cuando un magic link venció, ya se usó o alguien lo canceló, Supabase no
 * manda a la app: rebota al Site URL con el error en la query o en el
 * fragmento (`#error_code=otp_expired&…`). Si no lo atajamos, la persona
 * aterriza en la landing sin entender qué pasó.
 */

/** Los parámetros que delatan un rebote de Supabase, no un error nuestro. */
export const PARAMETROS_DE_REBOTE = ["error_code", "error_description"] as const;

const MENSAJES: Record<string, string> = {
  otp_expired: "El link venció o ya se usó. Pedí uno nuevo.",
  otp_disabled: "Ese modo de ingreso está desactivado. Probá con Google.",
  access_denied: "El link venció o ya se usó. Pedí uno nuevo.",
  email_not_confirmed: "Todavía falta confirmar ese mail. Pedí un link nuevo.",
  over_email_send_rate_limit:
    "Pediste varios links seguidos. Esperá un minuto y volvé a intentar.",
  validation_failed: "Ese link está incompleto. Pedí uno nuevo.",
  server_error: "Algo falló de nuestro lado. Pedí un link nuevo.",
};

export const MENSAJE_GENERICO = "Ese link ya no sirve: venció o ya se usó. Pedí uno nuevo.";

/** El código que viaja a /ingresar: corto, conocido y sin texto de afuera. */
export function codigoDeRebote(parametros: {
  error?: string | null;
  error_code?: string | null;
}): string | null {
  const codigo = parametros.error_code ?? parametros.error;
  if (!codigo) return null;
  // Solo devolvemos códigos que conocemos: el texto lo ponemos nosotros, nunca
  // lo que venga en la URL.
  return codigo in MENSAJES ? codigo : "link";
}

export function mensajeDeRebote(codigo: string | null | undefined): string | undefined {
  if (!codigo) return undefined;
  return MENSAJES[codigo] ?? MENSAJE_GENERICO;
}

/** ¿Esta URL es un rebote de Supabase y no un error de la app? */
export function esRebote(parametros: URLSearchParams): boolean {
  return PARAMETROS_DE_REBOTE.some((nombre) => parametros.has(nombre));
}
