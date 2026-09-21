import { createHash } from "node:crypto";
import {
  afirmar,
  como,
  comoPersistente,
  crearPersona,
  type Caso,
} from "./apoyo";
import type { Client } from "pg";

/*
 * Los flujos principales, de punta a punta, contra la base de verdad.
 *
 * A diferencia de los casos de RLS —que preguntan "¿puede esta persona tocar
 * algo ajeno?"—, acá se recorre el camino completo de una persona usando la
 * app: registrar el alquiler, invitar, confirmar, pagar mes a mes, compartir
 * el historial, terminar el contrato y reseñarse.
 *
 * Todo pasa por las mismas funciones que llama la app. Si un flujo se rompe,
 * se rompe acá antes que en producción.
 */

/** Como `hashearToken` en src/lib/tokens.ts. */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function token(): string {
  return `t-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/** Igual que la app: la invitación guarda solo el hash del token. */
async function invitar(
  client: Client,
  quien: string,
  rentalId: string,
  rol: "owner" | "tenant",
): Promise<string> {
  const valor = token();
  await comoPersistente(client, "authenticated", quien, async () => {
    await client.query(
      `insert into public.invitations (rental_id, invited_role, token_hash, created_by)
       values ($1, $2, $3, $4)`,
      [rentalId, rol, hash(valor), quien],
    );
  });
  return valor;
}

async function rpc<T = Record<string, unknown>>(
  client: Client,
  uid: string | null,
  sql: string,
  valores: unknown[] = [],
): Promise<T> {
  const rol = uid ? "authenticated" : "anon";
  return comoPersistente(client, rol, uid, async () => {
    const { rows } = await client.query(`select ${sql} as r`, valores);
    return rows[0].r as T;
  });
}

type Respuesta = { ok?: boolean; error?: string; payment_id?: string };

export const CASOS_FLUJOS: Caso[] = [
  {
    nombre: "FLUJO · el inquilino registra, invita, paga y comparte su historial",
    async correr(client) {
      const inquilina = await crearPersona(client, "Lucía", "Bravo");
      const dueño = await crearPersona(client, "Hernán", "Costa");

      // 1. Registra el alquiler. Queda pendiente hasta que el dueño confirme.
      const { rows } = await comoPersistente(client, "authenticated", inquilina, () =>
        client.query(
          `insert into public.rentals
             (tenant_id, created_by, neighborhood_label, full_address, start_date,
              end_date, monthly_amount, currency, due_day)
           values ($1, $1, 'Caballito, CABA', 'Rojas 555, 4° A',
                   date_trunc('month', current_date - interval '3 months')::date,
                   (current_date + interval '9 months')::date, 300000, 'ARS', 10)
           returning id, status`,
          [inquilina],
        ),
      );
      const rental = rows[0].id;
      afirmar(rows[0].status === "pending", "un alquiler nuevo tiene que nacer pendiente");

      // 2. Invita al dueño y el dueño acepta desde el link.
      const invitacion = await invitar(client, inquilina, rental, "owner");

      const mirada = await rpc<{
        estado: string;
        rol_invitado: string;
        alquiler: { barrio: string; direccion: string };
      }>(client, null, "public.invitation_preview($1)", [hash(invitacion)]);

      afirmar(mirada.estado === "valida", `la invitación no está vigente: ${mirada.estado}`);
      afirmar(mirada.rol_invitado === "owner", "la invitación no dice a quién invita");
      afirmar(mirada.alquiler.barrio === "Caballito, CABA", "el resumen no muestra el barrio");

      const aceptada = await rpc<Respuesta>(client, dueño, "public.invitation_accept($1)", [
        hash(invitacion),
      ]);
      afirmar(aceptada.ok === true, `el dueño no pudo aceptar: ${aceptada.error}`);

      const { rows: confirmado } = await client.query(
        "select status, owner_id from public.rentals where id = $1",
        [rental],
      );
      afirmar(confirmado[0].status === "active", "el alquiler no quedó activo");
      afirmar(confirmado[0].owner_id === dueño, "el dueño no quedó asignado");

      // 3. Tres meses de pagos: dos en fecha y uno tarde.
      for (const [mes, dia] of [
        [3, 6],
        [2, 20],
        [1, 4],
      ] as const) {
        const reporte = await rpc<Respuesta>(
          client,
          inquilina,
          `public.payment_report($1,
             date_trunc('month', current_date - make_interval(months => $2::int))::date,
             300000,
             (date_trunc('month', current_date - make_interval(months => $2::int)) + make_interval(days => $3::int - 1))::date)`,
          [rental, mes, dia],
        );
        afirmar(reporte.ok === true, `no se pudo reportar el mes -${mes}: ${reporte.error}`);

        const confirmacion = await rpc<Respuesta>(client, dueño, "public.payment_confirm($1)", [
          reporte.payment_id,
        ]);
        afirmar(confirmacion.ok === true, `el dueño no pudo confirmar: ${confirmacion.error}`);
      }

      const { rows: puntualidad } = await client.query(
        `select count(*)::int as total, sum(case when on_time then 1 else 0 end)::int as en_fecha
           from public.payments where rental_id = $1 and status = 'confirmed'`,
        [rental],
      );
      afirmar(puntualidad[0].total === 3, "faltan pagos confirmados");
      afirmar(puntualidad[0].en_fecha === 2, "la puntualidad no se calculó como corresponde");

      // 4. Comparte su historial con un link, y el link muestra lo justo.
      const linkId = (
        await client.query("select gen_random_uuid() as id")
      ).rows[0].id as string;
      const tokenLink = token();

      await comoPersistente(client, "authenticated", inquilina, () =>
        client.query(
          `insert into public.share_links (id, user_id, subject_role, token_hash, label)
           values ($1, $2, 'tenant', $3, 'Para la inmobiliaria')`,
          [linkId, inquilina, hash(tokenLink)],
        ),
      );

      const perfil = await rpc<{
        estado: string;
        nombre: string;
        inicial_apellido: string;
        muestra_montos: boolean;
        metricas: { meses_confirmados: number; porcentaje_en_fecha: number };
      }>(client, null, "public.public_profile($1)", [hash(tokenLink)]);

      afirmar(perfil.estado === "valido", `el perfil público no se muestra: ${perfil.estado}`);
      afirmar(perfil.nombre === "Lucía", `el perfil muestra "${perfil.nombre}"`);
      afirmar(perfil.inicial_apellido === "B", "el perfil no muestra la inicial del apellido");
      afirmar(perfil.muestra_montos === false, "los montos no se muestran salvo que se activen");
      afirmar(perfil.metricas.meses_confirmados === 3, "las métricas no cuentan los meses");
      afirmar(perfil.metricas.porcentaje_en_fecha === 67, "el porcentaje en fecha no cierra");

      // Y no filtra nada de lo que no tiene que salir.
      const texto = JSON.stringify(perfil);
      afirmar(!texto.includes("Rojas 555"), "el perfil público filtró la dirección");
      afirmar(!texto.includes("Bravo"), "el perfil público filtró el apellido entero");
      afirmar(!texto.includes("300000"), "el perfil mostró montos sin que se activaran");

      // 5. Revocado, deja de mostrarse en el acto.
      await comoPersistente(client, "authenticated", inquilina, () =>
        client.query("update public.share_links set revoked_at = now() where id = $1", [linkId]),
      );
      const revocado = await rpc<{ estado: string }>(client, null, "public.public_profile($1)", [
        hash(tokenLink),
      ]);
      afirmar(revocado.estado === "revocado", "un link revocado sigue mostrando el historial");
    },
  },
  {
    nombre: "FLUJO · el dueño registra la propiedad e invita al inquilino",
    async correr(client) {
      const dueño = await crearPersona(client, "Rosa", "Ferrer");
      const inquilino = await crearPersona(client, "Tomás", "Ibarra");

      const { rows } = await comoPersistente(client, "authenticated", dueño, () =>
        client.query(
          `insert into public.rentals
             (owner_id, created_by, neighborhood_label, full_address, start_date,
              end_date, monthly_amount, currency, due_day)
           values ($1, $1, 'Flores, CABA', 'Yerbal 2020, PB',
                   date_trunc('month', current_date)::date,
                   (current_date + interval '12 months')::date, 280000, 'ARS', 5)
           returning id`,
          [dueño],
        ),
      );
      const rental = rows[0].id;

      const invitacion = await invitar(client, dueño, rental, "tenant");
      const aceptada = await rpc<Respuesta>(client, inquilino, "public.invitation_accept($1)", [
        hash(invitacion),
      ]);
      afirmar(aceptada.ok === true, `el inquilino no pudo aceptar: ${aceptada.error}`);

      const { rows: estado } = await client.query(
        "select status, tenant_id from public.rentals where id = $1",
        [rental],
      );
      afirmar(estado[0].status === "active", "el alquiler no quedó activo");
      afirmar(estado[0].tenant_id === inquilino, "el inquilino no quedó asignado");

      // Y el mismo link no sirve dos veces.
      const otraVez = await rpc<Respuesta>(client, inquilino, "public.invitation_accept($1)", [
        hash(invitacion),
      ]);
      afirmar(otraVez.ok === false, "una invitación aceptada se pudo volver a usar");
    },
  },
  {
    nombre: "FLUJO · fin de contrato y reseñas que se publican juntas",
    async correr(client) {
      const inquilina = await crearPersona(client, "Nadia", "Paz");
      const dueño = await crearPersona(client, "Ariel", "Soto");

      const { rows } = await client.query(
        `insert into public.rentals
           (tenant_id, owner_id, created_by, neighborhood_label, full_address,
            start_date, monthly_amount, currency, due_day, status)
         values ($1, $2, $1, 'Boedo, CABA', 'Castro Barros 100, 5° D',
                 date_trunc('month', current_date - interval '2 months')::date,
                 250000, 'ARS', 10, 'active')
         returning id`,
        [inquilina, dueño],
      );
      const rental = rows[0].id;

      // Uno propone terminar; el otro confirma.
      const propuesta = await rpc<Respuesta>(client, inquilina, "public.rental_request_end($1)", [
        rental,
      ]);
      afirmar(propuesta.ok === true, `no se pudo proponer el fin: ${propuesta.error}`);

      const solo = await rpc<Respuesta>(client, inquilina, "public.rental_confirm_end($1)", [
        rental,
      ]);
      afirmar(solo.ok === false, "quien propuso el fin se lo pudo confirmar solo");

      const cerrado = await rpc<Respuesta>(client, dueño, "public.rental_confirm_end($1)", [
        rental,
      ]);
      afirmar(cerrado.ok === true, `el dueño no pudo confirmar el fin: ${cerrado.error}`);

      // La primera reseña no se ve hasta que llega la segunda.
      const primera = await rpc<Respuesta>(
        client,
        inquilina,
        "public.review_submit($1, 'Resolvió todo rápido.', array['resolvio_arreglos_rapido'])",
        [rental],
      );
      afirmar(primera.ok === true, `no se pudo reseñar: ${primera.error}`);

      const escondida = await como(client, "authenticated", dueño, async () => {
        const { rows: r } = await client.query(
          "select id from public.reviews where rental_id = $1",
          [rental],
        );
        return r;
      });
      afirmar(escondida.length === 0, "el dueño vio la reseña antes de escribir la suya");

      const segunda = await rpc<Respuesta>(
        client,
        dueño,
        "public.review_submit($1, 'Cuidó la casa como propia.', array['cuido_la_propiedad'])",
        [rental],
      );
      afirmar(segunda.ok === true, `el dueño no pudo reseñar: ${segunda.error}`);

      const { rows: publicadas } = await client.query(
        "select count(*)::int as n from public.reviews where rental_id = $1 and published_at is not null",
        [rental],
      );
      afirmar(publicadas[0].n === 2, "las dos reseñas tenían que publicarse juntas");
    },
  },
  {
    nombre: "FLUJO · la baja de cuenta despersonaliza sin borrarle el historial a la otra parte",
    async correr(client) {
      const inquilina = await crearPersona(client, "Vera", "Molina");
      const dueño = await crearPersona(client, "Gastón", "Ruiz");

      const { rows } = await client.query(
        `insert into public.rentals
           (tenant_id, owner_id, created_by, neighborhood_label, full_address,
            start_date, monthly_amount, currency, due_day, status, contract_path)
         values ($1, $2, $1, 'Chacarita, CABA', 'Jorge Newbery 77, 2° B',
                 date_trunc('month', current_date - interval '2 months')::date,
                 200000, 'ARS', 10, 'active', $3)
         returning id`,
        [inquilina, dueño, "contrato-de-prueba.pdf"],
      );
      const rental = rows[0].id;

      const reporte = await rpc<Respuesta>(
        client,
        inquilina,
        `public.payment_report($1,
           date_trunc('month', current_date - interval '1 month')::date, 200000,
           (date_trunc('month', current_date - interval '1 month') + interval '5 days')::date,
           $2)`,
        [rental, `${rental}/comprobante.pdf`],
      );
      afirmar(reporte.ok === true, `no se pudo reportar: ${reporte.error}`);
      await rpc(client, dueño, "public.payment_confirm($1)", [reporte.payment_id]);

      // Un link vivo y una reseña recibida, para ver qué pasa con los dos.
      const tokenLink = token();
      await comoPersistente(client, "authenticated", inquilina, () =>
        client.query(
          `insert into public.share_links (id, user_id, subject_role, token_hash)
           values (gen_random_uuid(), $1, 'tenant', $2)`,
          [inquilina, hash(tokenLink)],
        ),
      );
      await client.query(
        `insert into public.reviews (rental_id, author_id, subject_id, direction, text, published_at)
         values ($1, $2, $3, 'owner_to_tenant', 'Muy prolija.', now())`,
        [rental, dueño, inquilina],
      );

      // La baja.
      const baja = await rpc<{
        ok: boolean;
        archivos_programados: number;
        avisar_a: Array<{ user_id: string; rental_id: string }>;
      }>(client, inquilina, "public.account_delete()");

      afirmar(baja.ok === true, "la baja falló");
      afirmar(baja.archivos_programados === 2, "tenían que programarse el comprobante y el contrato");
      afirmar(
        baja.avisar_a.length === 1 && baja.avisar_a[0].user_id === dueño,
        "había que avisarle a la otra parte",
      );

      // 1. El perfil queda despersonalizado, no borrado.
      const { rows: perfil } = await client.query(
        "select first_name, phone, deleted_at from public.profiles where id = $1",
        [inquilina],
      );
      afirmar(perfil.length === 1, "el perfil se borró en vez de despersonalizarse");
      afirmar(perfil[0].first_name === null && perfil[0].phone === null, "quedaron datos personales");
      afirmar(perfil[0].deleted_at !== null, "no quedó marcada la baja");

      // 2. El historial del dueño sigue entero.
      const delDueño = await como(client, "authenticated", dueño, async () => {
        const { rows: r } = await client.query(
          `select r.id, (select count(*)::int from public.payments p
                          where p.rental_id = r.id and p.status = 'confirmed') as pagos
             from public.rentals r where r.id = $1`,
          [rental],
        );
        return r;
      });
      afirmar(delDueño.length === 1, "el alquiler desapareció para el dueño");
      afirmar(delDueño[0].pagos === 1, "el dueño perdió el pago confirmado");

      // 3. El link muere en el acto.
      const link = await rpc<{ estado: string }>(client, null, "public.public_profile($1)", [
        hash(tokenLink),
      ]);
      afirmar(link.estado === "revocado", "un link de alguien dado de baja sigue vivo");

      // 4. La reseña que recibió deja de mostrarse.
      const { rows: resena } = await client.query(
        "select hidden_at from public.reviews where subject_id = $1",
        [inquilina],
      );
      afirmar(resena[0].hidden_at !== null, "la reseña recibida se sigue mostrando");

      // 5. Los archivos quedan programados para dentro de 30 días, no borrados ya.
      const { rows: archivos } = await client.query(
        `select count(*)::int as n,
                min(due_at) > now() + interval '29 days' as con_plazo
           from public.file_deletions where requested_by = $1 and done_at is null`,
        [inquilina],
      );
      afirmar(archivos[0].n === 2, "no quedaron los dos archivos programados");
      afirmar(archivos[0].con_plazo === true, "el plazo de 30 días no se respetó");

      // Y volver a darse de baja no rompe nada ni duplica el trabajo.
      const otraVez = await rpc<{ ok: boolean }>(client, inquilina, "public.account_delete()");
      afirmar(otraVez.ok === true, "darse de baja dos veces falló");
    },
  },
];
