/*
 * Tests de Row Level Security contra un Postgres de verdad.
 *
 *   pnpm test:rls
 *
 * Cada caso responde a una pregunta concreta: ¿puede esta persona leer o
 * tocar algo que no es suyo? Si alguno falla, hay un agujero de seguridad.
 */
import type { Client } from "pg";
import { buscarBinariosPg, levantarCluster } from "./cluster";

const PERMISO_DENEGADO = "42501";
const UID_A = "11111111-1111-4111-8111-111111111111";
const UID_B = "22222222-2222-4222-8222-222222222222";

type Caso = { nombre: string; correr: (client: Client) => Promise<void> };

function afirmar(condicion: boolean, mensaje: string): void {
  if (!condicion) throw new Error(mensaje);
}

/** Corre una consulta con el rol y el usuario indicados, y deshace todo al final. */
async function como<T>(
  client: Client,
  rol: "anon" | "authenticated" | "service_role",
  uid: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    if (uid) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: rol }),
      ]);
    }
    await client.query(`set local role ${rol}`);
    return await fn();
  } finally {
    await client.query("rollback");
  }
}

/*
 * Una consulta que falla aborta la transacción entera, así que cada intento
 * que esperamos que falle va dentro de su propio savepoint.
 */
async function esperarError(
  client: Client,
  codigoEsperado: string,
  fn: () => Promise<unknown>,
  que: string,
): Promise<void> {
  const punto = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${punto}`);
  try {
    await fn();
  } catch (error) {
    await client.query(`rollback to savepoint ${punto}`);
    const codigo = (error as { code?: string }).code;
    afirmar(
      codigo === codigoEsperado,
      `${que}: esperaba el error ${codigoEsperado} y salió ${codigo}`,
    );
    return;
  }
  await client.query(`release savepoint ${punto}`);
  throw new Error(`${que}: la operación se permitió y no debería`);
}

function esperarPermisoDenegado(
  client: Client,
  fn: () => Promise<unknown>,
  que: string,
): Promise<void> {
  return esperarError(client, PERMISO_DENEGADO, fn, que);
}

const CASOS: Caso[] = [
  {
    nombre: "el alta en auth.users crea el perfil automáticamente",
    async correr(client) {
      const { rows } = await client.query("select id from public.profiles where id = $1", [UID_A]);
      afirmar(rows.length === 1, "no se creó el perfil de A");
    },
  },
  {
    nombre: "cada persona ve únicamente su propio perfil",
    async correr(client) {
      const filas = await como(client, "authenticated", UID_A, async () => {
        const { rows } = await client.query("select id from public.profiles");
        return rows;
      });
      afirmar(filas.length === 1, `A ve ${filas.length} perfiles y debería ver 1`);
      afirmar(filas[0].id === UID_A, "A está viendo un perfil que no es el suyo");
    },
  },
  {
    nombre: "el perfil ajeno no se puede leer ni pidiéndolo por id",
    async correr(client) {
      const filas = await como(client, "authenticated", UID_A, async () => {
        const { rows } = await client.query("select id from public.profiles where id = $1", [UID_B]);
        return rows;
      });
      afirmar(filas.length === 0, "A pudo leer el perfil de B");
    },
  },
  {
    nombre: "el perfil ajeno no se puede editar",
    async correr(client) {
      const afectadas = await como(client, "authenticated", UID_A, async () => {
        const res = await client.query(
          "update public.profiles set first_name = 'Hackeada' where id = $1",
          [UID_B],
        );
        return res.rowCount ?? 0;
      });
      afirmar(afectadas === 0, "A modificó el perfil de B");

      const { rows } = await client.query("select first_name from public.profiles where id = $1", [
        UID_B,
      ]);
      afirmar(rows[0].first_name === "Belén", "el nombre de B cambió");
    },
  },
  {
    nombre: "el perfil propio sí se puede editar",
    async correr(client) {
      const afectadas = await como(client, "authenticated", UID_A, async () => {
        const res = await client.query(
          "update public.profiles set first_name = 'Ana María' where id = $1",
          [UID_A],
        );
        return res.rowCount ?? 0;
      });
      afirmar(afectadas === 1, "A no pudo editar su propio perfil");
    },
  },
  {
    nombre: "no se puede mudar el perfil propio al id de otra persona",
    async correr(client) {
      await como(client, "authenticated", UID_A, () =>
        esperarPermisoDenegado(
          client,
          () => client.query("update public.profiles set id = $1 where id = $2", [UID_B, UID_A]),
          "cambiar el id del perfil",
        ),
      );
    },
  },
  {
    nombre: "authenticated no puede insertar ni borrar perfiles",
    async correr(client) {
      await como(client, "authenticated", UID_A, async () => {
        await esperarPermisoDenegado(
          client,
          () =>
            client.query("insert into public.profiles (id) values ($1)", [
              "33333333-3333-4333-8333-333333333333",
            ]),
          "insertar un perfil",
        );
        await esperarPermisoDenegado(
          client,
          () => client.query("delete from public.profiles where id = $1", [UID_A]),
          "borrar un perfil",
        );
      });
    },
  },
  {
    nombre: "anon no puede leer ningún perfil",
    async correr(client) {
      await como(client, "anon", null, () =>
        esperarPermisoDenegado(
          client,
          () => client.query("select * from public.profiles"),
          "leer perfiles como anónimo",
        ),
      );
    },
  },
  {
    nombre: "la lista de espera no se lee ni se escribe desde el cliente",
    async correr(client) {
      await como(client, "anon", null, async () => {
        await esperarPermisoDenegado(
          client,
          () => client.query("select * from public.waitlist_signups"),
          "leer la lista de espera como anónimo",
        );
        await esperarPermisoDenegado(
          client,
          () =>
            client.query("insert into public.waitlist_signups (email, role) values ($1, $2)", [
              "cualquiera@mail.com",
              "inquilino",
            ]),
          "anotar en la lista de espera como anónimo",
        );
      });
      await como(client, "authenticated", UID_A, () =>
        esperarPermisoDenegado(
          client,
          () => client.query("select * from public.waitlist_signups"),
          "leer la lista de espera con sesión",
        ),
      );
    },
  },
  {
    nombre: "el servidor sí puede anotar en la lista de espera",
    async correr(client) {
      await como(client, "service_role", null, async () => {
        await client.query("insert into public.waitlist_signups (email, role) values ($1, $2)", [
          "martina@mail.com",
          "inquilino",
        ]);
        const { rows } = await client.query("select count(*)::int as total from public.waitlist_signups");
        afirmar(rows[0].total === 1, "el servidor no pudo escribir en la lista de espera");
      });
    },
  },
  {
    nombre: "el mail de la lista de espera no distingue mayúsculas",
    async correr(client) {
      await como(client, "service_role", null, async () => {
        await client.query("insert into public.waitlist_signups (email, role) values ($1, $2)", [
          "martina@mail.com",
          "inquilino",
        ]);
        await esperarError(
          client,
          "23505",
          () =>
            client.query("insert into public.waitlist_signups (email, role) values ($1, $2)", [
              "MARTINA@mail.com",
              "propietario",
            ]),
          "anotar el mismo mail con otras mayúsculas",
        );
      });
    },
  },
  {
    nombre: "la bitácora no se lee ni se escribe desde el cliente",
    async correr(client) {
      await como(client, "authenticated", UID_A, async () => {
        await esperarPermisoDenegado(
          client,
          () => client.query("select * from public.audit_log"),
          "leer la bitácora",
        );
        await esperarPermisoDenegado(
          client,
          () =>
            client.query(
              "insert into public.audit_log (action, entity_type) values ('falso', 'profile')",
            ),
          "escribir en la bitácora",
        );
      });
    },
  },
  {
    nombre: "el rate limit no se puede llamar desde el cliente",
    async correr(client) {
      await como(client, "authenticated", UID_A, () =>
        esperarPermisoDenegado(
          client,
          () => client.query("select public.rate_limit_hit('ingreso', 'x', 5, 60)"),
          "llamar a rate_limit_hit con sesión",
        ),
      );
      await como(client, "anon", null, () =>
        esperarPermisoDenegado(
          client,
          () => client.query("select public.rate_limit_hit('ingreso', 'x', 5, 60)"),
          "llamar a rate_limit_hit como anónimo",
        ),
      );
    },
  },
  {
    nombre: "el rate limit corta cuando se pasa del límite",
    async correr(client) {
      await como(client, "service_role", null, async () => {
        for (let intento = 1; intento <= 3; intento += 1) {
          const { rows } = await client.query(
            "select public.rate_limit_hit('ingreso', 'huella-1', 3, 3600) as r",
          );
          afirmar(rows[0].r.allowed === true, `el intento ${intento} debería estar permitido`);
        }
        const { rows } = await client.query(
          "select public.rate_limit_hit('ingreso', 'huella-1', 3, 3600) as r",
        );
        afirmar(rows[0].r.allowed === false, "el cuarto intento debería estar cortado");
        afirmar(rows[0].r.retry_after_seconds > 0, "tendría que decir cuánto esperar");
      });
    },
  },
  {
    nombre: "el rate limit vuelve a permitir cuando pasa la ventana",
    async correr(client) {
      await client.query(
        `insert into public.rate_limit_events (bucket, identifier, created_at)
         select 'ingreso', 'huella-vieja', now() - interval '2 hours' from generate_series(1, 5)`,
      );
      await como(client, "service_role", null, async () => {
        const { rows } = await client.query(
          "select public.rate_limit_hit('ingreso', 'huella-vieja', 3, 3600) as r",
        );
        afirmar(rows[0].r.allowed === true, "los intentos viejos no deberían contar");
      });
      await client.query("delete from public.rate_limit_events where identifier = 'huella-vieja'");
    },
  },
  {
    nombre: "profile_is_onboarded refleja si falta completar el onboarding",
    async correr(client) {
      const sinCompletar = await client.query(
        "select public.profile_is_onboarded(p) as listo from public.profiles p where id = $1",
        [UID_A],
      );
      afirmar(sinCompletar.rows[0].listo === false, "A no completó el onboarding y da true");

      await client.query(
        `update public.profiles
            set accepted_terms_at = now(), accepted_privacy_at = now()
          where id = $1`,
        [UID_A],
      );
      const completo = await client.query(
        "select public.profile_is_onboarded(p) as listo from public.profiles p where id = $1",
        [UID_A],
      );
      afirmar(completo.rows[0].listo === true, "A ya completó el onboarding y da false");
    },
  },
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
    // Dos personas de prueba. El trigger les crea el perfil.
    await cluster.client.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [
      UID_A,
      "ana@mail.com",
      UID_B,
      "belen@mail.com",
    ]);
    await cluster.client.query(
      "update public.profiles set first_name = 'Ana', last_name = 'Rossi' where id = $1",
      [UID_A],
    );
    await cluster.client.query(
      "update public.profiles set first_name = 'Belén', last_name = 'Díaz' where id = $1",
      [UID_B],
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
      ? `\n${CASOS.length} pruebas de RLS en verde.`
      : `\n${fallidos} de ${CASOS.length} pruebas de RLS fallaron.`,
  );
  process.exit(fallidos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
