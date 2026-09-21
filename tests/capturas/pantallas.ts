import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";
import { chromium, type Page } from "@playwright/test";

/*
 * El recorrido: qué pantallas se capturan y en qué estado.
 *
 * Cada una sale en escritorio (1440) y celular (390), de página completa. El
 * nombre lleva el número de la lista de la revisión de diseño para que el
 * orden del archivo sea el orden de la charla.
 */

const ANCHOS = [
  { nombre: "1440", viewport: { width: 1440, height: 900 } },
  { nombre: "390", viewport: { width: 390, height: 844 } },
] as const;

const CHROMIUM = "/opt/pw-browsers/chromium";

type Contexto = { base: string; salida: string; client: Client };

export async function recorrerPantallas({ base, salida, client }: Contexto) {
  /*
   * Las tipografías de la marca vienen de Google Fonts. En este entorno la
   * salida pasa por un proxy con su propio certificado, así que hay que
   * mandarlo por ahí y aceptarle el certificado: si no, las capturas salen
   * con la tipografía de respaldo y la revisión de diseño no sirve.
   */
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const navegador = await chromium.launch({
    executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined,
    proxy: proxy ? { server: proxy, bypass: "127.0.0.1,localhost" } : undefined,
  });

  const datos = await prepararDatos(client);

  for (const ancho of ANCHOS) {
    // Cada ancho recorre lo mismo desde el mismo punto de partida.
    await reiniciar(client);

    const contexto = await navegador.newContext({
      viewport: ancho.viewport,
      deviceScaleFactor: 2,
      locale: "es-AR",
      ignoreHTTPSErrors: Boolean(proxy),
    });
    const page = await contexto.newPage();
    const foto = fotografo(page, salida, ancho.nombre);

    page.on("console", (mensaje) => {
      if (mensaje.type() === "error") console.log(`       [consola] ${mensaje.text()}`);
    });

    try {
      await recorrido({ page, foto, base, datos, client });
    } catch (error) {
      // Una captura del momento en que se rompió vale más que el stack.
      await page.screenshot({ path: join(salida, `_falla-${ancho.nombre}.png`), fullPage: true });
      console.error(`     ✗ ${ancho.nombre}px en ${page.url()}`);
      throw error;
    }

    await contexto.close();
    console.log(`     ✓ ${ancho.nombre}px`);
  }

  await navegador.close();
}

function fotografo(page: Page, salida: string, ancho: string) {
  return async (nombre: string) => {
    // Sin animaciones a medio camino y con las fuentes ya cargadas.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(salida, `${nombre}-${ancho}.png`), fullPage: true });
  };
}

type Datos = Awaited<ReturnType<typeof prepararDatos>>;

/*
 * El recorrido escribe (completa un onboarding, da de alta un alquiler, crea
 * un link). Antes de cada ancho deshacemos eso, así las dos tandas salen de
 * la misma foto de la base y las capturas son comparables.
 */
async function reiniciar(client: Client) {
  const nueva = "(select id from auth.users where email = 'nueva@ejemplo.test')";
  await client.query(`delete from public.invitations where rental_id in
    (select id from public.rentals where created_by = ${nueva})`);
  await client.query(`delete from public.rentals where created_by = ${nueva}`);
  // El seed no crea ninguno: los que haya son del recorrido anterior.
  await client.query("delete from public.share_links");
  await client.query("delete from public.rate_limit_events");
  await client.query(`update public.profiles set
      first_name = null, last_name = null, phone = null,
      initial_intent = null, accepted_terms_at = null, accepted_privacy_at = null
    where id = ${nueva}`);
}

/*
 * Lo que el seed no deja armado: una persona recién llegada (para el
 * onboarding y el panel vacío) y el token del link de pago, que en la vida
 * real lo crea el mail.
 */
