import { defineRouting } from "next-intl/routing";

/*
 * Los idiomas de Inkey.
 *
 * El castellano rioplatense es el de la casa y va sin prefijo: `/panel`,
 * `/p/<token>`, `/invitacion/<token>`. Eso no es una preferencia estética,
 * es una condición: esos links ya salieron por mail y por WhatsApp, y si
 * hoy cambian de forma dejan de funcionar. El inglés cuelga de `/en`.
 *
 * `es` es rioplatense a propósito, no "es-AR": cuando sumemos un castellano
 * neutro para otros países, ese va a entrar como `es-419` y este archivo es
 * el único lugar donde hay que declararlo.
 */
export const IDIOMAS = ["es", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_POR_DEFECTO: Idioma = "es";

/** Cómo se llama cada idioma en su propio idioma, para el selector del pie. */
export const NOMBRE_DEL_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  en: "English",
};

export const routing = defineRouting({
  locales: IDIOMAS,
  defaultLocale: IDIOMA_POR_DEFECTO,
  localePrefix: "as-needed",
  // La preferencia la resolvemos nosotros (perfil, cookie, navegador).
  localeDetection: false,
  localeCookie: false,
});

export function esIdioma(valor: unknown): valor is Idioma {
  return typeof valor === "string" && (IDIOMAS as readonly string[]).includes(valor);
}
