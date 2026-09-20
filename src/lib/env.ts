import "server-only";

/*
 * Variables de entorno del servidor. Se leen una sola vez y se validan acá,
 * así una config incompleta falla temprano y con un mensaje claro en vez de
 * romper en medio de un flujo.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Mirá .env.example y cargala antes de levantar la app.`,
    );
  }
  return value;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  /** Solo para tareas administrativas del servidor. Nunca llega al cliente. */
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** Sal para hashear la IP en el rate limiting: no guardamos IPs en claro. */
  get rateLimitSalt() {
    return required("RATE_LIMIT_SALT");
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
};