async function prepararDatos(client: Client) {
  const id = async (sql: string, valores: unknown[] = []) => {
    const { rows } = await client.query(sql, valores);
    return rows[0];
  };

  const martina = await id("select id from auth.users where email = 'martina@ejemplo.test'");
  const jorge = await id("select id from auth.users where email = 'jorge@ejemplo.test'");
  const paula = await id("select id from auth.users where email = 'paula@ejemplo.test'");

  // Alguien que recién se registra: perfil vacío, sin alquileres.
  await client.query(
    "insert into auth.users (email) values ('nueva@ejemplo.test') on conflict (email) do nothing",
  );

  const activo = await id(
    "select id from public.rentals where status = 'active' order by created_at limit 1",
  );
  const pendiente = await id("select id from public.rentals where status = 'pending' limit 1");
  const terminado = await id("select id from public.rentals where status = 'ended' limit 1");
  const pagoPendiente = await id(
    "select id from public.payments where status = 'reported' order by period desc limit 1",
  );

  // El link firmado que le llega al dueño por mail.
  const token = randomBytes(32).toString("base64url");
  await client.query(
    `insert into public.action_tokens (id, token_hash, purpose, payment_id, expires_at)
     values ($1, $2, 'confirm_payment', $3, now() + interval '72 hours')`,
    [randomUUID(), createHash("sha256").update(token).digest("hex"), pagoPendiente.id],
  );

  return {
    martina: martina.id as string,
    jorge: jorge.id as string,
    paula: paula.id as string,
    activo: activo.id as string,
    pendiente: pendiente.id as string,
    terminado: terminado.id as string,
    pagoPendiente: pagoPendiente.id as string,
    tokenDePago: token,
  };
}

type Paso = {
  page: Page;
  foto: (nombre: string) => Promise<void>;
  base: string;
  datos: Datos;
  client: Client;
};

/*
 * Entra con el mail de alguien del seed. El código lo acepta el Supabase falso.
 *
 * El recorrido entra y sale muchas veces seguidas, así que antes de cada
 * ingreso borramos la bitácora del límite de frecuencia: si no, la app nos
 * frena —y hace bien— a mitad de camino.
 */
