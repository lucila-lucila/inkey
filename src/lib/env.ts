import "server-only";

/*
 * Variables de entorno del servidor.
 *
 * Distinguimos dos clases:
 *   - las IMPRESCINDIBLES (Supabase): sin ellas la app no puede funcionar y
 *     falla con un mensaje claro;
 *   - las de tareas SECUNDARIAS (rate limiting, bitácora): si faltan, la app
 *     sigue andando, lo avisa en los logs y lo reporta en /api/salud.
 *     Una tarea secundaria nunca puede tirar abajo lo que la persona vino a
 *     hacer.
 */

export const VARIABLES = {
  imprescindibles: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  secundarias: [
    "SUPABASE_SERVICE_ROLE_KEY",
    "RATE_LIMIT_SALT",
    "SHARE_LINK_SECRET",
    "NEXT_PUBLIC_SITE_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "EMAIL_REPLY_TO",
    "CRON_SECRET",
    "IDIOMAS_ACTIVOS",
  ],
} as const;

/** Para no llenar los logs con el mismo aviso en cada request. */
const avisosDados = new Set<string>();
function avisarUnaVez(mensaje: string): void {
  if (avisosDados.has(mensaje)) return;
  avisosDados.add(mensaje);
  console.warn(`[inkey] ${mensaje}`);
}

const SITIO_POR_DEFECTO = "http://localhost:3000";

/**
 * El dominio del sitio, sí o sí usable.
 *
 * De acá salen los links de los mails, las URLs canónicas y `metadataBase`.
 * Un valor mal escrito (sin `https://`, con una barra de más) hacía explotar
 * el build entero: una variable mal cargada no puede tirar abajo la app.
 */
export function normalizarSitio(valor: string | null | undefined): string {
  if (!valor) return SITIO_POR_DEFECTO;
  const limpio = valor.trim().replace(/\/+$/, "");

  for (const candidato of [limpio, `https://${limpio}`]) {
    try {
      const url = new URL(candidato);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      /* probamos la forma siguiente */
    }
  }

  avisarUnaVez(
    `NEXT_PUBLIC_SITE_URL no es una URL válida ("${valor}"): uso ${SITIO_POR_DEFECTO}. Cargala como https://tu-dominio.`,
  );
  return SITIO_POR_DEFECTO;
}

function leer(nombre: string): string | null {
  const valor = process.env[nombre];
  return valor && valor.trim() !== "" ? valor : null;
}

function requerida(nombre: string): string {
  const valor = leer(nombre);
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Mirá .env.example y cargala antes de levantar la app.`,
    );
  }
  return valor;
}

export const serverEnv = {
  get supabaseUrl() {
    return requerida("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return requerida("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  /** Solo para tareas administrativas del servidor. Nunca llega al cliente. */
  get supabaseServiceRoleKey() {
    return leer("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** Sal para hashear la IP en el rate limiting: no guardamos IPs en claro. */
  get rateLimitSalt() {
    return leer("RATE_LIMIT_SALT");
  },
  /**
   * Clave con la que se derivan los tokens de los links de perfil. Sin ella
   * no se pueden crear ni volver a mostrar: la pantalla lo dice y /api/salud
   * lo marca.
   */
  get shareLinkSecret() {
    return leer("SHARE_LINK_SECRET");
  },
  /** Resend. Sin esto no salen mails, pero la app sigue funcionando. */
  get resendApiKey() {
    return leer("RESEND_API_KEY");
  },
  /**
   * Remitente de los mails. Hasta tener dominio propio verificado, el de
   * prueba de Resend, que solo escribe a la casilla de la cuenta.
   */
  get emailFrom() {
    return leer("EMAIL_FROM") ?? "Inkey <onboarding@resend.dev>";
  },
  /**
   * A dónde contesta la gente cuando responde un aviso. Los avisos salen de
   * una dirección que nadie lee; las respuestas tienen que llegar a una que sí.
   */
  get emailReplyTo() {
    return leer("EMAIL_REPLY_TO");
  },
  /** Protege los endpoints que dispara Vercel Cron. */
  get cronSecret() {
    return leer("CRON_SECRET");
  },
  get siteUrl() {
    return normalizarSitio(leer("NEXT_PUBLIC_SITE_URL"));
  },
};

/** Qué falta configurar. Lo usa /api/salud para poder diagnosticar de una. */
export function variablesFaltantes(): { imprescindibles: string[]; secundarias: string[] } {
  return {
    imprescindibles: VARIABLES.imprescindibles.filter((nombre) => !leer(nombre)),
    secundarias: VARIABLES.secundarias.filter((nombre) => !leer(nombre)),
  };
}
