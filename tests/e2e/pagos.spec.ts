import { expect, test } from "@playwright/test";

const PAGO = "/pagos/11111111-1111-4111-8111-111111111111";

test.describe("pagos", () => {
  test("el detalle de un pago pide sesión", async ({ page }) => {
    await page.goto(PAGO);
    await expect(page).toHaveURL(/\/ingresar\?volver_a=%2Fpagos%2F/);
  });

  test("el recibo en PDF no se sirve sin sesión", async ({ request }) => {
    const respuesta = await request.get(`${PAGO}/recibo`, { maxRedirects: 0 });
    expect(respuesta.status()).toBeGreaterThanOrEqual(300);
    expect(respuesta.headers()["content-type"] ?? "").not.toContain("application/pdf");
  });
});
