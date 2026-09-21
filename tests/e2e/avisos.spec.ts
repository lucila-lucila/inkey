import { expect, test } from "@playwright/test";

/*
 * El link que le llega al dueño por mail. Sin Supabase de verdad no hay token
 * vivo, así que lo que se prueba acá es lo que tiene que valer siempre: la
 * pantalla se abre sin sesión, un link que no sirve lo dice con todas las
 * letras y nada de esto se indexa.
 */

const TOKEN_INVENTADO = "a".repeat(43);

test.describe("confirmar un pago desde el mail", () => {
  test("se abre sin sesión y no manda a ingresar", async ({ page }) => {
    await page.goto(`/pagos/confirmar/${TOKEN_INVENTADO}`);

    await expect(page).toHaveURL(new RegExp(`/pagos/confirmar/${TOKEN_INVENTADO}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("un link que no sirve lo dice y ofrece entrar", async ({ page }) => {
    await page.goto(`/pagos/confirmar/${TOKEN_INVENTADO}`);

    await expect(page.getByRole("heading", { name: "Este link ya no sirve" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar a Inkey" })).toBeVisible();
  });

  test("no se indexa", async ({ page }) => {
    await page.goto(`/pagos/confirmar/${TOKEN_INVENTADO}`);
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });
});

test.describe("el cron de recordatorios", () => {
  test("sin la clave, no corre", async ({ request }) => {
    const sinNada = await request.get("/api/cron/recordatorios");
    expect(sinNada.status()).toBe(401);

    const conOtra = await request.get("/api/cron/recordatorios", {
      headers: { authorization: "Bearer no-es-esta" },
    });
    expect(conOtra.status()).toBe(401);

    // Y en ningún caso se filtra la clave verdadera.
    expect(await conOtra.text()).not.toContain("cron-de-prueba");
  });

  test("no se indexa", async ({ request }) => {
    const respuesta = await request.get("/api/cron/recordatorios", {
      headers: { authorization: "Bearer cron-de-prueba" },
    });
    expect(respuesta.headers()["x-robots-tag"]).toContain("noindex");
  });
});
