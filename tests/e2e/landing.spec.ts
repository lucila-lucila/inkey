import { expect, test } from "@playwright/test";

test.describe("landing", () => {
  test("cuenta la propuesta y deja anotarse", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Pagaste puntual durante años/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tres pasos. Cero garantes nerviosos." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Las reglas de la casa" })).toBeVisible();

    // El perfil de ejemplo es lo que la persona va a querer tener.
    await expect(page.getByText("meses confirmados", { exact: true })).toBeVisible();
    await expect(page.getByText("Martina R.")).toBeVisible();
  });

  test("la landing es la única pantalla indexable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);

    await page.goto("/ingresar");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("se puede elegir el rol antes de anotarse", async ({ page }) => {
    await page.goto("/");

    const inquilino = page.getByRole("button", { name: "Soy inquilino/a" });
    const propietario = page.getByRole("button", { name: "Soy propietario/a" });

    await expect(inquilino).toHaveAttribute("aria-pressed", "true");
    await propietario.click();
    await expect(propietario).toHaveAttribute("aria-pressed", "true");
    await expect(inquilino).toHaveAttribute("aria-pressed", "false");
  });

  test("avisa cuando el mail está mal escrito", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Tu mail").fill("ana@");
    await page.getByRole("button", { name: "Quiero entrar primero" }).click();

    await expect(page.locator("#lista-error")).toContainText("nombre@mail.com");
  });
});

test.describe("identidad", () => {
  test("la página usa las fuentes y el fondo de la marca", async ({ page }) => {
    await page.goto("/");

    const estilos = await page.evaluate(() => {
      const cuerpo = getComputedStyle(document.body);
      const titulo = getComputedStyle(document.querySelector("h1")!);
      return {
        fuenteTexto: cuerpo.fontFamily,
        fuenteTitulo: titulo.fontFamily,
        fondo: cuerpo.backgroundColor,
      };
    });

    expect(estilos.fuenteTexto).toContain("DM Sans");
    expect(estilos.fuenteTitulo).toContain("Bricolage Grotesque");
    // #FFF6EA, el crema de la marca.
    expect(estilos.fondo).toBe("rgb(255, 246, 234)");
  });

  test("el logo está y se anuncia como Inkey", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Inkey, inicio" }).first()).toBeVisible();
  });
});
