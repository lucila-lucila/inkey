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

  // Todos los headers del producto llevan el mismo lockup: nombre primero y
  // símbolo después. Si alguna pantalla nueva queda al revés, esto falla.
  const PANTALLAS_CON_HEADER = [
    ["landing", "/"],
    ["ingreso", "/ingresar"],
    ["invitación", "/invitacion/no-es-un-token"],
    ["perfil público", "/p/no-es-un-token"],
    ["confirmar un pago desde el mail", `/pagos/confirmar/${"a".repeat(43)}`],
  ] as const;

  for (const [nombre, ruta] of PANTALLAS_CON_HEADER) {
    test(`el header de ${nombre} lleva el nombre primero y el símbolo de remate`, async ({
      page,
    }) => {
      await page.goto(ruta);

      const medida = await page.evaluate(() => {
        // En el celular y en escritorio se muestran lockups distintos: medimos
        // el que está visible.
        const enlace = [...document.querySelectorAll("header a[aria-label='Inkey, inicio']")].find(
          (candidato) => (candidato as HTMLElement).offsetParent !== null,
        )!;
        const palabra = enlace.querySelector("span")!;
        const simbolo = enlace.querySelector("svg")!;
        const estilos = getComputedStyle(palabra);

        // Medidas reales de la fuente cargada.
        const lienzo = document.createElement("canvas").getContext("2d")!;
        lienzo.font = `${estilos.fontWeight} ${estilos.fontSize} ${estilos.fontFamily}`;
        const medidas = lienzo.measureText("Hinkey");
        const mayuscula = medidas.actualBoundingBoxAscent;

        const cajaSimbolo = simbolo.getBoundingClientRect();
        const cajaPalabra = palabra.getBoundingClientRect();

        // La línea de base dentro de la caja del texto: la caja incluye el
        // espacio del descendente, así que hay que calcularla.
        const alto = medidas.fontBoundingBoxAscent + medidas.fontBoundingBoxDescent;
        const lineaDeBase =
          cajaPalabra.top +
          (cajaPalabra.height - alto) / 2 +
          medidas.fontBoundingBoxAscent;

        return {
          proporcion: cajaSimbolo.height / mayuscula,
          separacion: cajaSimbolo.left - cajaPalabra.right,
          aLaDerecha: cajaSimbolo.left >= cajaPalabra.right,
          distanciaALaBase: Math.abs(cajaSimbolo.bottom - lineaDeBase),
        };
      });

      // El símbolo va después de la palabra, nunca antes.
      expect(medida.aLaDerecha).toBe(true);
      // Es un remate: alrededor de dos quintos de la altura de las mayúsculas.
      expect(medida.proporcion).toBeGreaterThan(0.33);
      expect(medida.proporcion).toBeLessThan(0.48);
      // Ajustado, como un punto final.
      expect(medida.separacion).toBeLessThan(6);
      // Y apoyado en la línea de base del texto, no centrado.
      expect(medida.distanciaALaBase).toBeLessThan(3);
    });
  }
});
