import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { types } from "pg";
import type { Pool, PoolClient } from "pg";

/*
 * `pg` devuelve fechas como Date y numeric como string; PostgREST devuelve
 * "2026-09-01" y un número. La app está escrita contra lo segundo, así que
 * acá traducimos: si no, las pantallas rompen por un formato que en producción
 * nunca ven.
 */
types.setTypeParser(types.builtins.DATE, (valor) => valor);
types.setTypeParser(types.builtins.TIMESTAMP, (valor) => valor);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (valor) => valor);
types.setTypeParser(types.builtins.NUMERIC, (valor) => Number(valor));
types.setTypeParser(types.builtins.INT8, (valor) => Number(valor));

/*
 * Un Supabase de mentira, lo justo para sacar capturas.
 *
 * No hay Docker en este entorno, así que no podemos levantar el stack real.
 * Esto habla el mismo protocolo HTTP que PostgREST, GoTrue y Storage contra
 * el Postgres efímero de `tests/rls/cluster.ts`, que ya trae las migraciones
 * y el seed. La gracia es que las consultas pasan por RLS de verdad: lo que
 * se ve en la captura es lo que vería la persona.
 *
 *   ⚠️  Es una herramienta de desarrollo. No valida nada, firma con un
 *       secreto de juguete y no tiene por qué ser fiel fuera de los caminos
 *       que usa la app.
 */

const SECRETO = "secreto-de-juguete-para-capturas";

// --------------------------------------------------------------------- JWT

function base64url(dato: Buffer | string): string {
  return Buffer.from(dato)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function firmarJwt(claims: Record<string, unknown>): string {
  const cabecera = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(claims));
  const firma = base64url(
    createHmac("sha256", SECRETO).update(`${cabecera}.${cuerpo}`).digest(),
  );
  return `${cabecera}.${cuerpo}.${firma}`;
}

function leerJwt(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// ------------------------------------------------------- filtros PostgREST

/*
 * `?estado=eq.activo` y compañía. Solo los operadores que usa la app; si
 * aparece uno nuevo, mejor que falle fuerte y no que devuelva de más.
 */
const OPERADORES: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
};

function comoValor(crudo: string, valores: unknown[]): string {
  if (crudo === "null") return "null";
  valores.push(crudo);
  return `$${valores.length}`;
}

function condicion(columna: string, expresion: string, valores: unknown[]): string {
  const corte = expresion.indexOf(".");
  const operador = expresion.slice(0, corte);
  const crudo = expresion.slice(corte + 1);
  const col = `"${columna}"`;

  if (operador === "is") return `${col} is ${crudo === "null" ? "null" : crudo}`;
  if (operador === "not") {
    // `not.is.null`
    const [siguiente, ...resto] = crudo.split(".");
    return `not (${condicion(columna, `${siguiente}.${resto.join(".")}`, valores)})`;
  }
  if (operador === "in") {
    const lista = crudo.replace(/^\(|\)$/g, "").split(",");
    const marcas = lista.map((item) => comoValor(item.replace(/^"|"$/g, ""), valores));
    return `${col} in (${marcas.join(", ")})`;
  }

  const sql = OPERADORES[operador];
  if (!sql) throw new Error(`Operador de PostgREST que no conozco: ${operador}`);
  const marca = comoValor(crudo, valores);
  if (marca === "null") return `${col} is null`;
  return `${col} ${sql} ${marca}`;
}

function listaDeColumnas(select: string | null): string {
  if (!select || select.trim() === "*") return "*";
  return select
    .split(",")
    .map((parte) => `"${parte.trim()}"`)
    .join(", ");
}

function ordenar(order: string | null): string {
  if (!order) return "";
  const partes = order.split(",").map((trozo) => {
    const [columna, ...modificadores] = trozo.split(".");
    const desc = modificadores.includes("desc");
    const nulos = modificadores.includes("nullsfirst")
      ? " nulls first"
      : modificadores.includes("nullslast")
        ? " nulls last"
        : "";
    return `"${columna}" ${desc ? "desc" : "asc"}${nulos}`;
  });
  return ` order by ${partes.join(", ")}`;
}

// ------------------------------------------------------------- el servidor

type Sesion = { id: string; email: string };

async function cuerpo(req: IncomingMessage): Promise<string> {
  const trozos: Buffer[] = [];
  for await (const trozo of req) trozos.push(trozo as Buffer);
  return Buffer.concat(trozos).toString("utf8");
}

function responder(res: ServerResponse, codigo: number, datos: unknown, extra: Record<string, string> = {}) {
  const texto = datos === null ? "" : JSON.stringify(datos);
  res.writeHead(codigo, {
    "content-type": "application/json",
    "content-range": "0-0/*",
    ...extra,
  });
  res.end(texto);
}

export type SupabaseFalso = {
  url: string;
  anonKey: string;
  serviceKey: string;
  detener: () => Promise<void>;
};

