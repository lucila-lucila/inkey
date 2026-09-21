import { expect, test } from "@playwright/test";

/*
 * Los textos legales son las dos únicas pantallas indexables además de la
 * landing: tienen que poder leerse sin entrar y encontrarse buscando.
 */

const PAGINAS = [
  ["/terminos", "Términos y condiciones de Inkey"],
  ["/privacidad", "Política de privacidad de Inkey"],
] as const;

for (const [ruta, titulo] of PAGINAS) {
  test.describe(ruta, () => {
    test("se lee sin sesión y tiene su título", async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { name: titulo, level: 1 })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${ruta}$`));
    });

    test("es indexable", async ({ page }) => {
      await page.goto(ruta);
      const robots = page.locator('meta[name="robots"]');
      const cantidad = await robots.count();
      if (cantidad > 0) {
        await expect(robots).toHaveAttribute("content", /(?<!no)index/);
      }
    });

    test("dice desde cuándo rige", async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByText(/Última actualización/)).toBeVisible();
    });

    test("el contacto y el otro texto están a un toque", async ({ page }) => {
      await page.goto(ruta);
      // En el pie: dentro del texto los links aparecen con otro nombre.
      const pie = page.locator("footer");
      await expect(pie.getByRole("link", { name: "contacto@inkeyapp.com" })).toBeVisible();
      const otro = ruta === "/terminos" ? "Privacidad" : "Términos";
      await expect(pie.getByRole("link", { name: otro, exact: true })).toBeVisible();
    });

    test("se lee cómodo: una sola columna angosta", async ({ page }) => {
      await page.goto(ruta);
      const ancho = await page
        .locator("article p")
        .first()
        .evaluate((p) => p.getBoundingClientRect().width);

      expect(ancho).toBeLessThanOrEqual(700);
    });
  });
}

test.describe("el pie", () => {
  test("lleva el contacto y los legales en todas las pantallas", async ({ page }) => {
    for (const ruta of ["/", "/ingresar", `/p/${"a".repeat(43)}`, "/terminos"]) {
      await page.goto(ruta);
      const pie = page.locator("footer");

      await expect(pie.getByRole("link", { name: "contacto@inkeyapp.com" }), ruta).toBeVisible();
      await expect(pie.getByRole("link", { name: "Términos", exact: true }), ruta).toBeVisible();
      await expect(pie.getByRole("link", { name: "Privacidad", exact: true }), ruta).toBeVisible();
    }
  });

  test("el mail es un link que abre el correo", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("footer").getByRole("link", { name: "contacto@inkeyapp.com" }),
    ).toHaveAttribute("href", "mailto:contacto@inkeyapp.com");
  });

  test("ya no queda ningún placeholder a la vista", async ({ page }) => {
    for (const ruta of ["/", "/ingresar", "/terminos", "/privacidad"]) {
      await page.goto(ruta);
      const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      expect(texto, ruta).not.toMatch(/\[[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+\]/);
    }
  });
});

test.describe("el sitemap", () => {
  test("incluye los legales y nada privado", async ({ request }) => {
    const texto = await (await request.get("/sitemap.xml")).text();

    expect(texto).toContain("/terminos");
    expect(texto).toContain("/privacidad");
    expect(texto).not.toContain("/panel");
    expect((texto.match(/<url>/g) ?? []).length).toBe(3);
  });
});
