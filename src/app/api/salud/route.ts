import { NextResponse } from "next/server";
import { serverEnv, variablesFaltantes } from "@/lib/env";
import { createAdminClient, createAnonClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { estadoDeConsulta } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";

/*
 * Diagnóstico de la instalación: /api/salud
 *
 * Dice QUÉ falta, nunca el valor de nada. Sirve para responder en diez
 * segundos "¿por qué no anda en producción?" sin tener que leer logs.
 *
 * Dos reglas que aprendimos a los golpes:
 *
 *   1. Las tablas se revisan con el cliente de administración. La app casi
 *      nunca las lee "a secas": lo hace con la sesión de una persona y pasando
 *      por RLS. Preguntarle a `anon` si ve `rentals` da error SIEMPRE, y ese
 *      error es la respuesta correcta: anon no tiene ningún permiso ahí.
 *   2. Nunca con `head: true`. Una respuesta HEAD no trae cuerpo, así que el
 *      error de PostgREST llega vacío: quedaba "error (?): " y no se podía
 *      diagnosticar nada. Con `limit(0)` el cuerpo viene igual (una lista
 *      vacía, sin datos de nadie) y los errores traen código y mensaje.
 */

/*
 * Las revisiones salen todas juntas: son independientes entre sí y en serie el
 * diagnóstico tardaba casi un minuto cuando algo no respondía, que es
 * justamente cuando más lo necesitás.
 */

/** Ninguna revisión puede colgar el diagnóstico. */
async function conTiempoLimite<T>(promesa: PromiseLike<T>, ms = 3000): Promise<T | "timeout"> {
  return Promise.race([
    Promise.resolve(promesa),
    new Promise<"timeout">((resolver) => setTimeout(() => resolver("timeout"), ms)),
  ]);
}

export async function GET(request: Request) {
  /*
   * El detalle (qué tablas fallan, con qué error, qué variable falta) es
   * reconocimiento servido en bandeja para cualquiera que pase. Lo ve quien
   * tiene sesión —abrirlo en el navegador donde ya entraste sigue funcionando—
   * o quien manda el secreto del cron. Para el resto, solo si está sano.
   */
  const secreto = serverEnv.cronSecret;
  const conSecreto = Boolean(secreto) && request.headers.get("authorization") === `Bearer ${secreto}`;
  const conSesion = await haySesion();
  const detallado = conSecreto || conSesion;

  const faltan = variablesFaltantes();

  const revisiones: Record<string, string> = {};

  /*
   * El dominio. Los links de los mails, el Open Graph y las URLs canónicas
   * salen todos de NEXT_PUBLIC_SITE_URL: si no coincide con el dominio por el
   * que estás entrando, los mails van a mandar a otro lado.
   */
  const sitio = serverEnv.siteUrl;
  const hostPedido = new URL(request.url).host;
  const hostConfigurado = (() => {
    try {
      return new URL(sitio).host;
    } catch {
      return null;
    }
  })();

  revisiones["sitio:url"] = !hostConfigurado
    ? `NEXT_PUBLIC_SITE_URL no es una URL válida: ${sitio}`
    : hostConfigurado.endsWith(".vercel.app")
      ? `apunta al dominio de Vercel (${hostConfigurado}), no al propio`
      : "ok";

  // Entrar por otro dominio no es un error de configuración: se informa.
  const sitioInfo = {
    configurado: sitio,
    entraste_por: hostPedido,
    coincide: hostConfigurado === hostPedido,
  };

  /* Cada revisión arranca al agregarse; abajo se esperan todas juntas. */
  const pendientes: Array<readonly [string, Promise<string>]> = [];
  function revisar(nombre: string, hacer: () => Promise<string>): void {
    const promesa = hacer().catch(
      (error: unknown) => `no se pudo revisar: ${(error as Error).message}`,
    );
    pendientes.push([nombre, promesa] as const);
  }

  try {
    const admin = createAdminClient();
    // Sin las cookies del pedido: si lo mirara con TU sesión, diría cualquier cosa.
    const visitante = createAnonClient();

    /*
     * ¿PostgREST ve las tablas? Si acabás de aplicar migraciones, el caché del
     * esquema puede estar viejo y esto lo delata (error PGRST205).
     */
    const TABLAS = [
      "profiles",
      "rentals",
      "invitations",
      "payments",
      "share_links",
      "reviews",
      "review_tag_defs",
      "notifications",
      "action_tokens",
    ];

    for (const tabla of TABLAS) {
      revisar(`tabla:${tabla}`, async () => {
        if (!admin) return "sin service role: no se puede revisar";
        // `limit(0)`: confirma que la tabla existe sin traer una sola fila.
        return estadoDeConsulta(
          await conTiempoLimite(admin.from(tabla).select("*").limit(0)),
        );
      });
    }

    /*
     * Y la otra mitad de la pregunta: que las tablas privadas sigan cerradas
     * para quien no tiene sesión. Acá "no pude leer" es la respuesta buena; la
     * mala sería que devolviera filas.
     */
    for (const tabla of ["rentals", "payments", "profiles"]) {
      revisar(`cerrado:${tabla}`, async () => {
        const resultado = await conTiempoLimite(visitante.from(tabla).select("id").limit(1));
        if (resultado === "timeout") return "no respondió a tiempo";
        // PostgREST la rechaza, o RLS no devuelve nada: las dos sirven.
        if (resultado.error) return "ok";
        return (resultado.data?.length ?? 0) === 0
          ? "ok"
          : "¡ABIERTA! sin sesión se pueden leer filas de esta tabla";
      });
    }

    /*
     * Las funciones de las pantallas públicas, preguntadas como las pregunta
     * una visita: son las que sostienen /invitacion, /p y el link del mail.
     * Con un token que no existe tienen que contestar, no fallar.
     */
    const SIN_TOKEN = "0".repeat(64);
    revisar("rpc:invitation_preview", async () =>
      estadoDeConsulta(
        await conTiempoLimite(visitante.rpc("invitation_preview", { p_token_hash: SIN_TOKEN })),
      ),
    );
    revisar("rpc:payment_token_preview", async () =>
      estadoDeConsulta(
        await conTiempoLimite(visitante.rpc("payment_token_preview", { p_token_hash: SIN_TOKEN })),
      ),
    );
    revisar("rpc:public_profile", async () =>
      estadoDeConsulta(
        await conTiempoLimite(
          visitante.rpc("public_profile", { p_token_hash: SIN_TOKEN, p_contar: false }),
        ),
      ),
    );

    // El bucket de los documentos: que exista y que siga siendo privado.
    revisar("storage:documentos", async () => {
      if (!admin) return "sin service role: no se puede revisar";
      const bucket = await conTiempoLimite(admin.storage.getBucket("documentos"));
      if (bucket === "timeout") return "no respondió a tiempo";
      if (bucket.error) return estadoDeConsulta(bucket);
      return bucket.data?.public
        ? "¡PÚBLICO! los comprobantes se pueden abrir sin permiso"
        : "ok";
    });

    for (const [nombre, promesa] of pendientes) {
      revisiones[nombre] = await promesa;
    }
  } catch (error) {
    revisiones["supabase"] = `no se pudo conectar: ${(error as Error).message}`;
  }

  const todoOk =
    faltan.imprescindibles.length === 0 &&
    faltan.secundarias.length === 0 &&
    Object.values(revisiones).every((valor) => valor === "ok");

  const cuerpo = detallado
    ? {
        ok: todoOk,
        sitio: sitioInfo,
        variables_faltantes: faltan,
        revisiones,
        ayuda: todoOk
          ? undefined
          : "Cargá lo que falte en las variables de entorno del proyecto y volvé a deployar. Las tablas que den error suelen ser migraciones sin aplicar: probá con `notify pgrst, 'reload schema';` en el SQL Editor.",
      }
    : {
        ok: todoOk,
        ayuda: "Entrá a Inkey o mandá el secreto del cron para ver el detalle.",
      };

  return NextResponse.json(cuerpo, {
    status: todoOk ? 200 : 503,
    headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

/** ¿Quien pregunta entró a Inkey? No hace falta saber quién es, solo que entró. */
async function haySesion(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}
