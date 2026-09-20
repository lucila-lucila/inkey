import type { Client } from "pg";
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

/**
 * Fase 4: links compartibles, métricas y perfil público.
 *
 * Las métricas suman TODO el historial de una persona, así que cada caso que
 * mide arranca con una inquilina nueva: si midiéramos siempre sobre la misma,
 * contaríamos lo que dejaron los casos anteriores.
 */

/** Reporta y confirma un mes, cada uno con su sesión. */
async function mesConfirmado(
  client: Client,
  inquilina: string,
  rental: string,
  periodo: string,
): Promise<void> {
  const reporte = await comoPersistente(client, "authenticated", inquilina, async () => {
    const { rows } = await client.query("select public.payment_report($1, $2, 450000, $3) as r", [
      rental,
      periodo,
      `${periodo.slice(0, 8)}05`,
    ]);
    return rows[0].r;
  });
  afirmar(reporte.ok === true, `no se pudo reportar ${periodo}: ${reporte.error}`);

  await comoPersistente(client, "authenticated", UID_B, () =>
    client.query("select public.payment_confirm($1)", [reporte.payment_id]),
  );
}

async function crearLink(
  client: Client,
  opciones: { uid: string; rol: "tenant" | "owner"; hash: string; montos?: boolean },
): Promise<string> {
  const id = crypto.randomUUID();
  await comoPersistente(client, "authenticated", opciones.uid, () =>
    client.query(
      `insert into public.share_links (id, user_id, subject_role, token_hash, show_amounts)
       values ($1, $2, $3, $4, $5)`,
      [id, opciones.uid, opciones.rol, opciones.hash, opciones.montos ?? false],
    ),
  );
  return id;
}

