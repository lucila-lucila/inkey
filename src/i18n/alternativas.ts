import type { Metadata } from "next";
import { idiomaDeRespaldo, idiomasActivos } from "./activos";
import { prefijoDe } from "./idioma";

/*
 * Las etiquetas `hreflang` de una pantalla.
 *
 * Le dicen al buscador que `/` y `/en` son la misma página en dos idiomas y
 * no dos páginas compitiendo. `x-default` apunta al idioma de respaldo, que
 * es donde cae quien pida uno apagado.
 *
 * Un idioma apagado no se declara: hoy esa dirección redirige.
 */
export function alternativasDeIdioma(ruta: string, idioma: string): Metadata["alternates"] {
  const limpia = ruta === "/" ? "" : ruta;
  const activos = idiomasActivos();
  const respaldo = idiomaDeRespaldo();

  const idiomas: Record<string, string> = {};
  for (const cada of activos) {
    idiomas[cada] = `${prefijoDe(cada)}${limpia}` || "/";
  }
  idiomas["x-default"] = `${prefijoDe(respaldo)}${limpia}` || "/";

  const propio = activos.includes(idioma as never) ? idioma : respaldo;
  return {
    canonical: `${prefijoDe(propio)}${limpia}` || "/",
    languages: idiomas,
  };
}
