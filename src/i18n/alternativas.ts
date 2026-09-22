import type { Metadata } from "next";
import { IDIOMAS, IDIOMA_POR_DEFECTO } from "./routing";
import { prefijoDe } from "./idioma";

/*
 * Las etiquetas `hreflang` de una pantalla.
 *
 * Le dicen al buscador que `/` y `/en` son la misma página en dos idiomas y
 * no dos páginas compitiendo. `x-default` apunta al castellano, que es de
 * donde viene casi todo el tráfico.
 */
export function alternativasDeIdioma(ruta: string, idioma: string): Metadata["alternates"] {
  const limpia = ruta === "/" ? "" : ruta;
  const idiomas: Record<string, string> = {};

  for (const cada of IDIOMAS) {
    idiomas[cada] = `${prefijoDe(cada)}${limpia}` || "/";
  }
  idiomas["x-default"] = limpia || "/";

  return {
    canonical: `${prefijoDe(idioma === "en" ? "en" : IDIOMA_POR_DEFECTO)}${limpia}` || "/",
    languages: idiomas,
  };
}
