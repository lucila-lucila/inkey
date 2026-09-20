import type { Client } from "pg";

/** Piezas compartidas por todos los tests de RLS. */

export type Caso = { nombre: string; correr: (client: Client) => Promise<void> };

export const PERMISO_DENEGADO = "42501";
export const UID_A = "11111111-1111-4111-8111-111111111111";
export const UID_B = "22222222-2222-4222-8222-222222222222";

export function afirmar(condicion: boolean, mensaje: string): void {
  if (!condicion) throw new Error(mensaje);
}

/** Corre una consulta con el rol y el usuario indicados, y deshace todo al final. */
export async function como<T>(
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
export async function esperarError(
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

export function esperarPermisoDenegado(
  client: Client,
  fn: () => Promise<unknown>,
  que: string,
): Promise<void> {
  return esperarError(client, PERMISO_DENEGADO, fn, que);
}

/**
 * Como `como`, pero sin deshacer al final: para los casos que comprueban que
 * un cambio quedó escrito (aceptar una invitación, por ejemplo).
 */
export async function comoPersistente<T>(
  client: Client,
  rol: "anon" | "authenticated" | "service_role",
  uid: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    uid ? JSON.stringify({ sub: uid, role: rol }) : "",
  ]);
  await client.query(`set role ${rol}`);
  try {
    return await fn();
  } finally {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', false)");
  }
}

export const UID_C = "33333333-3333-4333-8333-333333333333";

/** Crea un alquiler de prueba saltando RLS, para armar el escenario. */
export async function crearAlquilerDePrueba(
  client: Client,
  opciones: {
    creador: string;
    rol: "tenant" | "owner";
    estado?: string;
    contraparte?: string | null;
    diaVencimiento?: number;
  },
): Promise<string> {
  const { creador, rol, estado = "pending", contraparte = null, diaVencimiento = 10 } = opciones;
  const tenant = rol === "tenant" ? creador : contraparte;
  const owner = rol === "owner" ? creador : contraparte;

  const { rows } = await client.query(
    `insert into public.rentals
       (tenant_id, owner_id, created_by, neighborhood_label, full_address,
        start_date, monthly_amount, currency, due_day, status)
     values ($1, $2, $3, 'Palermo, CABA', 'Gurruchaga 1234, 3B',
             '2026-01-01', 450000, 'ARS', $4, $5)
     returning id`,
    [tenant, owner, creador, diaVencimiento, estado],
  );
  return rows[0].id;
}

/** Crea una invitación de prueba y devuelve su hash (el token no existe acá). */
export async function crearInvitacionDePrueba(
  client: Client,
  opciones: { rentalId: string; creador: string; rol: "owner" | "tenant"; vence?: string },
): Promise<string> {
  const hash = `hash-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  await client.query(
    `insert into public.invitations (rental_id, invited_role, token_hash, created_by, expires_at)
     values ($1, $2, $3, $4, coalesce($5::timestamptz, now() + interval '7 days'))`,
    [opciones.rentalId, opciones.rol, hash, opciones.creador, opciones.vence ?? null],
  );
  return hash;
}
