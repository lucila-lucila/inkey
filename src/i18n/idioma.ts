import { estaActivo, idiomaDeRespaldo } from "./activos";
import { IDIOMAS, IDIOMA_POR_DEFECTO, esIdioma, type Idioma } from "./routing";

/*
 * De dónde sale el idioma de cada persona, en orden:
 *
 *   1. la URL (`/en/...` manda siempre: es una decisión explícita),
 *   2. la cookie, que guarda lo último que eligió en el selector del pie,
 *   3. el idioma del navegador, solo la primera vez,
 *   4. castellano.
 *
 * Quien tiene cuenta guarda además su preferencia en el perfil. Esa no se
 * lee en cada request —saldría una consulta por navegación—: se copia a la
 * cookie al entrar, así viaja con la persona cuando cambia de dispositivo.
 */

export const COOKIE_IDIOMA = "inkey_idioma";
/** Un año: es una preferencia, no una sesión. */
export const COOKIE_IDIOMA_MAXIMA_EDAD = 60 * 60 * 24 * 365;

/**
 * Lee el `Accept-Language` del navegador y elige el mejor de los nuestros.
 *
 * Acepta tanto "en" como "en-US" o "es-419": nos quedamos con la parte de
 * adelante, que es lo único que distingue nuestros idiomas hoy.
 */
export function idiomaDelNavegador(acceptLanguage: string | null | undefined): Idioma | null {
  if (!acceptLanguage) return null;

  const preferencias = acceptLanguage
    .split(",")
    .map((trozo) => {
      const [etiqueta, ...parametros] = trozo.trim().split(";");
      const calidad = parametros
        .map((parametro) => parametro.trim())
        .find((parametro) => parametro.startsWith("q="));
      const peso = calidad ? Number(calidad.slice(2)) : 1;
      return { base: etiqueta.trim().toLowerCase().split("-")[0], peso };
    })
    .filter((preferencia) => preferencia.base !== "" && Number.isFinite(preferencia.peso))
    .sort((a, b) => b.peso - a.peso);

  for (const preferencia of preferencias) {
    if (esIdioma(preferencia.base)) return preferencia.base;
  }
  return null;
}

/**
 * El prefijo que lleva una ruta en este idioma. El castellano no lleva.
 *
 * Toma un string cualquiera porque `getLocale()` devuelve string: lo que no
 * sea un idioma nuestro cae al de la casa, que es el comportamiento correcto
 * y evita tener que validar en cada pantalla.
 */
export function prefijoDe(idioma: string): string {
  return esIdioma(idioma) && idioma !== IDIOMA_POR_DEFECTO ? `/${idioma}` : "";
}

/** Separa "/en/panel" en su idioma y la ruta sin prefijo. */
export function partirRuta(pathname: string): { idioma: Idioma; resto: string } {
  for (const idioma of IDIOMAS) {
    if (idioma === IDIOMA_POR_DEFECTO) continue;
    if (pathname === `/${idioma}`) return { idioma, resto: "/" };
    if (pathname.startsWith(`/${idioma}/`)) {
      return { idioma, resto: pathname.slice(idioma.length + 1) };
    }
  }
  return { idioma: IDIOMA_POR_DEFECTO, resto: pathname };
}

/** La misma ruta, en el otro idioma. Lo que usa el selector del pie. */
export function rutaEnIdioma(pathname: string, idioma: Idioma): string {
  const { resto } = partirRuta(pathname);
  const prefijo = prefijoDe(idioma);
  if (resto === "/") return prefijo === "" ? "/" : prefijo;
  return `${prefijo}${resto}`;
}

/**
 * El idioma con el que hablarle a alguien, respetando lo que esté prendido.
 *
 * La preferencia guardada no se toca: si alguien eligió inglés y mañana lo
 * apagamos, ve el castellano, y el día que vuelva a prenderse recupera el
 * inglés sin tener que elegirlo de nuevo.
 */
export function idiomaParaMostrar(guardado: string | null | undefined): Idioma {
  return guardado && estaActivo(guardado) ? (guardado as Idioma) : idiomaDeRespaldo();
}
