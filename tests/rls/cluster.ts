import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";

/*
 * Levanta un Postgres efímero, le aplica el bootstrap de Supabase y todas las
 * migraciones del repo. Sin Docker: alcanza con los binarios de Postgres.
 */

const CARPETAS_BIN = ["/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/17/bin", "/usr/pgsql-16/bin"];

export function buscarBinariosPg(): string | null {
  for (const carpeta of CARPETAS_BIN) {
    if (existsSync(join(carpeta, "pg_ctl"))) return carpeta;
  }
  try {
    const ruta = execFileSync("which", ["pg_ctl"], { encoding: "utf8" }).trim();
    if (ruta) return ruta.replace(/\/pg_ctl$/, "");
  } catch {
    /* no está instalado */
  }
  return null;
}

export type Cluster = {
  client: Client;
  detener: () => Promise<void>;
};

/** Postgres no corre como root: si somos root, delegamos en el usuario postgres. */
function correr(comando: string): void {
  const somosRoot = typeof process.getuid === "function" && process.getuid() === 0;
  if (somosRoot) {
    execFileSync("su", ["postgres", "-c", comando], { stdio: "pipe" });
  } else {
    execFileSync("sh", ["-c", comando], { stdio: "pipe" });
  }
}

export async function levantarCluster(): Promise<Cluster> {
  const bin = buscarBinariosPg();
  if (!bin) throw new Error("No encontré los binarios de Postgres.");

  const dir = mkdtempSync(join(tmpdir(), "inkey-rls-"));
  const somosRoot = typeof process.getuid === "function" && process.getuid() === 0;
  if (somosRoot) {
    execFileSync("chown", ["-R", "postgres:postgres", dir]);
    execFileSync("chmod", ["755", dir]);
  }

  correr(`${bin}/initdb -D ${dir}/data -U postgres --auth=trust --no-sync -E UTF8 --locale=C`);
  // Solo socket unix dentro del directorio temporal: no abrimos ningún puerto.
  correr(`${bin}/pg_ctl -D ${dir}/data -o "-k ${dir} -h ''" -l ${dir}/log.txt -w start`);

  const client = new Client({ host: dir, user: "postgres", database: "postgres" });
  await client.connect();

  const raiz = join(import.meta.dirname, "..", "..");
  await client.query(readFileSync(join(raiz, "tests/rls/bootstrap.sql"), "utf8"));

  const carpetaMigraciones = join(raiz, "supabase/migrations");
  const migraciones = readdirSync(carpetaMigraciones)
    .filter((nombre) => nombre.endsWith(".sql"))
    .sort();

  for (const migracion of migraciones) {
    try {
      await client.query(readFileSync(join(carpetaMigraciones, migracion), "utf8"));
    } catch (error) {
      throw new Error(`Falló la migración ${migracion}: ${(error as Error).message}`);
    }
  }

  return {
    client,
    async detener() {
      await client.end();
      try {
        correr(`${bin}/pg_ctl -D ${dir}/data -m immediate stop`);
      } catch {
        /* ya estaba apagado */
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
