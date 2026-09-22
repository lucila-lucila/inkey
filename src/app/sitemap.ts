import type { MetadataRoute } from "next";
import { prefijoDe } from "@/i18n/idioma";
import { IDIOMAS } from "@/i18n/routing";
import { serverEnv } from "@/lib/env";

/*
 * La landing y los textos legales, en los dos idiomas: el resto del producto
 * es privado.
 *
 * Cada entrada declara sus alternativas con `languages`, que es lo que Next
 * escribe como `hreflang` en el sitemap. Sin eso, las dos versiones de la
 * misma página compiten entre sí en el buscador en vez de sumarse.
 */

const PAGINAS = [
  { ruta: "/", changeFrequency: "weekly" as const, priority: 1 },
  { ruta: "/terminos", changeFrequency: "yearly" as const, priority: 0.3 },
  { ruta: "/privacidad", changeFrequency: "yearly" as const, priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (ruta: string) => new URL(ruta || "/", serverEnv.siteUrl).toString();

  return PAGINAS.flatMap((pagina) => {
    const limpia = pagina.ruta === "/" ? "" : pagina.ruta;
    const alternativas = Object.fromEntries(
      IDIOMAS.map((idioma) => [idioma, url(`${prefijoDe(idioma)}${limpia}`)]),
    );

    return IDIOMAS.map((idioma) => ({
      url: url(`${prefijoDe(idioma)}${limpia}`),
      changeFrequency: pagina.changeFrequency,
      priority: pagina.priority,
      alternates: { languages: alternativas },
    }));
  });
}
