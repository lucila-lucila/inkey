import { COOKIE_IDIOMA, COOKIE_IDIOMA_MAXIMA_EDAD } from "./idioma";
import type { Idioma } from "./routing";

/**
 * Deja la elección de idioma en la cookie desde el navegador.
 *
 * El servidor también la escribe, pero el selector es un link: la navegación
 * arranca en el mismo momento en que se dispara la acción, y si el servidor
 * no llega a tiempo la preferencia se perdía. Escribirla acá la deja puesta
 * antes de salir de la página.
 */
export function recordarIdiomaEnElNavegador(idioma: Idioma): void {
  document.cookie = `${COOKIE_IDIOMA}=${idioma}; path=/; max-age=${COOKIE_IDIOMA_MAXIMA_EDAD}; samesite=lax`;
}
