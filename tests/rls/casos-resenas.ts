import type { Client } from "pg";
import {
  afirmar,
  como,
  comoPersistente,
  crearAlquilerDePrueba,
  crearPersona,
  esperarPermisoDenegado,
  UID_B,
  UID_C,
  type Caso,
} from "./apoyo";

/** Fase 5: fin de contrato y reseñas. */

type Escenario = { rental: string; inquilina: string; dueno: string };

/** Un alquiler activo entre dos personas nuevas. */
async function escenario(client: Client): Promise<Escenario> {
  const inquilina = await crearPersona(client, "Dalia", "Quiroga");
  const dueno = await crearPersona(client, "Bruno", "Leiva");
  const rental = await crearAlquilerDePrueba(client, {
    creador: inquilina,
    rol: "tenant",
    contraparte: dueno,
    estado: "active",
  });
  return { rental, inquilina, dueno };
}

async function llamar(
  client: Client,
  uid: string | null,
  sql: string,
  parametros: unknown[] = [],
): Promise<{ ok: boolean; error?: string; publicada?: boolean }> {
  return comoPersistente(client, uid ? "authenticated" : "anon", uid, async () => {
    const { rows } = await client.query(sql, parametros);
    return rows[0].r;
  });
}

/** Termina el contrato de verdad: uno propone, el otro confirma. */
async function terminar(client: Client, caso: Escenario): Promise<void> {
  const propuesta = await llamar(client, caso.inquilina, "select public.rental_request_end($1) as r", [
    caso.rental,
  ]);
  afirmar(propuesta.ok === true, `no se pudo proponer el fin: ${propuesta.error}`);

  const confirmacion = await llamar(client, caso.dueno, "select public.rental_confirm_end($1) as r", [
    caso.rental,
  ]);
  afirmar(confirmacion.ok === true, `no se pudo confirmar el fin: ${confirmacion.error}`);
}

