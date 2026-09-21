import { expect, test } from "@playwright/test";

/*
 * La cuenta es lo más sensible que hay: los datos personales, el export
 * completo y la baja. Nada de eso puede estar a la vista de nadie sin sesión.
 */

test.describe("mi cuenta", () => {
  test("pide sesión", async ({ page }) => {
    await page.goto("/cuenta");
    await expect(page).toHaveURL(/\/ingresar\?volver_a=%2Fcuenta/);
  });

  test("el export de datos no se sirve sin sesión", async ({ request }) => {
    for (const formato of ["json", "csv"]) {
      const respuesta = await request.get(`/cuenta/exportar?formato=${formato}`, {
        maxRedirects: 0,
      });

      expect(respuesta.status(), formato).toBeGreaterThanOrEqual(300);
      const tipo = respuesta.headers()["content-type"] ?? "";
      expect(tipo, formato).not.toContain("application/json");
      expect(tipo, formato).not.toContain("text/csv");
    }
  });

  test("no se indexa", async ({ page }) => {
    // Aunque redirija a /ingresar, esa pantalla tampoco se indexa.
    await page.goto("/cuenta");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("robots.txt cierra la cuenta y su export", async ({ request }) => {
    const texto = await (await request.get("/robots.txt")).text();
    expect(texto).toContain("Disallow: /cuenta");
  });
});

test.describe("cabeceras de seguridad", () => {
  test("la landing las manda todas", async ({ request }) => {
    const cabeceras = (await request.get("/")).headers();

    expect(cabeceras["x-content-type-options"]).toBe("nosniff");
    expect(cabeceras["x-frame-options"]).toBe("DENY");
    expect(cabeceras["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(cabeceras["strict-transport-security"]).toContain("max-age=");
    expect(cabeceras["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(cabeceras["content-security-policy"]).toContain("object-src 'none'");
  });

  /*
   * Las pantallas con un token en la URL son las que más necesitan que el
   * navegador no cuente a dónde fue la persona.
   */
  test("las pantallas con token no filtran la dirección completa", async ({ request }) => {
    for (const ruta of [`/p/${"a".repeat(43)}`, `/pagos/confirmar/${"a".repeat(43)}`]) {
      const cabeceras = (await request.get(ruta)).headers();
      expect(cabeceras["referrer-policy"], ruta).toBe("strict-origin-when-cross-origin");
    }
  });
});
