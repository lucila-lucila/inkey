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
    "CRON_SECRET",
  ],
} as const;

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
  /** Protege los endpoints que dispara Vercel Cron. */
  get cronSecret() {
    return leer("CRON_SECRET");
  },
  get siteUrl() {
    return leer("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
  },
};

/** Qué falta configurar. Lo usa /api/salud para poder diagnosticar de una. */
export function variablesFaltantes(): { imprescindibles: string[]; secundarias: string[] } {
  return {
    imprescindibles: VARIABLES.imprescindibles.filter((nombre) => !leer(nombre)),
    secundarias: VARIABLES.secundarias.filter((nombre) => !leer(nombre)),
  };
}
