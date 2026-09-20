import {
  afirmar,
  como,
  crearAlquilerDePrueba,
  comoPersistente,
  crearInvitacionDePrueba,
  esperarError,
  esperarPermisoDenegado,
  UID_A,
  UID_B,
  UID_C,
  type Caso,
} from "./apoyo";

/**
 * Fase 2: alquileres, invitaciones y documentos.
 * A es inquilina, B es dueño, C es un tercero que no tiene nada que ver.
 */
export const CASOS_ALQUILERES: Caso[] = [
  {
    nombre: "un tercero no ve el alquiler ajeno",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, {
        creador: UID_A,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });

      const filas = await como(client, "authenticated", UID_C, async () => {
        const { rows } = await client.query("select id from public.rentals where id = $1", [id]);
        return rows;
      });
      afirmar(filas.length === 0, "C está viendo un alquiler que no es suyo");

      for (const uid of [UID_A, UID_B]) {
        const propias = await como(client, "authenticated", uid, async () => {
          const { rows } = await client.query("select id from public.rentals where id = $1", [id]);
          return rows;
        });
        afirmar(propias.length === 1, `la parte ${uid} no ve su propio alquiler`);
      }
    },
  },
  {
    nombre: "no se puede crear un alquiler a nombre de otra persona",
    async correr(client) {
      await como(client, "authenticated", UID_A, () =>
        esperarPermisoDenegado(
          client,
          () =>
            client.query(
              `insert into public.rentals
                 (tenant_id, created_by, neighborhood_label, full_address, start_date,
                  monthly_amount, currency, due_day)
               values ($1, $1, 'Palermo, CABA', 'Gurruchaga 1234', '2026-01-01', 450000, 'ARS', 10)`,
              [UID_B],
            ),
          "crear un alquiler poniendo a otro como inquilino",
        ),
      );
    },
  },
  {
    nombre: "no se puede crear un alquiler ocupando los dos lugares",
    async correr(client) {
      const alquilarseASiMisma = `insert into public.rentals
           (tenant_id, owner_id, created_by, neighborhood_label, full_address, start_date,
            monthly_amount, currency, due_day)
         values ($1, $1, $1, 'Palermo, CABA', 'Gurruchaga 1234', '2026-01-01', 450000, 'ARS', 10)`;

      // Desde la app la corta la política de RLS...
      await como(client, "authenticated", UID_A, () =>
        esperarPermisoDenegado(
          client,
          () => client.query(alquilarseASiMisma, [UID_A]),
          "alquilarse a sí misma",
        ),
      );

      // ...y aunque alguien escribiera con service_role, la corta el check.
      await como(client, "service_role", null, () =>
        esperarError(
          client,
          "23514",
          () => client.query(alquilarseASiMisma, [UID_A]),
          "alquilarse a sí misma salteando RLS",
        ),
      );
    },
  },
  {
    nombre: "no se puede crear un alquiler ya activo, salteando la invitación",
    async correr(client) {
      await como(client, "authenticated", UID_A, () =>
        esperarPermisoDenegado(
          client,
          () =>
            client.query(
              `insert into public.rentals
                 (tenant_id, owner_id, created_by, neighborhood_label, full_address, start_date,
                  monthly_amount, currency, due_day, status)
               values ($1, $2, $1, 'Palermo, CABA', 'Gurruchaga 1234', '2026-01-01', 450000, 'ARS', 10, 'active')`,
              [UID_A, UID_B],
            ),
          "crear un alquiler ya activo",
        ),
      );
    },
  },
  {
    nombre: "quien lo creó corrige los datos mientras nadie aceptó",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });

      const afectadas = await como(client, "authenticated", UID_A, async () => {
        const res = await client.query(
          "update public.rentals set monthly_amount = 500000 where id = $1",
          [id],
        );
        return res.rowCount ?? 0;
      });
      afirmar(afectadas === 1, "la creadora no pudo corregir su alquiler pendiente");
    },
  },
  {
    nombre: "un tercero no puede editar ni borrar el alquiler",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });

      const resultado = await como(client, "authenticated", UID_C, async () => {
        const editar = await client.query(
          "update public.rentals set monthly_amount = 1 where id = $1",
          [id],
        );
        const borrar = await client.query("delete from public.rentals where id = $1", [id]);
        return { editadas: editar.rowCount ?? 0, borradas: borrar.rowCount ?? 0 };
      });
      afirmar(resultado.editadas === 0, "C editó un alquiler ajeno");
      afirmar(resultado.borradas === 0, "C borró un alquiler ajeno");
    },
  },
  {
    nombre: "las partes y el estado no se cambian con un update suelto",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });

      await como(client, "authenticated", UID_A, async () => {
        await esperarPermisoDenegado(
          client,
          () => client.query("update public.rentals set status = 'active' where id = $1", [id]),
          "activar el alquiler a mano",
        );
        await esperarPermisoDenegado(
          client,
          () =>
            client.query("update public.rentals set owner_id = $1 where id = $2", [UID_C, id]),
          "meter a un dueño a mano",
        );
      });
    },
  },
  {
    nombre: "una vez activo, ya nadie edita ni borra el alquiler",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, {
        creador: UID_A,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });

      for (const uid of [UID_A, UID_B]) {
        await como(client, "authenticated", uid, async () => {
          await esperarPermisoDenegado(
            client,
            () =>
              client.query("update public.rentals set monthly_amount = 1 where id = $1", [id]),
            `${uid} editando un alquiler ya activo`,
          );
          const borrar = await client.query("delete from public.rentals where id = $1", [id]);
          afirmar((borrar.rowCount ?? 0) === 0, `${uid} borró un alquiler ya activo`);
        });
      }
    },
  },
  {
    nombre: "la contraparte adjunta el contrato, pero no toca el monto",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, {
        creador: UID_A,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });

      const adjuntadas = await como(client, "authenticated", UID_B, async () => {
        const res = await client.query(
          "update public.rentals set contract_path = $1 where id = $2",
          [`${id}/contrato.pdf`, id],
        );
        return res.rowCount ?? 0;
      });
      afirmar(adjuntadas === 1, "el dueño no pudo adjuntar el contrato");

      await como(client, "authenticated", UID_B, () =>
        esperarPermisoDenegado(
          client,
          () =>
            client.query("update public.rentals set monthly_amount = 1 where id = $1", [id]),
          "cambiar el monto de un alquiler ya confirmado",
        ),
      );
    },
  },
  {
    nombre: "quien lo creó puede cancelarlo mientras está pendiente",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });

      const borradas = await como(client, "authenticated", UID_A, async () => {
        const res = await client.query("delete from public.rentals where id = $1", [id]);
        return res.rowCount ?? 0;
      });
      afirmar(borradas === 1, "la creadora no pudo cancelar su alquiler pendiente");
    },
  },
  {
    nombre: "un tercero no ve las invitaciones ajenas",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      await crearInvitacionDePrueba(client, { rentalId: id, creador: UID_A, rol: "owner" });

      const filas = await como(client, "authenticated", UID_C, async () => {
        const { rows } = await client.query(
          "select id from public.invitations where rental_id = $1",
          [id],
        );
        return rows;
      });
      afirmar(filas.length === 0, "C está viendo una invitación ajena");
    },
  },
  {
    nombre: "no se puede invitar a un alquiler ajeno",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });

      await como(client, "authenticated", UID_C, () =>
        esperarPermisoDenegado(
          client,
          () =>
            client.query(
              `insert into public.invitations (rental_id, invited_role, token_hash, created_by)
               values ($1, 'owner', 'hash-del-atacante', $2)`,
              [id, UID_C],
            ),
          "invitar a un alquiler ajeno",
        ),
      );
    },
  },
  {
    nombre: "solo puede haber una invitación viva por alquiler",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      await crearInvitacionDePrueba(client, { rentalId: id, creador: UID_A, rol: "owner" });

      await como(client, "service_role", null, () =>
        esperarError(
          client,
          "23505",
          () =>
            client.query(
              `insert into public.invitations (rental_id, invited_role, token_hash, created_by)
               values ($1, 'owner', 'otro-hash-distinto', $2)`,
              [id, UID_A],
            ),
          "crear una segunda invitación viva",
        ),
      );
    },
  },
  {
    nombre: "de la invitación solo se puede revocar, nada más",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      await crearInvitacionDePrueba(client, { rentalId: id, creador: UID_A, rol: "owner" });

      await como(client, "authenticated", UID_A, async () => {
        await esperarPermisoDenegado(
          client,
          () =>
            client.query(
              "update public.invitations set accepted_at = now(), accepted_by = $1 where rental_id = $2",
              [UID_A, id],
            ),
          "marcarse la invitación como aceptada",
        );

        const res = await client.query(
          "update public.invitations set revoked_at = now() where rental_id = $1",
          [id],
        );
        afirmar((res.rowCount ?? 0) === 1, "la creadora no pudo revocar su invitación");
      });
    },
  },
  {
    nombre: "el resumen de la invitación no filtra quiénes son las partes",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      const hash = await crearInvitacionDePrueba(client, {
        rentalId: id,
        creador: UID_A,
        rol: "owner",
      });

      const resumen = await como(client, "anon", null, async () => {
        const { rows } = await client.query("select public.invitation_preview($1) as r", [hash]);
        return rows[0].r;
      });

      afirmar(resumen.estado === "valida", `el resumen debería ser válido y dio ${resumen.estado}`);
      afirmar(resumen.invita.nombre === "Ana", "no muestra quién invita");
      afirmar(resumen.invita.inicial_apellido === "R", "debería mostrar solo la inicial");
      const texto = JSON.stringify(resumen);
      for (const uid of [UID_A, UID_B, UID_C]) {
        afirmar(!texto.includes(uid), "el resumen está filtrando ids de personas");
      }
      afirmar(!texto.includes("Rossi"), "el resumen está filtrando el apellido completo");
    },
  },
  {
    nombre: "una invitación vencida no se acepta",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      const hash = await crearInvitacionDePrueba(client, {
        rentalId: id,
        creador: UID_A,
        rol: "owner",
        vence: new Date(Date.now() - 60_000).toISOString(),
      });

      const resultado = await como(client, "authenticated", UID_B, async () => {
        const { rows } = await client.query("select public.invitation_accept($1) as r", [hash]);
        return rows[0].r;
      });
      afirmar(resultado.ok === false && resultado.error === "vencida", "aceptó una invitación vencida");
    },
  },
  {
    nombre: "nadie acepta su propia invitación",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      const hash = await crearInvitacionDePrueba(client, {
        rentalId: id,
        creador: UID_A,
        rol: "owner",
      });

      const resultado = await como(client, "authenticated", UID_A, async () => {
        const { rows } = await client.query("select public.invitation_accept($1) as r", [hash]);
        return rows[0].r;
      });
      afirmar(resultado.error === "sos_vos", "A se aceptó su propia invitación");
    },
  },
  {
    nombre: "aceptar ocupa el lugar libre y activa el alquiler, una sola vez",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      const hash = await crearInvitacionDePrueba(client, {
        rentalId: id,
        creador: UID_A,
        rol: "owner",
      });

      const primera = await comoPersistente(client, "authenticated", UID_B, async () => {
        const { rows } = await client.query("select public.invitation_accept($1) as r", [hash]);
        return rows[0].r;
      });
      afirmar(primera.ok === true, `B no pudo aceptar: ${primera.error}`);

      const { rows } = await client.query(
        "select owner_id, status, activated_at from public.rentals where id = $1",
        [id],
      );
      afirmar(rows[0].owner_id === UID_B, "el dueño no quedó asignado");
      afirmar(rows[0].status === "active", "el alquiler no quedó activo");
      afirmar(rows[0].activated_at !== null, "no quedó registrado cuándo se activó");

      const segunda = await como(client, "authenticated", UID_C, async () => {
        const { rows: r } = await client.query("select public.invitation_accept($1) as r", [hash]);
        return r[0].r;
      });
      afirmar(segunda.error === "usada", "el mismo link sirvió dos veces");

      const { rows: bitacora } = await client.query(
        "select count(*)::int as total from public.audit_log where entity_id = $1 and action = 'invitacion.aceptada'",
        [id],
      );
      afirmar(bitacora[0].total === 1, "la aceptación no quedó en la bitácora");
    },
  },
  {
    nombre: "sin sesión no se acepta nada: anon ni siquiera puede llamar",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      const hash = await crearInvitacionDePrueba(client, {
        rentalId: id,
        creador: UID_A,
        rol: "owner",
      });

      await como(client, "anon", null, () =>
        esperarPermisoDenegado(
          client,
          () => client.query("select public.invitation_accept($1) as r", [hash]),
          "aceptar una invitación sin sesión",
        ),
      );
    },
  },
  {
    nombre: "rechazar deja el alquiler en rejected y quema el link",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, { creador: UID_A, rol: "tenant" });
      const hash = await crearInvitacionDePrueba(client, {
        rentalId: id,
        creador: UID_A,
        rol: "owner",
      });

      const resultado = await comoPersistente(client, "anon", null, async () => {
        const { rows } = await client.query("select public.invitation_reject($1) as r", [hash]);
        return rows[0].r;
      });
      afirmar(resultado.ok === true, `no se pudo rechazar: ${resultado.error}`);

      const { rows } = await client.query("select status from public.rentals where id = $1", [id]);
      afirmar(rows[0].status === "rejected", "el alquiler no quedó rechazado");

      const otraVez = await como(client, "authenticated", UID_B, async () => {
        const { rows: r } = await client.query("select public.invitation_accept($1) as r", [hash]);
        return r[0].r;
      });
      afirmar(otraVez.ok === false, "se pudo aceptar una invitación ya rechazada");
    },
  },
  {
    nombre: "el contrato solo lo ven las dos partes del alquiler",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, {
        creador: UID_A,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });
      await client.query(
        "insert into storage.objects (bucket_id, name, owner) values ('documentos', $1, $2)",
        [`${id}/contrato.pdf`, UID_A],
      );

      for (const uid of [UID_A, UID_B]) {
        const filas = await como(client, "authenticated", uid, async () => {
          const { rows } = await client.query(
            "select name from storage.objects where name = $1",
            [`${id}/contrato.pdf`],
          );
          return rows;
        });
        afirmar(filas.length === 1, `${uid} no puede ver el contrato de su alquiler`);
      }

      const deC = await como(client, "authenticated", UID_C, async () => {
        const { rows } = await client.query("select name from storage.objects where name = $1", [
          `${id}/contrato.pdf`,
        ]);
        return rows;
      });
      afirmar(deC.length === 0, "C está viendo el contrato de un alquiler ajeno");

      const anonimo = await como(client, "anon", null, async () => {
        const { rows } = await client.query("select name from storage.objects");
        return rows;
      });
      afirmar(anonimo.length === 0, "un anónimo está viendo documentos privados");
    },
  },
  {
    nombre: "nadie sube documentos a la carpeta de un alquiler ajeno",
    async correr(client) {
      const id = await crearAlquilerDePrueba(client, {
        creador: UID_A,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });

      const subidas = await como(client, "authenticated", UID_C, async () => {
        const res = await client.query(
          "insert into storage.objects (bucket_id, name, owner) values ('documentos', $1, $2) on conflict do nothing",
          [`${id}/falso.pdf`, UID_C],
        );
        return res.rowCount ?? 0;
      }).catch((error) => {
        // La política puede rechazar con permiso denegado: también está bien.
        if ((error as { code?: string }).code === "42501") return 0;
        throw error;
      });
      afirmar(subidas === 0, "C subió un archivo al alquiler de otra persona");
    },
  },
  {
    nombre: "el perfil de la contraparte se ve; el de un desconocido no",
    async correr(client) {
      await crearAlquilerDePrueba(client, {
        creador: UID_A,
        rol: "tenant",
        contraparte: UID_B,
        estado: "active",
      });

      const visto = await como(client, "authenticated", UID_A, async () => {
        const { rows } = await client.query(
          "select first_name from public.profiles where id = $1",
          [UID_B],
        );
        return rows;
      });
      afirmar(visto.length === 1, "A no ve el perfil del dueño con el que comparte alquiler");

      const desconocido = await como(client, "authenticated", UID_A, async () => {
        const { rows } = await client.query(
          "select first_name from public.profiles where id = $1",
          [UID_C],
        );
        return rows;
      });
      afirmar(desconocido.length === 0, "A ve el perfil de alguien con quien no comparte nada");
    },
  },
];
