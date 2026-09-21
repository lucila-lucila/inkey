import {
  afirmar,
  como,
  comoPersistente,
  crearAlquilerDePrueba,
  crearPersona,
  esperarPermisoDenegado,
  UID_A,
  UID_B,
  UID_C,
  type Caso,
} from "./apoyo";
import type { Client } from "pg";

/*
 * Fase 6. Lo que hay que probar acá es que los avisos y, sobre todo, los links
 * de los mails no abran ninguna puerta de más: un token confirma UN pago, una
 * sola vez, y no sirve para leer nada más.
 */

const PERIODO = "2026-05-01";

/** Un pago reportado en un alquiler activo entre una inquilina y un dueño. */
async function pagoReportado(
  client: Client,
  inquilina = UID_A,
  dueño = UID_B,
): Promise<{ rental: string; pago: string }> {
  const rental = await crearAlquilerDePrueba(client, {
    creador: inquilina,
    rol: "tenant",
    contraparte: dueño,
    estado: "active",
  });

  const reporte = await comoPersistente(client, "authenticated", inquilina, async () => {
    const { rows } = await client.query(
      "select public.payment_report($1, $2, $3, $4) as r",
      [rental, PERIODO, 450000, "2026-05-08"],
    );
    return rows[0].r;
  });

  afirmar(reporte.ok === true, `no se pudo reportar el pago: ${reporte.error}`);
  return { rental, pago: reporte.payment_id };
}

/** Un token de mail, creado como lo crea el servidor. */
async function crearToken(
  client: Client,
  paymentId: string,
  opciones: { vence?: string } = {},
): Promise<string> {
  const hash = Math.random().toString(16).slice(2).padEnd(64, "0");
  // La expresión de vencimiento va en el SQL: es un literal de este test.
  await client.query(
    `insert into public.action_tokens (token_hash, purpose, payment_id, expires_at)
     values ($1, 'confirm_payment', $2, ${opciones.vence ?? "now() + interval '3 days'"})`,
    [hash, paymentId],
  );
  return hash;
}

