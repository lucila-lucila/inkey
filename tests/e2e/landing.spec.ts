import { expect, test } from "@playwright/test";

test.describe("landing", () => {
  test("cuenta la propuesta y deja entrar", async ({ page }) => {
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

  /*
   * Sin contraseñas, registrarse e ingresar son el mismo flujo: los dos
   * caminos llevan a /ingresar y lo único que cambia es qué espera la persona.
   */
  test("los dos caminos llevan a ingresar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Empezá gratis" }).first()).toHaveAttribute(
      "href",
      /^\/ingresar/,
    );
    await expect(
      page.getByRole("link", { name: "Ya tengo cuenta · Ingresar" }),
    ).toHaveAttribute("href", "/ingresar");

    await page.getByRole("link", { name: "Empezá gratis" }).first().click();
    await expect(page).toHaveURL(/\/ingresar/);
    await expect(page.getByRole("heading", { name: "Entrá a Inkey" })).toBeVisible();
  });

  test("el rol elegido viaja hasta el ingreso", async ({ page }) => {
    await page.goto("/");

    const inquilino = page.getByRole("button", { name: "Soy inquilino/a" });
    const propietario = page.getByRole("button", { name: "Soy propietario/a" });

    await expect(inquilino).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Empezá gratis" }).first()).toHaveAttribute(
      "href",
      "/ingresar?intencion=inquilino",
    );

    await propietario.click();
    await expect(propietario).toHaveAttribute("aria-pressed", "true");
    await expect(inquilino).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("link", { name: "Empezá gratis" }).first()).toHaveAttribute(
      "href",
      "/ingresar?intencion=propietario",
    );
  });

  test("el header y el cierre invitan a entrar, no a esperar", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("header").getByRole("link", { name: "Ingresar" })).toHaveAttribute(
      "href",
      "/ingresar",
    );

    const texto = await page.locator("body").innerText();
    for (const viejo of ["Sumarme a la lista", "lista de espera", "cuando abramos"]) {
      expect(texto, `quedó texto de lista de espera: ${viejo}`).not.toContain(viejo);
    }
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

  test("el pie lleva el símbolo a la izquierda, de una sola tinta", async ({ page }) => {
    await page.goto("/");

    const medida = await page.evaluate(() => {
      const enlace = document.querySelector("footer a[aria-label='Inkey, inicio']")!;
      const palabra = enlace.querySelector("span")!;
      const simbolo = enlace.querySelector("svg")!;
      const cajaSimbolo = simbolo.getBoundingClientRect();
      const cajaPalabra = palabra.getBoundingClientRect();

      return {
        aLaIzquierda: cajaSimbolo.right <= cajaPalabra.left + 1,
        // Una sola tinta: los dos aros del mismo color, recortados en el cruce.
        colores: new Set(
          [...simbolo.querySelectorAll("circle")].map((c) => getComputedStyle(c).stroke),
        ).size,
        recortes: simbolo.querySelectorAll("clipPath").length,
      };
    });

    expect(medida.aLaIzquierda).toBe(true);
    expect(medida.colores, "el pie va de una sola tinta").toBe(1);
    expect(medida.recortes, "faltan los recortes que separan los aros").toBe(2);
  });

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
          // El radio del aro, a la escala a la que se está dibujando.
          medioRadio: (15 * cajaSimbolo.width) / 93 / 2,
        };
      });

      // El símbolo va después de la palabra, nunca antes.
      expect(medida.aLaDerecha).toBe(true);
      // Es un remate: dos quintos de la altura de las mayúsculas.
      expect(medida.proporcion).toBeGreaterThan(0.36);
      expect(medida.proporcion).toBeLessThan(0.44);
      // Medio radio de separación, como un punto final.
      expect(medida.separacion).toBeGreaterThan(medida.medioRadio - 0.5);
      expect(medida.separacion).toBeLessThan(medida.medioRadio + 0.5);
      // Y apoyado en la línea de base del texto, no centrado.
      expect(medida.distanciaALaBase).toBeLessThan(3);
    });
  }
});
