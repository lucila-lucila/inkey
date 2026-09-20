import {
  afirmar,
  como,
  comoPersistente,
  crearAlquilerDePrueba,
  esperarPermisoDenegado,
  UID_A,
  UID_B,
  UID_C,
  type Caso,
} from "./apoyo";
import type { Client } from "pg";

/** Un alquiler activo entre A (inquilina) y B (dueño). */
async function alquilerActivo(client: Client, diaVencimiento = 10): Promise<string> {
  return crearAlquilerDePrueba(client, {
    creador: UID_A,
    rol: "tenant",
    contraparte: UID_B,
    estado: "active",
    diaVencimiento,
  });
}

const PERIODO = "2026-03-01";

async function reportar(
  client: Client,
  uid: string,
  rentalId: string,
  opciones: { periodo?: string; monto?: number; pagadoEl?: string } = {},
) {
  return comoPersistente(client, "authenticated", uid, async () => {
    const { rows } = await client.query(
      "select public.payment_report($1, $2, $3, $4) as r",
      [rentalId, opciones.periodo ?? PERIODO, opciones.monto ?? 450000, opciones.pagadoEl ?? "2026-03-08"],
    );
    return rows[0].r;
  });
}

export const CASOS_PAGOS: Caso[] = [
  {
    nombre: "el pago lo ven las dos partes y nadie más",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const reporte = await reportar(client, UID_A, rental);
      afirmar(reporte.ok === true, `no se pudo reportar: ${reporte.error}`);

      for (const uid of [UID_A, UID_B]) {
        const filas = await como(client, "authenticated", uid, async () => {
          const { rows } = await client.query("select id from public.payments where id = $1", [
            reporte.payment_id,
          ]);
          return rows;
        });
        afirmar(filas.length === 1, `${uid} no ve un pago de su propio alquiler`);
      }

      const deC = await como(client, "authenticated", UID_C, async () => {
        const { rows } = await client.query("select id from public.payments");
        return rows;
      });
      afirmar(deC.length === 0, "C está viendo pagos ajenos");
    },
  },
  {
    nombre: "nadie escribe en pagos directamente: todo pasa por las funciones",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const reporte = await reportar(client, UID_A, rental);

      await como(client, "authenticated", UID_A, async () => {
        await esperarPermisoDenegado(
          client,
          () =>
            client.query(
              `insert into public.payments (rental_id, period, due_date, amount, currency, paid_on, reported_by)
               values ($1, '2026-04-01', '2026-04-10', 1, 'ARS', '2026-04-01', $2)`,
              [rental, UID_A],
            ),
          "insertar un pago a mano",
        );
        await esperarPermisoDenegado(
          client,
          () =>
            client.query("update public.payments set status = 'confirmed' where id = $1", [
              reporte.payment_id,
            ]),
          "confirmarse el pago a mano",
        );
        await esperarPermisoDenegado(
          client,
          () => client.query("delete from public.payments where id = $1", [reporte.payment_id]),
          "borrar un pago",
        );
      });
    },
  },
  {
    nombre: "solo el inquilino reporta el pago",
    async correr(client) {
      const rental = await alquilerActivo(client);

      const delDueño = await reportar(client, UID_B, rental);
      afirmar(delDueño.ok === false, "el dueño pudo reportar un pago");

      const deUnTercero = await reportar(client, UID_C, rental);
      afirmar(deUnTercero.error === "no_encontrado", "un tercero recibió información del alquiler");
    },
  },
  {
    nombre: "el vencimiento lo calcula el servidor, no el cliente",
    async correr(client) {
      // Día 31 en febrero: tiene que caer el 28 (2026 no es bisiesto).
      const rental = await alquilerActivo(client, 31);
      const reporte = await reportar(client, UID_A, rental, {
        periodo: "2026-02-01",
        pagadoEl: "2026-02-27",
      });
      afirmar(reporte.ok === true, `no se pudo reportar: ${reporte.error}`);

      const { rows } = await client.query(
        "select due_date, on_time, currency from public.payments where id = $1",
        [reporte.payment_id],
      );
      afirmar(
        rows[0].due_date.toISOString().slice(0, 10) === "2026-02-28",
        `el vencimiento debería ser el 28/02 y es ${rows[0].due_date.toISOString().slice(0, 10)}`,
      );
      afirmar(rows[0].on_time === true, "pagó antes de vencer y no figura en fecha");
      afirmar(rows[0].currency === "ARS", "la moneda no salió del alquiler");
    },
  },
  {
    nombre: "un pago fuera de fecha queda registrado como tal",
    async correr(client) {
      const rental = await alquilerActivo(client, 10);
      const reporte = await reportar(client, UID_A, rental, { pagadoEl: "2026-03-20" });

      const { rows } = await client.query("select on_time from public.payments where id = $1", [
        reporte.payment_id,
      ]);
      afirmar(rows[0].on_time === false, "pagó después de vencer y figura en fecha");
    },
  },
  {
    nombre: "no se puede reportar un período futuro ni una fecha futura",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const dentroDeUnAnio = new Date();
      dentroDeUnAnio.setFullYear(dentroDeUnAnio.getFullYear() + 1);

      const futuro = await reportar(client, UID_A, rental, {
        periodo: `${dentroDeUnAnio.getFullYear()}-01-01`,
      });
      afirmar(futuro.error === "periodo_futuro", `esperaba periodo_futuro y dio ${futuro.error}`);

      const fechaFutura = await reportar(client, UID_A, rental, {
        pagadoEl: dentroDeUnAnio.toISOString().slice(0, 10),
      });
      afirmar(fechaFutura.error === "fecha_futura", `esperaba fecha_futura y dio ${fechaFutura.error}`);
    },
  },
  {
    nombre: "no se puede reportar un período anterior al contrato",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const previo = await reportar(client, UID_A, rental, {
        periodo: "2025-06-01",
        pagadoEl: "2025-06-05",
      });
      afirmar(
        previo.error === "periodo_fuera_del_contrato",
        `esperaba periodo_fuera_del_contrato y dio ${previo.error}`,
      );
    },
  },
  {
    nombre: "reportar dos veces el mismo mes no pisa lo anterior",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const primero = await reportar(client, UID_A, rental);
      const segundo = await reportar(client, UID_A, rental, { monto: 1 });

      afirmar(segundo.error === "ya_reportado", `esperaba ya_reportado y dio ${segundo.error}`);

      const { rows } = await client.query("select amount from public.payments where id = $1", [
        primero.payment_id,
      ]);
      afirmar(Number(rows[0].amount) === 450000, "el monto original cambió");
    },
  },
  {
    nombre: "solo el dueño confirma el pago",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const reporte = await reportar(client, UID_A, rental);

      for (const [uid, quien] of [
        [UID_A, "la inquilina"],
        [UID_C, "un tercero"],
      ] as const) {
        const intento = await comoPersistente(client, "authenticated", uid, async () => {
          const { rows } = await client.query("select public.payment_confirm($1) as r", [
            reporte.payment_id,
          ]);
          return rows[0].r;
        });
        afirmar(intento.ok === false, `${quien} pudo confirmar el pago`);
      }

      const { rows } = await client.query("select status from public.payments where id = $1", [
        reporte.payment_id,
      ]);
      afirmar(rows[0].status === "reported", "el pago cambió de estado sin el dueño");
    },
  },
  {
    nombre: "confirmar deja fecha, quién confirmó y número de recibo",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const reporte = await reportar(client, UID_A, rental);

      const confirmacion = await comoPersistente(client, "authenticated", UID_B, async () => {
        const { rows } = await client.query("select public.payment_confirm($1) as r", [
          reporte.payment_id,
        ]);
        return rows[0].r;
      });
      afirmar(confirmacion.ok === true, `no se pudo confirmar: ${confirmacion.error}`);

      const { rows } = await client.query(
        "select status, confirmed_at, confirmed_by, receipt_serial from public.payments where id = $1",
        [reporte.payment_id],
      );
      afirmar(rows[0].status === "confirmed", "el pago no quedó confirmado");
      afirmar(rows[0].confirmed_at !== null, "no quedó cuándo se confirmó");
      afirmar(rows[0].confirmed_by === UID_B, "no quedó quién confirmó");
      afirmar(rows[0].receipt_serial === 1, "el recibo no quedó numerado");

      const { rows: bitacora } = await client.query(
        "select count(*)::int as total from public.audit_log where entity_id = $1 and action = 'pago.confirmado'",
        [reporte.payment_id],
      );
      afirmar(bitacora[0].total === 1, "la confirmación no quedó en la bitácora");
    },
  },
  {
    nombre: "los recibos se numeran uno por uno dentro del alquiler",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const seriales: number[] = [];

      for (const periodo of ["2026-03-01", "2026-04-01", "2026-05-01"]) {
        const reporte = await reportar(client, UID_A, rental, {
          periodo,
          pagadoEl: `${periodo.slice(0, 8)}05`,
        });
        await comoPersistente(client, "authenticated", UID_B, () =>
          client.query("select public.payment_confirm($1)", [reporte.payment_id]),
        );
        const { rows } = await client.query(
          "select receipt_serial from public.payments where id = $1",
          [reporte.payment_id],
        );
        seriales.push(rows[0].receipt_serial);
      }

      afirmar(
        JSON.stringify(seriales) === JSON.stringify([1, 2, 3]),
        `los recibos quedaron numerados ${seriales.join(", ")}`,
      );
    },
  },
  {
    nombre: "'todavía no me llegó' es cosa del dueño y se puede volver a reportar",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const reporte = await reportar(client, UID_A, rental);

      const deLaInquilina = await comoPersistente(client, "authenticated", UID_A, async () => {
        const { rows } = await client.query("select public.payment_not_received($1, $2) as r", [
          reporte.payment_id,
          "me lo marco yo",
        ]);
        return rows[0].r;
      });
      afirmar(deLaInquilina.ok === false, "la inquilina marcó su propio pago como no recibido");

      const delDueño = await comoPersistente(client, "authenticated", UID_B, async () => {
        const { rows } = await client.query("select public.payment_not_received($1, $2) as r", [
          reporte.payment_id,
          "No me figura en la cuenta",
        ]);
        return rows[0].r;
      });
      afirmar(delDueño.ok === true, `el dueño no pudo marcarlo: ${delDueño.error}`);

      const { rows: despues } = await client.query(
        "select status, owner_note from public.payments where id = $1",
        [reporte.payment_id],
      );
      afirmar(despues[0].status === "not_received", "no quedó como no recibido");
      afirmar(despues[0].owner_note === "No me figura en la cuenta", "se perdió la nota del dueño");

      // La inquilina vuelve a reportar: se limpia la nota y vuelve a pendiente.
      const reintento = await reportar(client, UID_A, rental, { pagadoEl: "2026-03-09" });
      afirmar(reintento.ok === true, `no se pudo volver a reportar: ${reintento.error}`);

      const { rows: final } = await client.query(
        "select status, owner_note, paid_on from public.payments where id = $1",
        [reporte.payment_id],
      );
      afirmar(final[0].status === "reported", "no volvió a quedar pendiente");
      afirmar(final[0].owner_note === null, "quedó colgada la nota vieja");
    },
  },
  {
    nombre: "un pago ya confirmado no se puede marcar como no recibido",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const reporte = await reportar(client, UID_A, rental);

      await comoPersistente(client, "authenticated", UID_B, () =>
        client.query("select public.payment_confirm($1)", [reporte.payment_id]),
      );

      const intento = await comoPersistente(client, "authenticated", UID_B, async () => {
        const { rows } = await client.query("select public.payment_not_received($1, null) as r", [
          reporte.payment_id,
        ]);
        return rows[0].r;
      });
      afirmar(intento.error === "ya_confirmado", `esperaba ya_confirmado y dio ${intento.error}`);
    },
  },
  {
    nombre: "sin sesión no se puede tocar ningún pago",
    async correr(client) {
      const rental = await alquilerActivo(client);
      const reporte = await reportar(client, UID_A, rental);

      await como(client, "anon", null, async () => {
        await esperarPermisoDenegado(
          client,
          () => client.query("select public.payment_report($1, $2, 1, $3)", [rental, PERIODO, "2026-03-01"]),
          "reportar un pago sin sesión",
        );
        await esperarPermisoDenegado(
          client,
          () => client.query("select public.payment_confirm($1)", [reporte.payment_id]),
          "confirmar un pago sin sesión",
        );
        await esperarPermisoDenegado(
          client,
          () => client.query("select * from public.payments"),
          "leer pagos sin sesión",
        );
      });
    },
  },
  {
    nombre: "no se reportan pagos de un alquiler que todavía no está activo",
    async correr(client) {
      const pendiente = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      const intento = await reportar(client, UID_A, pendiente);
      afirmar(
        intento.error === "alquiler_inactivo",
        `esperaba alquiler_inactivo y dio ${intento.error}`,
      );
    },
  },
];