export const CASOS_PERFIL: Caso[] = [
  {
    nombre: "los links de perfil son privados de quien los crea",
    async correr(client) {
      const hash = `hash-${crypto.randomUUID()}`;
      await crearLink(client, { uid: UID_A, rol: "tenant", hash });

      const deC = await como(client, "authenticated", UID_C, async () => {
        const { rows } = await client.query("select id from public.share_links");
        return rows;
      });
      afirmar(deC.length === 0, "C está viendo links de otra persona");

      await como(client, "anon", null, () =>
        esperarPermisoDenegado(
          client,
          () => client.query("select * from public.share_links"),
          "leer links como anónimo",
        ),
      );
    },
  },
  {
    nombre: "nadie crea un link a nombre de otro",
    async correr(client) {
      await como(client, "authenticated", UID_C, () =>
        esperarPermisoDenegado(
          client,
          () =>
            client.query(
              `insert into public.share_links (id, user_id, subject_role, token_hash)
               values ($1, $2, 'tenant', $3)`,
              [crypto.randomUUID(), UID_A, `hash-${crypto.randomUUID()}`],
            ),
          "crear un link a nombre de otra persona",
        ),
      );
    },
  },
  {
    nombre: "de un link solo se cambian la etiqueta, los montos y la revocación",
    async correr(client) {
      const hash = `hash-${crypto.randomUUID()}`;
      const id = await crearLink(client, { uid: UID_A, rol: "tenant", hash });

      await como(client, "authenticated", UID_A, async () => {
        const ok = await client.query(
          "update public.share_links set show_amounts = true, label = 'Para la inmobiliaria' where id = $1",
          [id],
        );
        afirmar((ok.rowCount ?? 0) === 1, "no se pudo cambiar la etiqueta ni los montos");

        await esperarPermisoDenegado(
          client,
          () => client.query("update public.share_links set view_count = 999 where id = $1", [id]),
          "inflar las visitas",
        );
        await esperarPermisoDenegado(
          client,
          () =>
            client.query("update public.share_links set user_id = $1 where id = $2", [UID_C, id]),
          "mudar el link a otra cuenta",
        );
      });
    },
  },
  {
    nombre: "el perfil público muestra lo confirmado y cuenta la visita",
    async correr(client) {
      const inquilina = await crearPersona(client, "Dalia", "Quiroga");
      const rental = await crearAlquilerDePrueba(client, {
        creador: inquilina,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });
      await mesConfirmado(client, inquilina, rental, "2026-03-01");
      await mesConfirmado(client, inquilina, rental, "2026-04-01");

      const hash = `hash-${crypto.randomUUID()}`;
      const id = await crearLink(client, { uid: inquilina, rol: "tenant", hash });

      const perfil = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [hash]);
        return rows[0].r;
      });

      afirmar(perfil.estado === "valido", `el perfil debería ser válido y dio ${perfil.estado}`);
      afirmar(perfil.nombre === "Dalia", "no muestra el nombre");
      afirmar(perfil.inicial_apellido === "Q", "debería mostrar solo la inicial del apellido");
      afirmar(
        Number(perfil.metricas.meses_confirmados) === 2,
        `esperaba 2 meses confirmados y dio ${perfil.metricas.meses_confirmados}`,
      );
      afirmar(Number(perfil.metricas.porcentaje_en_fecha) === 100, "la puntualidad no dio 100%");
      afirmar(perfil.metricas.ultimos_12.length === 12, "las barras no son 12");

      const { rows } = await client.query(
        "select view_count, last_viewed_at from public.share_links where id = $1",
        [id],
      );
      afirmar(rows[0].view_count === 1, "no se contó la visita");
      afirmar(rows[0].last_viewed_at !== null, "no quedó cuándo se vio");
    },
  },
  {
    nombre: "el perfil público no filtra nada privado",
    async correr(client) {
      const inquilina = await crearPersona(client, "Dalia", "Quiroga");
      const rental = await crearAlquilerDePrueba(client, {
        creador: inquilina,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });
      await mesConfirmado(client, inquilina, rental, "2026-03-01");
      await client.query("update public.payments set receipt_path = $1 where rental_id = $2", [
        `${rental}/comprobante.pdf`,
        rental,
      ]);

      const hash = `hash-${crypto.randomUUID()}`;
      await crearLink(client, { uid: inquilina, rol: "tenant", hash });

      const perfil = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [hash]);
        return rows[0].r;
      });

      const texto = JSON.stringify(perfil);
      // Dirección, apellido, ids y rutas de archivos no salen nunca.
      afirmar(!texto.includes("Gurruchaga"), "el perfil público filtró la dirección");
      afirmar(!texto.includes("Quiroga"), "el perfil público filtró el apellido completo");
      afirmar(!texto.includes(".pdf"), "el perfil público filtró la ruta del comprobante");
      afirmar(!texto.includes("receipt_path"), "el perfil público filtró la ruta del comprobante");
      for (const uid of [inquilina, UID_B, UID_C]) {
        afirmar(!texto.includes(uid), "el perfil público filtró ids de personas");
      }
      // El barrio sí: es lo único de la ubicación que puede verse.
      afirmar(texto.includes("Palermo"), "el barrio debería poder mostrarse");
    },
  },
  {
    nombre: "los montos aparecen solo si la persona los activó",
    async correr(client) {
      const inquilina = await crearPersona(client, "Dalia", "Quiroga");
      const rental = await crearAlquilerDePrueba(client, {
        creador: inquilina,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });
      await mesConfirmado(client, inquilina, rental, "2026-03-01");

      const sinMontos = `hash-${crypto.randomUUID()}`;
      const conMontos = `hash-${crypto.randomUUID()}`;
      await crearLink(client, { uid: inquilina, rol: "tenant", hash: sinMontos });
      await crearLink(client, { uid: inquilina, rol: "tenant", hash: conMontos, montos: true });

      const cerrado = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [sinMontos]);
        return rows[0].r;
      });
      afirmar(cerrado.metricas.montos === undefined, "se filtraron los montos sin permiso");
      afirmar(!JSON.stringify(cerrado).includes("450000"), "se filtró el monto del alquiler");

      const abierto = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [conMontos]);
        return rows[0].r;
      });
      afirmar(abierto.metricas.montos !== undefined, "no se muestran los montos activados");
    },
  },
  {
    nombre: "un link revocado deja de mostrar el perfil",
    async correr(client) {
      const hash = `hash-${crypto.randomUUID()}`;
      const id = await crearLink(client, { uid: UID_A, rol: "tenant", hash });

      await comoPersistente(client, "authenticated", UID_A, () =>
        client.query("update public.share_links set revoked_at = now() where id = $1", [id]),
      );

      const perfil = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [hash]);
        return rows[0].r;
      });
      afirmar(perfil.estado === "revocado", `esperaba revocado y dio ${perfil.estado}`);
      afirmar(perfil.metricas === undefined, "un link revocado no debería devolver métricas");
    },
  },
  {
    nombre: "un token que no existe no revela nada",
    async correr(client) {
      const perfil = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [
          "hash-que-no-existe",
        ]);
        return rows[0].r;
      });
      afirmar(perfil.estado === "inexistente", `esperaba inexistente y dio ${perfil.estado}`);
      afirmar(Object.keys(perfil).length === 1, "devolvió más datos de los necesarios");
    },
  },
  {
    nombre: "nadie puede pedir las métricas de otra persona",
    async correr(client) {
      await como(client, "authenticated", UID_C, async () => {
        // La función interna no está otorgada a nadie.
        await esperarPermisoDenegado(
          client,
          () => client.query("select public.profile_metrics($1, 'tenant')", [UID_A]),
          "pedir las métricas de otra persona",
        );
        // Y la pública solo devuelve las propias.
        const { rows } = await client.query("select public.my_profile_metrics('tenant') as r");
        afirmar(
          Number(rows[0].r.meses_confirmados) === 0,
          "C está viendo meses confirmados que no son suyos",
        );
      });
    },
  },
  {
    nombre: "los meses sin confirmar no suman ni restan",
    async correr(client) {
      const inquilina = await crearPersona(client, "Dalia", "Quiroga");
      const rental = await crearAlquilerDePrueba(client, {
        creador: inquilina,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });
      await mesConfirmado(client, inquilina, rental, "2026-03-01");

      // Un mes reportado pero sin confirmar, y otro que el dueño no recibió.
      const reportado = await comoPersistente(client, "authenticated", inquilina, async () => {
        const { rows } = await client.query(
          "select public.payment_report($1, '2026-04-01', 450000, '2026-04-05') as r",
          [rental],
        );
        return rows[0].r;
      });
      const noRecibido = await comoPersistente(client, "authenticated", inquilina, async () => {
        const { rows } = await client.query(
          "select public.payment_report($1, '2026-05-01', 450000, '2026-05-05') as r",
          [rental],
        );
        return rows[0].r;
      });
      await comoPersistente(client, "authenticated", UID_B, () =>
        client.query("select public.payment_not_received($1, 'no me llegó')", [
          noRecibido.payment_id,
        ]),
      );

      const hash = `hash-${crypto.randomUUID()}`;
      await crearLink(client, { uid: inquilina, rol: "tenant", hash });

      const perfil = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.public_profile($1) as r", [hash]);
        return rows[0].r;
      });

      afirmar(
        Number(perfil.metricas.meses_confirmados) === 1,
        `solo debería contar el mes confirmado y contó ${perfil.metricas.meses_confirmados}`,
      );
      afirmar(
        !JSON.stringify(perfil).includes("no me llegó"),
        "la nota privada del dueño salió al perfil público",
      );
      afirmar(Number(perfil.metricas.porcentaje_en_fecha) === 100, "la puntualidad no dio 100%");
      afirmar(reportado.ok === true, "el mes reportado tendría que existir igual");
    },
  },
];