async function entrar(
  page: Page,
  base: string,
  client: Client,
  email: string,
  volverA = "/panel",
) {
  await client.query("delete from public.rate_limit_events");
  await page.goto(`${base}/ingresar?volver_a=${encodeURIComponent(volverA)}`);
  await page.getByLabel("Tu mail").fill(email);
  await page.getByRole("button", { name: "Enviarme el link" }).click();
  await page.getByLabel(/código del mail/i).fill("123456");
  await page.getByRole("button", { name: "Entrar con el código" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/ingresar"), { timeout: 15_000 });
}

async function salir(page: Page, base: string) {
  await page.context().clearCookies();
  await page.goto(`${base}/`);
}

async function recorrido({ page, foto, base, datos, client }: Paso) {
  // ------------------------------------------------------------ 1. ingresar
  await client.query("delete from public.rate_limit_events");
  await page.goto(`${base}/ingresar`);
  await foto("01-ingresar-vacio");

  await page.getByLabel("Tu mail").fill("martina@ejemplo.test");
  await page.getByRole("button", { name: "Enviarme el link" }).click();
  await page.getByLabel(/código del mail/i).waitFor();
  await foto("02-ingresar-codigo");

  await page.goto(`${base}/ingresar?error=otp_expired`);
  await foto("03-ingresar-link-vencido");

  // --------------------------------------------- 2 y 3a. onboarding y panel vacío
  await entrar(page, base, client, "nueva@ejemplo.test", "/panel");
  await page.goto(`${base}/onboarding`);
  await foto("04-onboarding");

  // Completa el onboarding para llegar al panel vacío de alguien sin alquileres.
  await page.getByLabel("Nombre").fill("Camila");
  await page.getByLabel("Apellido").fill("Suárez");
  await page.getByLabel(/celular/i).fill("+54 9 11 5555 4444");
  for (const casilla of await page.getByRole("checkbox").all()) await casilla.check();
  await page.getByRole("button", { name: "Listo, empezar" }).click();
  await page.waitForURL(/\/panel/, { timeout: 15_000 });
  await foto("05-panel-vacio");

  // --------------------------------------------------- 4. alta de un alquiler
  await page.goto(`${base}/alquileres/nuevo?rol=inquilino`);
  await foto("06-alquiler-nuevo-paso-1");
  await page.getByLabel("Dirección").fill("Gurruchaga 1234, 3° B");
  await page.getByLabel("Barrio y ciudad").fill("Palermo, CABA");
  await page.getByRole("button", { name: "Continuar" }).click();
  await foto("07-alquiler-nuevo-paso-2");

  await page.getByLabel("Empezó el").fill("2025-03-01");
  await page.getByLabel(/Termina el/).fill("2027-02-28");
  await page.getByLabel(/Cuánto pagás por mes/).fill("450000");
  await page.getByLabel("Día de vencimiento").fill("10");
  await page.getByRole("button", { name: "Continuar" }).click();
  await foto("08-alquiler-nuevo-paso-3");

  // El índice y la frecuencia van juntos: o los dos, o ninguno.
  await page.getByLabel("Índice de ajuste").fill("ICL");
  await page.getByLabel("Ajusta cada").fill("6");
  await page.getByRole("button", { name: "Guardar e invitar" }).click();
  // La invitación aparece en la misma pantalla: no hay cambio de URL que esperar.
  await page.getByRole("heading", { name: /Invitá a tu dueño/i }).waitFor({ timeout: 20_000 });
  await foto("09-alquiler-invitar-al-dueno");

  // Guardamos el link de invitación recién creado para la pantalla 6.
  const invitacion = await page.locator("input[readonly]").first().inputValue();

  // ------------------------------------------------- 5. detalle de alquileres
  await entrar(page, base, client, "martina@ejemplo.test");
  await foto("10-panel-con-datos");

  await page.goto(`${base}/alquileres/${datos.activo}`);
  await foto("11-alquiler-activo");

  /*
   * 7a. Reportar un pago (inquilina).
   *
   * El seed deja el mes en curso ya reportado, así que "Ya pagué" no aparece.
   * Sacamos ese pago de en medio, sacamos la foto y lo volvemos a poner tal
   * cual estaba: el resto del recorrido (y el link del mail) depende de su id.
   */
  const guardado = await client.query("select * from public.payments where id = $1", [
    datos.pagoPendiente,
  ]);
  await client.query("delete from public.payments where id = $1", [datos.pagoPendiente]);

  await page.goto(`${base}/alquileres/${datos.activo}`);
  await page.getByRole("button", { name: "Ya pagué" }).first().click();
  await foto("13-pago-reportar-inquilino");

  const fila = guardado.rows[0];
  // `on_time` la calcula Postgres: si se la mandamos, rechaza el insert.
  const columnas = Object.keys(fila).filter((columna) => columna !== "on_time");
  await client.query(
    `insert into public.payments (${columnas.map((c) => `"${c}"`).join(", ")})` +
      ` values (${columnas.map((_, i) => `$${i + 1}`).join(", ")})`,
    columnas.map((columna) => fila[columna]),
  );

  // ------------------------------------------------------------ 9. mi perfil
  await page.goto(`${base}/perfil`);
  await page.getByRole("button", { name: "Crear el link" }).click();
  await page.getByText(/Tu link está listo/).waitFor({ timeout: 15_000 });
  await foto("16-perfil-con-links");

  const linkPublico = await page.locator("input[readonly]").first().inputValue();

  // --------------------------------------------------------- 12. mi cuenta
  await page.goto(`${base}/cuenta`);
  await foto("18-cuenta");

  // --------------------------------- 11. fin de contrato (lo propone Martina)
  await page.goto(`${base}/alquileres/${datos.activo}`);
  // El botón abre la confirmación: esa es la pantalla que interesa mostrar.
  await page.getByRole("button", { name: "Terminó el contrato" }).click();
  await page.getByRole("button", { name: /Sí, terminó/ }).waitFor();
  await foto("17a-fin-de-contrato");

  // La reseña se deja en el alquiler ya terminado del seed.
  await page.goto(`${base}/alquileres/${datos.terminado}`);
  await foto("17b-resena");

  // ------------------------------------------- 5b y 7b. el lado del dueño
  await entrar(page, base, client, "jorge@ejemplo.test");
  await foto("12-panel-dueno");

  await page.goto(`${base}/pagos/${datos.pagoPendiente}`);
  await foto("14-pago-confirmar-dueno");

  await page.getByRole("button", { name: /Todavía no/ }).first().click();
  await page.waitForTimeout(600);
  await foto("15-pago-todavia-no-llego");

  await entrar(page, base, client, "paula@ejemplo.test");
  await page.goto(`${base}/alquileres/${datos.pendiente}`);
  await foto("11b-alquiler-pendiente");

  // ------------------------------------------- 6, 8 y 10. sin sesión
  await salir(page, base);

  await page.goto(`${base}/invitacion/${invitacion.split("/invitacion/")[1]}`);
  await foto("19-invitacion-sin-sesion");

  await page.goto(`${base}/pagos/confirmar/${datos.tokenDePago}`);
  await foto("20-confirmar-desde-el-mail");

  await page.goto(linkPublico.replace(/^https?:\/\/[^/]+/, base));
  await foto("21-perfil-publico");
}