export const CASOS_RESENAS: Caso[] = [
  {
    nombre: "el contrato termina de a dos: uno propone y el otro confirma",
    async correr(client) {
      const caso = await escenario(client);

      const propuesta = await llamar(
        client,
        caso.inquilina,
        "select public.rental_request_end($1) as r",
        [caso.rental],
      );
      afirmar(propuesta.ok === true, `no se pudo proponer: ${propuesta.error}`);

      const { rows: enCurso } = await client.query(
        "select status, end_requested_by from public.rentals where id = $1",
        [caso.rental],
      );
      afirmar(enCurso[0].status === "pending_end", "el alquiler no quedó terminando");
      afirmar(enCurso[0].end_requested_by === caso.inquilina, "no quedó quién lo propuso");

      // Quien lo propuso no se lo confirma a sí mismo.
      const solo = await llamar(client, caso.inquilina, "select public.rental_confirm_end($1) as r", [
        caso.rental,
      ]);
      afirmar(solo.error === "lo_propusiste_vos", `esperaba lo_propusiste_vos y dio ${solo.error}`);

      const confirmacion = await llamar(
        client,
        caso.dueno,
        "select public.rental_confirm_end($1) as r",
        [caso.rental],
      );
      afirmar(confirmacion.ok === true, `no se pudo confirmar: ${confirmacion.error}`);

      const { rows: final } = await client.query(
        "select status, ended_at, end_date from public.rentals where id = $1",
        [caso.rental],
      );
      afirmar(final[0].status === "ended", "el alquiler no terminó");
      afirmar(final[0].ended_at !== null, "no quedó cuándo terminó");
      afirmar(final[0].end_date !== null, "no quedó la fecha de fin");
    },
  },
  {
    nombre: "un tercero no puede terminar un alquiler ajeno",
    async correr(client) {
      const caso = await escenario(client);

      const intento = await llamar(client, UID_C, "select public.rental_request_end($1) as r", [
        caso.rental,
      ]);
      afirmar(intento.error === "no_encontrado", "un tercero pudo proponer el fin");

      const { rows } = await client.query("select status from public.rentals where id = $1", [
        caso.rental,
      ]);
      afirmar(rows[0].status === "active", "el alquiler cambió de estado");
    },
  },
  {
    nombre: "quien propuso el fin puede dar marcha atrás",
    async correr(client) {
      const caso = await escenario(client);
      await llamar(client, caso.inquilina, "select public.rental_request_end($1) as r", [caso.rental]);

      const ajeno = await llamar(client, caso.dueno, "select public.rental_cancel_end($1) as r", [
        caso.rental,
      ]);
      afirmar(ajeno.ok === false, "el otro pudo cancelar una propuesta que no hizo");

      const propio = await llamar(client, caso.inquilina, "select public.rental_cancel_end($1) as r", [
        caso.rental,
      ]);
      afirmar(propio.ok === true, `no se pudo cancelar: ${propio.error}`);

      const { rows } = await client.query(
        "select status, end_requested_by from public.rentals where id = $1",
        [caso.rental],
      );
      afirmar(rows[0].status === "active", "el alquiler no volvió a estar activo");
      afirmar(rows[0].end_requested_by === null, "quedó colgada la propuesta");
    },
  },
  {
    nombre: "no se puede reseñar un alquiler que no terminó",
    async correr(client) {
      const caso = await escenario(client);

      const intento = await llamar(
        client,
        caso.inquilina,
        "select public.review_submit($1, $2, $3) as r",
        [caso.rental, "Todo bien", ["resolvio_arreglos_rapido"]],
      );
      afirmar(
        intento.error === "todavia_no_termino",
        `esperaba todavia_no_termino y dio ${intento.error}`,
      );
    },
  },
  {
    nombre: "nadie lee la reseña del otro antes de que se publiquen las dos",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      const dejada = await llamar(
        client,
        caso.inquilina,
        "select public.review_submit($1, $2, $3) as r",
        [caso.rental, "Resolvió todo rápido", ["resolvio_arreglos_rapido"]],
      );
      afirmar(dejada.ok === true, `no se pudo dejar la reseña: ${dejada.error}`);
      afirmar(dejada.publicada === false, "se publicó con una sola reseña escrita");

      // El dueño, que todavía no escribió la suya, no puede leerla.
      const delDueno = await como(client, "authenticated", caso.dueno, async () => {
        const { rows } = await client.query("select id from public.reviews where rental_id = $1", [
          caso.rental,
        ]);
        return rows;
      });
      afirmar(delDueno.length === 0, "el dueño leyó la reseña antes de escribir la suya");

      // Quien la escribió sí ve la propia.
      const propia = await como(client, "authenticated", caso.inquilina, async () => {
        const { rows } = await client.query("select id from public.reviews where rental_id = $1", [
          caso.rental,
        ]);
        return rows;
      });
      afirmar(propia.length === 1, "no puede ver su propia reseña");
    },
  },
  {
    nombre: "cuando están las dos, se publican juntas",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Resolvió todo rápido",
        ["resolvio_arreglos_rapido"],
      ]);
      const segunda = await llamar(client, caso.dueno, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Siempre al día",
        ["siempre_al_dia", "cuido_la_propiedad"],
      ]);
      afirmar(segunda.publicada === true, "no se publicaron al estar las dos");

      const { rows } = await client.query(
        "select count(*)::int as total from public.reviews where rental_id = $1 and published_at is not null",
        [caso.rental],
      );
      afirmar(rows[0].total === 2, "no quedaron publicadas las dos");

      // Y ahora cada uno ve la del otro.
      for (const uid of [caso.inquilina, caso.dueno]) {
        const vistas = await como(client, "authenticated", uid, async () => {
          const { rows: r } = await client.query(
            "select id from public.reviews where rental_id = $1",
            [caso.rental],
          );
          return r;
        });
        afirmar(vistas.length === 2, "no ve las dos reseñas una vez publicadas");
      }
    },
  },
  {
    nombre: "a los 14 días del fin, una reseña sola igual se puede mostrar",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Muy buen dueño",
        ["respeto_lo_acordado"],
      ]);

      // El dueño no escribió la suya, pero pasaron los 14 días.
      // (El trigger del alquiler no deja mover ended_at a mano: para el
      // escenario usamos la misma señal que usan las funciones.)
      await client.query("begin");
      await client.query("select set_config('inkey.transicion', 'on', true)");
      await client.query(
        "update public.rentals set ended_at = now() - interval '15 days' where id = $1",
        [caso.rental],
      );
      await client.query("commit");

      const vistas = await como(client, "authenticated", caso.dueno, async () => {
        const { rows } = await client.query("select id from public.reviews where rental_id = $1", [
          caso.rental,
        ]);
        return rows;
      });
      afirmar(vistas.length === 1, "pasados los 14 días la reseña debería mostrarse");

      // Y el cron la deja escrita.
      const { rows } = await client.query("select public.reviews_publish_due() as total");
      afirmar(rows[0].total >= 1, "el cron no publicó la reseña vencida");
    },
  },
  {
    nombre: "una reseña no se edita ni se borra",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);
      await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Todo bien",
        [],
      ]);

      await como(client, "authenticated", caso.inquilina, async () => {
        await esperarPermisoDenegado(
          client,
          () =>
            client.query("update public.reviews set text = 'otra cosa' where rental_id = $1", [
              caso.rental,
            ]),
          "editar una reseña",
        );
        await esperarPermisoDenegado(
          client,
          () => client.query("delete from public.reviews where rental_id = $1", [caso.rental]),
          "borrar una reseña",
        );
        await esperarPermisoDenegado(
          client,
          () =>
            client.query(
              `insert into public.reviews (rental_id, author_id, subject_id, direction, text)
               values ($1, $2, $3, 'tenant_to_owner', 'a mano')`,
              [caso.rental, caso.inquilina, caso.dueno],
            ),
          "escribir una reseña a mano",
        );
      });
    },
  },
  {
    nombre: "una sola reseña por persona y por alquiler",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Primera",
        [],
      ]);
      const segunda = await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Segunda",
        [],
      ]);
      afirmar(segunda.error === "ya_la_dejaste", `esperaba ya_la_dejaste y dio ${segunda.error}`);
    },
  },
  {
    nombre: "no se aceptan etiquetas de la otra dirección ni inventadas",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      // "siempre_al_dia" es del dueño hacia el inquilino.
      const cruzada = await llamar(
        client,
        caso.inquilina,
        "select public.review_submit($1, $2, $3) as r",
        [caso.rental, null, ["siempre_al_dia"]],
      );
      afirmar(cruzada.error === "etiqueta_invalida", "aceptó una etiqueta de la otra dirección");

      const inventada = await llamar(
        client,
        caso.inquilina,
        "select public.review_submit($1, $2, $3) as r",
        [caso.rental, null, ["el_mejor_del_mundo"]],
      );
      afirmar(inventada.error === "etiqueta_invalida", "aceptó una etiqueta inventada");
    },
  },
  {
    nombre: "una reseña vacía no se guarda, y el texto tiene tope",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      const vacia = await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "   ",
        [],
      ]);
      afirmar(vacia.error === "vacia", `esperaba vacia y dio ${vacia.error}`);

      const larga = await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "a".repeat(501),
        [],
      ]);
      afirmar(larga.error === "texto_largo", `esperaba texto_largo y dio ${larga.error}`);
    },
  },
  {
    nombre: "las reseñas publicadas aparecen en el perfil, sin decir quién las escribió",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      await llamar(client, caso.inquilina, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Resolvió todo rápido",
        ["resolvio_arreglos_rapido"],
      ]);
      await llamar(client, caso.dueno, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Siempre al día y cuidó el departamento",
        ["siempre_al_dia"],
      ]);

      const hash = `hash-${crypto.randomUUID()}`;
      const id = crypto.randomUUID();
      await comoPersistente(client, "authenticated", caso.inquilina, () =>
        client.query(
          `insert into public.share_links (id, user_id, subject_role, token_hash)
           values ($1, $2, 'tenant', $3)`,
          [id, caso.inquilina, hash],
        ),
      );

      const perfil = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [hash]);
        return rows[0].r;
      });

      afirmar(perfil.resenas.length === 1, `esperaba 1 reseña y trajo ${perfil.resenas.length}`);
      afirmar(
        perfil.resenas[0].texto === "Siempre al día y cuidó el departamento",
        "no trajo la reseña que le dejaron",
      );
      afirmar(perfil.resenas[0].etiquetas[0] === "Siempre al día", "no trajo las etiquetas");
      afirmar(perfil.resenas[0].de === "Su dueño", "no dice de qué lado viene la reseña");

      const texto = JSON.stringify(perfil);
      afirmar(!texto.includes(caso.dueno), "el perfil filtró quién escribió la reseña");
      afirmar(!texto.includes("Bruno"), "el perfil filtró el nombre de quien la escribió");
      // La que escribió la inquilina es sobre el dueño: no va en su perfil.
      afirmar(!texto.includes("Resolvió todo rápido"), "mezcló las reseñas de las dos direcciones");
    },
  },
  {
    nombre: "una reseña sin publicar no aparece en el perfil",
    async correr(client) {
      const caso = await escenario(client);
      await terminar(client, caso);

      await llamar(client, caso.dueno, "select public.review_submit($1, $2, $3) as r", [
        caso.rental,
        "Todavía sin publicar",
        ["siempre_al_dia"],
      ]);

      const hash = `hash-${crypto.randomUUID()}`;
      await comoPersistente(client, "authenticated", caso.inquilina, () =>
        client.query(
          `insert into public.share_links (id, user_id, subject_role, token_hash)
           values ($1, $2, 'tenant', $3)`,
          [crypto.randomUUID(), caso.inquilina, hash],
        ),
      );

      const perfil = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [hash]);
        return rows[0].r;
      });

      afirmar(perfil.resenas.length === 0, "mostró una reseña que todavía no se publicó");
      afirmar(
        !JSON.stringify(perfil).includes("Todavía sin publicar"),
        "filtró el texto de una reseña sin publicar",
      );
    },
  },
  {
    nombre: "el catálogo de etiquetas se puede leer, pero no tocar",
    async correr(client) {
      const abiertas = await como(client, "anon", null, async () => {
        const { rows } = await client.query("select code from public.review_tag_defs");
        return rows;
      });
      afirmar(abiertas.length > 0, "el catálogo de etiquetas debería poder leerse");

      await como(client, "authenticated", UID_B, () =>
        esperarPermisoDenegado(
          client,
          () =>
            client.query(
              "insert into public.review_tag_defs (code, direction, label) values ('trucha', 'owner_to_tenant', 'Trucha')",
            ),
          "agregar una etiqueta",
        ),
      );
    },
  },
];
