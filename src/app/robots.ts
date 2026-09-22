import type { MetadataRoute } from "next";
import { serverEnv } from "@/lib/env";

/*
 * Lo único indexable es la landing. Todo lo demás ya manda `noindex` en su
 * metadata; esto lo dice además en la puerta, para que un buscador ni siquiera
 * pida las pantallas privadas ni los perfiles compartidos.
 *
 * `host` marca cuál es el dominio bueno: si el sitio también responde por la
 * URL del deploy de Vercel, esa copia no compite con la real.
 */
export default function robots(): MetadataRoute.Robots {
  const site = serverEnv.siteUrl;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
       * Las mismas pantallas privadas existen con prefijo de idioma: hay que
       * nombrar las dos formas o el inglés queda abierto.
       */
      disallow: [
        "/panel",
        "/onboarding",
        "/ingresar",
        "/alquileres",
        "/pagos",
        "/perfil",
        "/cuenta",
        "/p/",
        "/invitacion/",
        "/api/",
        "/auth/",
        "/en/panel",
        "/en/onboarding",
        "/en/ingresar",
        "/en/alquileres",
        "/en/pagos",
        "/en/perfil",
        "/en/cuenta",
        "/en/p/",
        "/en/invitacion/",
      ],
    },
    sitemap: new URL("/sitemap.xml", site).toString(),
    host: new URL(site).host,
  };
}
