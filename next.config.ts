import type { NextConfig } from "next";

/*
 * Cabeceras de seguridad.
 *
 * `connect-src` tiene que incluir el proyecto de Supabase: de ahí salen las
 * consultas y las URLs firmadas de los comprobantes. Se lee del entorno en el
 * build, así que cambiar de proyecto no pide tocar este archivo.
 */
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

const CSP = [
  "default-src 'self'",
  /*
   * Next inyecta scripts en línea para arrancar la página. Sin un nonce hay
   * que permitirlos; igual sirve, porque lo que corta es traer código de otro
   * dominio, que es por donde entra un XSS de verdad.
   */
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // blob: es para abrir el recibo y el perfil en PDF que genera el servidor.
  "img-src 'self' data: blob:",
  `connect-src 'self' ${supabase}`.trim(),
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Nadie puede meter Inkey en un iframe: ahí viven los robos de clics.
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const CABECERAS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  /*
   * Los tokens viajan en la URL (invitación, perfil compartido, confirmar un
   * pago). Con esto, al pedir una tipografía o seguir un link afuera, el
   * navegador manda el dominio y no la dirección completa.
   */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS }];
  },
};

export default nextConfig;
