import { expect, test } from "@playwright/test";

/* El detalle solo con el secreto del cron o con sesión (ver la ruta). */
const CON_SECRETO = { headers: { authorization: "Bearer cron-de-prueba" } };

test.describe("diagnóstico", () => {
  test("sin permiso no cuenta nada de la instalación", async ({ request }) => {
    const cuerpo = await (await request.get("/api/salud")).json();

    expect(cuerpo).toHaveProperty("ok");
    // Ni los nombres de las tablas ni qué variable falta.
    expect(cuerpo).not.toHaveProperty("revisiones");
    expect(cuerpo).not.toHaveProperty("variables_faltantes");
    expect(JSON.stringify(cuerpo)).not.toContain("rentals");
  });

  test("/api/salud dice qué falta sin revelar ningún valor", async ({ request }) => {
    const respuesta = await request.get("/api/salud", CON_SECRETO);
    const cuerpo = await respuesta.json();

    expect(cuerpo).toHaveProperty("variables_faltantes");
    expect(cuerpo).toHaveProperty("revisiones");

    // En esta corrida las variables están puestas (con valores de prueba),
    // así que no tienen que figurar como faltantes...
    expect(cuerpo.variables_faltantes.imprescindibles).toEqual([]);
    // ...y sus valores nunca aparecen en la respuesta.
    const texto = JSON.stringify(cuerpo);
    expect(texto).not.toContain("service-de-prueba");
    expect(texto).not.toContain("sal-de-prueba");
    expect(texto).not.toContain("anon-de-prueba");
  });

  test("ninguna revisión se queda sin explicar", async ({ request }) => {
    const cuerpo = await (await request.get("/api/salud", CON_SECRETO)).json();
    const revisiones = Object.entries(cuerpo.revisiones) as Array<[string, string]>;

    expect(revisiones.length).toBeGreaterThan(0);
    for (const [nombre, valor] of revisiones) {
      // Un renglón vacío o un "error (?): " manda a buscar donde no está.
      expect(valor, `la revisión ${nombre} no dice nada`).not.toBe("");
      expect(valor, `la revisión ${nombre} no dice qué pasó`).not.toMatch(/^error \(\?\):\s*$/);
      if (valor.startsWith("error")) {
        expect(valor, `la revisión ${nombre} vino sin mensaje`).not.toMatch(/:\s*$/);
      }
    }
  });

  test("no se indexa", async ({ request }) => {
    const respuesta = await request.get("/api/salud");
    expect(respuesta.headers()["x-robots-tag"]).toContain("noindex");
  });
});
