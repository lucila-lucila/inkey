import { expect, test } from "@playwright/test";

test.describe("perfil", () => {
  test("mi perfil pide sesión", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/ingresar\?volver_a=%2Fperfil/);
  });

  test("un link de perfil inválido no revela nada", async ({ page }) => {
    await page.goto("/p/no-es-un-token");

    await expect(page.getByRole("heading", { name: /ya no está disponible/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Conocer Inkey" })).toBeVisible();
  });

  test("el perfil público nunca se indexa", async ({ page }) => {
    await page.goto("/p/no-es-un-token");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("el PDF de un link inválido no se genera", async ({ request }) => {
    const respuesta = await request.get("/p/no-es-un-token/pdf");
    expect(respuesta.status()).toBe(404);
    expect(respuesta.headers()["content-type"] ?? "").not.toContain("application/pdf");
  });
});

test.describe("reseñas", () => {
  test("dejar una reseña pide sesión", async ({ page }) => {
    // El formulario vive en el alquiler: sin sesión, ni se llega.
    await page.goto("/alquileres/11111111-1111-4111-8111-111111111111");
    await expect(page).toHaveURL(/\/ingresar/);
  });
});
