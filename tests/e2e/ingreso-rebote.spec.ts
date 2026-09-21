import { expect, test } from "@playwright/test";

/*
 * Un magic link vencido no vuelve a la app: rebota al Site URL con el error
 * pegado en la URL. Caiga donde caiga, la persona tiene que terminar en
 * /ingresar entendiendo qué pasó.
 */

const MENSAJE = "El link venció o ya se usó. Pedí uno nuevo.";

/** El aviso de la pantalla, no el anunciador de rutas de Next. */
const aviso = (page: import("@playwright/test").Page) => page.locator('p[role="alert"]');

test.describe("link de ingreso vencido", () => {
  test("desde la landing, con el error en la query", async ({ page }) => {
    await page.goto(
      "/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    await expect(page).toHaveURL(/\/ingresar\?error=otp_expired/);
    await expect(aviso(page)).toHaveText(MENSAJE);
  });

  test("desde la landing, con el error en el fragmento", async ({ page }) => {
    // El fragmento no viaja al servidor: lo tiene que atajar el navegador.
    await page.goto("/#error=access_denied&error_code=otp_expired&error_description=expired");

    await expect(page).toHaveURL(/\/ingresar\?error=otp_expired/);
    await expect(aviso(page)).toHaveText(MENSAJE);
  });

  test("un error de la app no se confunde con un link vencido", async ({ page }) => {
    await page.goto("/ingresar?error=google");
    await expect(aviso(page)).toContainText("No se pudo abrir Google");
  });

  test("el mensaje lo ponemos nosotros, no la URL", async ({ page }) => {
    await page.goto("/?error_code=%3Cscript%3Ealert(1)%3C%2Fscript%3E");

    await expect(page).toHaveURL(/\/ingresar\?error=link/);
    await expect(aviso(page)).toContainText("Ese link ya no sirve");
  });
});

test.describe("el dominio", () => {
  test("robots.txt permite la landing y cierra lo privado", async ({ request }) => {
    const respuesta = await request.get("/robots.txt");
    const texto = await respuesta.text();

    expect(texto).toContain("Allow: /");
    for (const ruta of ["/panel", "/p/", "/invitacion/", "/api/"]) {
      expect(texto).toContain(`Disallow: ${ruta}`);
    }
    expect(texto).toContain("Sitemap:");
  });

  test("el sitemap tiene solo lo público", async ({ request }) => {
    const texto = await (await request.get("/sitemap.xml")).text();
    // La landing y los dos textos legales: nada que pida sesión.
    expect((texto.match(/<url>/g) ?? []).length).toBe(3);
    expect(texto).not.toContain("/panel");
    expect(texto).not.toContain("/cuenta");
  });
});

test.describe("el rol elegido en la landing", () => {
  test("llega al ingreso y sigue viaje", async ({ page }) => {
    await page.goto("/ingresar?intencion=propietario");

    // Va en un campo oculto: sobrevive al mail y llega al onboarding.
    await expect(page.locator('input[name="intencion"]').first()).toHaveValue("propietario");
  });

  test("una intención inventada se ignora", async ({ page }) => {
    await page.goto("/ingresar?intencion=administrador");

    await expect(page.locator('input[name="intencion"]')).toHaveCount(0);
    // Y la pantalla funciona igual.
    await expect(page.getByRole("heading", { name: "Entrá a Inkey" })).toBeVisible();
  });
});
