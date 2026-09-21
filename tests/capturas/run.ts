import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { levantarCluster } from "../rls/cluster";
import { levantarSupabaseFalso } from "./supabase-falso";
import { recorrerPantallas } from "./pantallas";

/*
 * Saca las capturas de todas las pantallas de la app, en escritorio y en
 * celular, con los datos de `supabase/seed.sql`.
 *
 *   pnpm capturas
 *
 * Levanta un Postgres efímero con las migraciones y el seed, le pone delante
 * un Supabase de mentira (ver `supabase-falso.ts`) y corre un Next de verdad
 * apuntado ahí. Las capturas van a `docs/capturas/estado-actual/`.
 */

const RAIZ = join(import.meta.dirname, "..", "..");
const SALIDA = join(RAIZ, "docs", "capturas", "estado-actual");
const PUERTO_SUPABASE = 54400 + Math.floor(Math.random() * 400);
// Un puerto libre por corrida: un servidor colgado de antes no arruina esta.
const PUERTO_APP = 3400 + Math.floor(Math.random() * 400);

async function main() {
  console.log("1/4  Levantando Postgres con las migraciones…");
  const cluster = await levantarCluster();

  console.log("2/4  Cargando el seed…");
  await cluster.client.query(readFileSync(join(RAIZ, "supabase/seed.sql"), "utf8"));

  /*
   * Next atiende varias consultas a la vez: el shim necesita una conexión por
   * request, o las transacciones se pisan entre sí.
   */
  const pool = new Pool({
    host: cluster.client.host,
    user: "postgres",
    database: "postgres",
    max: 12,
  });

  const falso = await levantarSupabaseFalso(pool, PUERTO_SUPABASE);
  console.log(`     Supabase de mentira en ${falso.url}`);

  console.log("3/4  Compilando y levantando la app…");
  const entorno = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: falso.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: falso.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: falso.serviceKey,
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PUERTO_APP}`,
    RATE_LIMIT_SALT: "sal-de-capturas",
    SHARE_LINK_SECRET: "secreto-de-capturas",
    CRON_SECRET: "cron-de-capturas",
    PORT: String(PUERTO_APP),
  };

  await correr("pnpm", ["build"], entorno);
  const app = spawn("pnpm", ["start"], { cwd: RAIZ, env: entorno, stdio: "pipe" });
  app.stderr.on("data", (dato) => process.stderr.write(`[app] ${dato}`));
  app.stdout.on("data", (dato) => {
    const texto = String(dato);
    if (/Error|error|⨯/.test(texto)) process.stderr.write(`[app] ${texto}`);
  });
  await esperar(`http://127.0.0.1:${PUERTO_APP}/`);

  console.log("4/4  Sacando las capturas…");
  mkdirSync(SALIDA, { recursive: true });
  let error: unknown = null;
  try {
    await recorrerPantallas({
      base: `http://127.0.0.1:${PUERTO_APP}`,
      salida: SALIDA,
      client: cluster.client,
    });
  } catch (e) {
    error = e;
  }

  app.kill("SIGTERM");
  await falso.detener();
  await pool.end();
  await cluster.detener();

  if (error) throw error;
  console.log(`\nListo. Las capturas están en docs/capturas/estado-actual/`);
}

function correr(comando: string, argumentos: string[], entorno: NodeJS.ProcessEnv) {
  return new Promise<void>((listo, falla) => {
    const proceso = spawn(comando, argumentos, { cwd: RAIZ, env: entorno, stdio: "pipe" });
    let salida = "";
    proceso.stdout.on("data", (dato) => (salida += dato));
    proceso.stderr.on("data", (dato) => (salida += dato));
    proceso.on("exit", (codigo) =>
      codigo === 0 ? listo() : falla(new Error(`${comando} falló:\n${salida.slice(-3000)}`)),
    );
  });
}

async function esperar(url: string) {
  for (let intento = 0; intento < 60; intento++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((listo) => setTimeout(listo, 1000));
    }
  }
  throw new Error(`La app no levantó en ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
