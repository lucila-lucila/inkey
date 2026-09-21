/*
 * Tests contra un Postgres de verdad.
 *
 *   pnpm test:rls
 *
 * Dos familias de casos, sobre la misma base efímera:
 *
 *   - los de RLS responden "¿puede esta persona leer o tocar algo que no es
 *     suyo?". Si alguno falla, hay un agujero de seguridad.
 *   - los de FLUJO recorren el camino completo de alguien usando la app
 *     (registrar, invitar, pagar, compartir, terminar, reseñar, darse de
 *     baja) con las mismas funciones que llama el código.
 */
import { UID_A, UID_B, UID_C, UID_D, type Caso } from "./apoyo";
import { CASOS_BASE } from "./casos-base";
import { CASOS_ALQUILERES } from "./casos-alquileres";
import { CASOS_PAGOS } from "./casos-pagos";
import { CASOS_PERFIL } from "./casos-perfil";
import { CASOS_RESENAS } from "./casos-resenas";
import { CASOS_AVISOS } from "./casos-avisos";
import { CASOS_FLUJOS } from "./casos-flujos";
import { buscarBinariosPg, levantarCluster } from "./cluster";

const CASOS: Caso[] = [
  ...CASOS_BASE,
  ...CASOS_ALQUILERES,
  ...CASOS_PAGOS,
  ...CASOS_PERFIL,
  ...CASOS_RESENAS,
  ...CASOS_AVISOS,
  ...CASOS_FLUJOS,
];

async function main(): Promise<void> {
  if (!buscarBinariosPg()) {
    console.error(
      "No encontré los binarios de Postgres. Instalá postgresql-16 (o corré `supabase start`) y volvé a intentar.",
    );
    process.exit(1);
  }

  const cluster = await levantarCluster();
  let fallidos = 0;

  try {
    // Tres personas de prueba: A inquilina, B dueño, C ajena a todo.
    // El trigger les crea el perfil.
    await cluster.client.query(
      "insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6), ($7, $8)",
      [
        UID_A,
        "ana@mail.com",
        UID_B,
        "belen@mail.com",
        UID_C,
        "carlos@mail.com",
        UID_D,
        "dalia@mail.com",
      ],
    );
    await cluster.client.query(
      "update public.profiles set first_name = 'Ana', last_name = 'Rossi' where id = $1",
      [UID_A],
    );
    await cluster.client.query(
      "update public.profiles set first_name = 'Belén', last_name = 'Díaz' where id = $1",
      [UID_B],
    );
    await cluster.client.query(
      "update public.profiles set first_name = 'Carlos', last_name = 'Pérez' where id = $1",
      [UID_C],
    );
    await cluster.client.query(
      "update public.profiles set first_name = 'Dalia', last_name = 'Quiroga' where id = $1",
      [UID_D],
    );

    for (const caso of CASOS) {
      try {
        await cluster.client.query("reset role");
        await caso.correr(cluster.client);
        console.log(`  ✓ ${caso.nombre}`);
      } catch (error) {
        fallidos += 1;
        console.error(`  ✗ ${caso.nombre}`);
        console.error(`    ${(error as Error).message}`);
      }
    }
  } finally {
    await cluster.detener();
  }

  console.log(
    fallidos === 0
      ? `\n${CASOS.length} pruebas contra Postgres en verde (RLS y flujos).`
      : `\n${fallidos} de ${CASOS.length} pruebas contra Postgres fallaron.`,
  );
  process.exit(fallidos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
