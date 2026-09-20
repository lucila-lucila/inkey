import { expect, test } from "@playwright/test";

test.describe("diagnóstico", () => {
  test("/api/salud dice qué falta sin revelar ningún valor", async ({ request }) => {
    const respuesta = await request.get("/api/salud");
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

  test("no se indexa", async ({ request }) => {
    const respuesta = await request.get("/api/salud");
    expect(respuesta.headers()["x-robots-tag"]).toContain("noindex");
  });
});
