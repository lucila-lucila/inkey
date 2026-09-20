import { expect, test } from "@playwright/test";

test.describe("ingreso", () => {
  test("ofrece entrar por mail o con Google, sin contraseñas", async ({ page }) => {
    await page.goto("/ingresar");

    await expect(page.getByRole("heading", { name: "Entrá a Inkey" })).toBeVisible();
    await expect(page.getByLabel("Tu mail")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviarme el link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("el panel pide sesión", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/ingresar\?volver_a=%2Fpanel/);
  });

  test("los botones son cómodos en el celular", async ({ page }) => {
    await page.goto("/ingresar");
    const boton = page.getByRole("button", { name: "Enviarme el link" });
    const caja = await boton.boundingBox();
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
