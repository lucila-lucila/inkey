import { expect, test } from "@playwright/test";

test.describe("invitación", () => {
  test("un link con forma inválida se corta antes de tocar la base", async ({ page }) => {
    await page.goto("/invitacion/no-es-un-token");

    await expect(page.getByRole("heading", { name: /no parece válido/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a Inkey" })).toBeVisible();
  });

  test("la pantalla de invitación no se indexa", async ({ page }) => {
    await page.goto("/invitacion/no-es-un-token");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("alquileres", () => {
  test("registrar un alquiler pide sesión", async ({ page }) => {
    await page.goto("/alquileres/nuevo?rol=inquilino");
    // Vuelve exactamente a donde iba, con el rol elegido.
    await expect(page).toHaveURL(
      /\/ingresar\?volver_a=%2Falquileres%2Fnuevo%3Frol%3Dinquilino/,
    );
  });

  test("el detalle de un alquiler pide sesión", async ({ page }) => {
    await page.goto("/alquileres/11111111-1111-4111-8111-111111111111");
    await expect(page).toHaveURL(/\/ingresar/);
  });
});