export async function levantarSupabaseFalso(pool: Pool, puerto: number): Promise<SupabaseFalso> {
  const anonKey = firmarJwt({ role: "anon", iss: "supabase" });
  const serviceKey = firmarJwt({ role: "service_role", iss: "supabase" });

  /*
   * Cada request corre en una transacción con el rol y el JWT de quien la
   * hizo, igual que PostgREST. Sin esto las políticas no se aplicarían y las
   * capturas mostrarían datos que la persona no puede ver.
   */
  async function comoRol<T>(
    claims: Record<string, unknown> | null,
    tarea: (conexion: PoolClient) => Promise<T>,
  ): Promise<T> {
    const rol = (claims?.role as string) ?? "anon";
    const conexion = await pool.connect();
    await conexion.query("begin");
    try {
      if (rol === "service_role") {
        await conexion.query("set local role postgres");
      } else {
        await conexion.query(`set local role ${rol === "authenticated" ? "authenticated" : "anon"}`);
      }
      await conexion.query("select set_config('request.jwt.claims', $1, true)", [
        claims ? JSON.stringify(claims) : "",
      ]);
      const salida = await tarea(conexion);
      await conexion.query("commit");
      return salida;
    } catch (error) {
      await conexion.query("rollback");
      throw error;
    } finally {
      conexion.release();
    }
  }

  function sesionPara(usuario: Sesion) {
    const ahora = Math.floor(Date.now() / 1000);
    const claims = {
      sub: usuario.id,
      email: usuario.email,
      role: "authenticated",
      aud: "authenticated",
      iat: ahora,
      exp: ahora + 60 * 60 * 8,
      session_id: randomUUID(),
    };
    return {
      access_token: firmarJwt(claims),
      refresh_token: `refresh-${usuario.id}`,
      token_type: "bearer",
      expires_in: 60 * 60 * 8,
      expires_at: claims.exp,
      user: usuarioComoGoTrue(usuario),
    };
  }

  function usuarioComoGoTrue(usuario: Sesion) {
    return {
      id: usuario.id,
      aud: "authenticated",
      role: "authenticated",
      email: usuario.email,
      email_confirmed_at: new Date().toISOString(),
      phone: "",
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    };
  }

  async function buscarUsuario(donde: string, valor: string): Promise<Sesion | null> {
    const { rows } = await pool.query(
      `select id, email from auth.users where ${donde} = $1 limit 1`,
      [valor],
    );
    return rows[0] ?? null;
  }

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${puerto}`);
    const ruta = url.pathname;
    const metodo = req.method ?? "GET";
    const texto = metodo === "GET" || metodo === "HEAD" ? "" : await cuerpo(req);
    const json = texto ? JSON.parse(texto) : {};

    const autorizacion = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const apikey = (req.headers.apikey as string) ?? "";
    const claims = leerJwt(autorizacion) ?? leerJwt(apikey);

    try {
      // ------------------------------------------------------------- GoTrue
      if (ruta === "/auth/v1/otp") {
        // El mail no se manda: el código lo escribe el guion de capturas.
        return responder(res, 200, {});
      }

      if (ruta === "/auth/v1/verify") {
        const usuario = await buscarUsuario("email", json.email);
        if (!usuario) {
          return responder(res, 403, { error: "otp_expired", error_description: "Token has expired" });
        }
        return responder(res, 200, sesionPara(usuario));
      }

      if (ruta === "/auth/v1/token") {
        const id = String(json.refresh_token ?? "").replace(/^refresh-/, "");
        const usuario = await buscarUsuario("id", id);
        if (!usuario) return responder(res, 400, { error: "invalid_grant" });
        return responder(res, 200, sesionPara(usuario));
      }

      if (ruta === "/auth/v1/logout") {
        res.writeHead(204).end();
        return;
      }

      if (ruta === "/auth/v1/user" && metodo === "GET") {
        const id = claims?.sub as string | undefined;
        const usuario = id ? await buscarUsuario("id", id) : null;
        if (!usuario) return responder(res, 401, { message: "invalid claim: missing sub claim" });
        return responder(res, 200, usuarioComoGoTrue(usuario));
      }

      // `auth.admin.updateUserById` / `getUserById`: la baja de cuenta.
      const admin = ruta.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/);
      if (admin) {
        const id = admin[1];
        if (metodo === "PUT") {
          if (json.email) {
            await pool.query("update auth.users set email = $1 where id = $2", [json.email, id]);
          }
          const usuario = await buscarUsuario("id", id);
          return responder(res, 200, usuario ? usuarioComoGoTrue(usuario) : {});
        }
        const usuario = await buscarUsuario("id", id);
        if (!usuario) return responder(res, 404, { message: "User not found" });
        return responder(res, 200, usuarioComoGoTrue(usuario));
      }

      // ------------------------------------------------------------ Storage
      if (ruta.startsWith("/storage/v1/")) {
        return responder(res, 200, manejarStorage(ruta, metodo));
      }

      // ---------------------------------------------------------- PostgREST
      if (ruta.startsWith("/rest/v1/")) {
        const salida = await comoRol(claims, (conexion) =>
          manejarRest(conexion, ruta, metodo, url, json, req),
        );
        return responder(res, salida.codigo, salida.datos);
      }

      responder(res, 404, { message: `sin ruta: ${ruta}` });
    } catch (error) {
      const mensaje = (error as Error).message;
      console.error("[supabase-falso]", metodo, ruta, mensaje);
      responder(res, 500, { message: mensaje, code: "PGRST000", details: null, hint: null });
    }
  });

  /*
   * Storage no tiene backend acá: las capturas no necesitan ver el archivo,
   * solo que la pantalla no se rompa cuando lo pide.
   */
  function manejarStorage(ruta: string, metodo: string): unknown {
    if (ruta.includes("/bucket/")) return { name: "documentos", id: "documentos", public: false };
    if (ruta.includes("/object/sign/")) {
      return { signedURL: "/documento-de-ejemplo", signedUrl: "/documento-de-ejemplo" };
    }
    if (ruta.includes("/object/list/")) return [];
    if (metodo === "POST" || metodo === "PUT") {
      return { Key: "documentos/archivo", Id: randomUUID(), path: "archivo" };
    }
    return {};
  }

  async function manejarRest(
    conexion: PoolClient,
    ruta: string,
    metodo: string,
    url: URL,
    json: Record<string, unknown> | unknown[],
    req: IncomingMessage,
  ): Promise<{ codigo: number; datos: unknown }> {
    const recurso = ruta.replace("/rest/v1/", "");
    const prefiereUno = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    const devuelve = (req.headers.prefer ?? "").includes("return=representation");

    // ------------------------------------------------------------------ RPC
    if (recurso.startsWith("rpc/")) {
      const funcion = recurso.slice(4);
      const argumentos = json as Record<string, unknown>;
      const nombres = Object.keys(argumentos);
      const marcas = nombres.map((nombre, i) => `${nombre} => $${i + 1}`);
      const { rows } = await conexion.query(
        `select public."${funcion}"(${marcas.join(", ")}) as salida`,
        nombres.map((nombre) => argumentos[nombre]),
      );
      return { codigo: 200, datos: rows[0]?.salida ?? null };
    }

    const tabla = recurso.split("?")[0];
    const esquema = tabla.includes(".") ? tabla : `public."${tabla}"`;
    const valores: unknown[] = [];
    const filtros: string[] = [];

    for (const [clave, valor] of url.searchParams) {
      if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(clave)) continue;
      filtros.push(condicion(clave, valor, valores));
    }
    const donde = filtros.length ? ` where ${filtros.join(" and ")}` : "";
    const columnas = listaDeColumnas(url.searchParams.get("select"));
    const limite = url.searchParams.get("limit");

    if (metodo === "GET" || metodo === "HEAD") {
      const sql =
        `select ${columnas} from ${esquema}${donde}` +
        ordenar(url.searchParams.get("order")) +
        (limite ? ` limit ${Number(limite)}` : "");
      const { rows } = await conexion.query(sql, valores);
      if (prefiereUno) {
        if (rows.length === 0) {
          return { codigo: 406, datos: { code: "PGRST116", message: "0 rows", details: null, hint: null } };
        }
        return { codigo: 200, datos: rows[0] };
      }
      return { codigo: 200, datos: rows };
    }

    if (metodo === "POST") {
      const filas = Array.isArray(json) ? json : [json];
      const claves = Object.keys(filas[0] as object);
      const insertados: unknown[] = [];
      for (const fila of filas) {
        const marcas = claves.map((_, i) => `$${i + 1}`);
        const { rows } = await conexion.query(
          `insert into ${esquema} (${claves.map((c) => `"${c}"`).join(", ")})` +
            ` values (${marcas.join(", ")}) returning ${columnas}`,
          claves.map((clave) => (fila as Record<string, unknown>)[clave]),
        );
        insertados.push(rows[0]);
      }
      if (!devuelve) return { codigo: 201, datos: null };
      return { codigo: 201, datos: prefiereUno ? insertados[0] : insertados };
    }

    if (metodo === "PATCH") {
      const cambios = json as Record<string, unknown>;
      const claves = Object.keys(cambios);
      const sets = claves.map((clave) => {
        valores.push(cambios[clave]);
        return `"${clave}" = $${valores.length}`;
      });
      const { rows } = await conexion.query(
        `update ${esquema} set ${sets.join(", ")}${donde} returning ${columnas}`,
        valores,
      );
      if (!devuelve) return { codigo: 204, datos: null };
      return { codigo: 200, datos: prefiereUno ? (rows[0] ?? null) : rows };
    }

    if (metodo === "DELETE") {
      const { rows } = await conexion.query(
        `delete from ${esquema}${donde} returning ${columnas}`,
        valores,
      );
      if (!devuelve) return { codigo: 204, datos: null };
      return { codigo: 200, datos: rows };
    }

    return { codigo: 405, datos: { message: `método sin soporte: ${metodo}` } };
  }

  await new Promise<void>((listo) => servidor.listen(puerto, "127.0.0.1", listo));

  return {
    url: `http://127.0.0.1:${puerto}`,
    anonKey,
    serviceKey,
    detener: () => new Promise<void>((listo) => servidor.close(() => listo())),
  };
}