export const CASOS_AVISOS: Caso[] = [
  {
    nombre: "las tablas de avisos no las ve nadie desde la app",
    async correr(client) {
      const { pago } = await pagoReportado(client);
      await crearToken(client, pago);

      for (const uid of [UID_A, UID_B, UID_C]) {
        await como(client, "authenticated", uid, async () => {
          for (const tabla of ["notifications", "action_tokens"]) {
            await esperarPermisoDenegado(
              client,
              () => client.query(`select * from public.${tabla}`),
              `${uid} pudo leer ${tabla}`,
            );
          }
        });
      }

      await como(client, "anon", null, async () => {
        for (const tabla of ["notifications", "action_tokens"]) {
          await esperarPermisoDenegado(
            client,
            () => client.query(`select * from public.${tabla}`),
            `anon pudo leer ${tabla}`,
          );
        }
      });
    },
  },
  {
    nombre: "nadie se fabrica un token de confirmación",
    async correr(client) {
      const { pago } = await pagoReportado(client);

      // El propio inquilino es el que más ganaría con esto: confirmarse solo.
      await como(client, "authenticated", UID_A, async () => {
        await esperarPermisoDenegado(
          client,
          () =>
            client.query(
              `insert into public.action_tokens (token_hash, purpose, payment_id, expires_at)
               values ($1, 'confirm_payment', $2, now() + interval '1 day')`,
              ["a".repeat(64), pago],
            ),
          "la inquilina se fabricó un token",
        );
      });
    },
  },
  {
    nombre: "las funciones del cron son solo del service role",
    async correr(client) {
      for (const uid of [UID_A, UID_B]) {
        await como(client, "authenticated", uid, async () => {
          await esperarPermisoDenegado(
            client,
            () => client.query("select * from public.pagos_sin_respuesta(3)"),
            `${uid} pudo listar los pagos sin respuesta`,
          );
          await esperarPermisoDenegado(
            client,
            () =>
              client.query("select public.notification_claim($1, $2)", ["x", "pago.reportado"]),
            `${uid} pudo reservar un aviso`,
          );
          await esperarPermisoDenegado(
            client,
            () => client.query("select public.notification_settle($1, null)", ["x"]),
            `${uid} pudo cerrar un aviso`,
          );
        });
      }
    },
  },
  {
    nombre: "el link del mail confirma el pago una sola vez",
    async correr(client) {
      const { pago } = await pagoReportado(client);
      const hash = await crearToken(client, pago);

      // Sin sesión, como le llega al dueño desde su casilla.
      const primera = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query(
          "select public.payment_confirm_with_token($1) as r",
          [hash],
        );
        return rows[0].r;
      });
      afirmar(primera.ok === true, `el link no confirmó: ${primera.error}`);

      const { rows: despues } = await client.query(
        "select status, confirmed_by from public.payments where id = $1",
        [pago],
      );
      afirmar(despues[0].status === "confirmed", "el pago no quedó confirmado");
      afirmar(despues[0].confirmed_by === UID_B, "el pago no quedó a nombre del dueño");

      const segunda = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query(
          "select public.payment_confirm_with_token($1) as r",
          [hash],
        );
        return rows[0].r;
      });
      afirmar(segunda.ok === false && segunda.error === "usado", "el token se pudo usar dos veces");
    },
  },
  {
    nombre: "un token vencido o inventado no hace nada",
    async correr(client) {
      const { pago } = await pagoReportado(client);
      const vencido = await crearToken(client, pago, { vence: "now() - interval '1 hour'" });

      const resultados = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query(
          `select public.payment_confirm_with_token($1) as vencido,
                  public.payment_confirm_with_token($2) as inventado,
                  public.payment_token_preview($3) as mirada`,
          [vencido, "f".repeat(64), "f".repeat(64)],
        );
        return rows[0];
      });

      afirmar(resultados.vencido.error === "vencido", "un token vencido confirmó el pago");
      afirmar(resultados.inventado.error === "inexistente", "un token inventado confirmó el pago");
      afirmar(resultados.mirada.estado === "inexistente", "el resumen habló de un token inexistente");

      const { rows } = await client.query("select status from public.payments where id = $1", [pago]);
      afirmar(rows[0].status === "reported", "el pago cambió de estado sin un token válido");
    },
  },
  {
    nombre: "el resumen del link muestra el pago y nada más",
    async correr(client) {
      const { pago } = await pagoReportado(client);
      const hash = await crearToken(client, pago);

      const mirada = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.payment_token_preview($1) as r", [hash]);
        return rows[0].r;
      });

      afirmar(mirada.estado === "valido", `el resumen no está vivo: ${mirada.estado}`);
      afirmar(mirada.barrio === "Palermo, CABA", "falta el barrio en el resumen");
      afirmar(mirada.inquilino.nombre === "Ana", "falta el nombre de la inquilina");
      // Ni dirección, ni mail, ni teléfono: el mail no es una puerta a la cuenta.
      const texto = JSON.stringify(mirada);
      afirmar(!texto.includes("Gurruchaga"), "el resumen filtró la dirección completa");
      afirmar(!texto.includes("Rossi"), "el resumen filtró el apellido entero");

      // Y mirar no consume el token.
      const { rows } = await client.query(
        "select used_at from public.action_tokens where token_hash = $1",
        [hash],
      );
      afirmar(rows[0].used_at === null, "mirar el resumen consumió el token");
    },
  },
  {
    nombre: "'todavía no me llegó' desde el mail deja el pago privado entre las partes",
    async correr(client) {
      // Persona nueva: las métricas suman todo el historial de alguien.
      const inquilina = await crearPersona(client, "Emilia", "Sosa");
      const dueño = await crearPersona(client, "Facundo", "Luna");
      const { pago } = await pagoReportado(client, inquilina, dueño);
      const hash = await crearToken(client, pago);

      const respuesta = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query(
          "select public.payment_not_received_with_token($1, $2) as r",
          [hash, "  Me fijo en el banco y te aviso  "],
        );
        return rows[0].r;
      });
      afirmar(respuesta.ok === true, `no se pudo marcar como no recibido: ${respuesta.error}`);

      const { rows } = await client.query(
        "select status, owner_note from public.payments where id = $1",
        [pago],
      );
      afirmar(rows[0].status === "not_received", "el pago no quedó como no recibido");
      afirmar(rows[0].owner_note === "Me fijo en el banco y te aviso", "la nota no se guardó limpia");

      // Un mes así no suma en el perfil: es privado entre las partes.
      const { rows: metricas } = await client.query(
        "select public.profile_metrics($1, 'tenant') as m",
        [inquilina],
      );
      afirmar(
        Number(metricas[0].m.meses_confirmados) === 0,
        "un mes marcado como no recibido está sumando en el perfil",
      );
    },
  },
];
