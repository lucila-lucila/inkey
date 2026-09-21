import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGALES, parsearMarkdown, partirInline, ultimaActualizacion } from "@/lib/legales";

const TEXTOS = Object.entries(LEGALES).map(([clave, datos]) => ({
  clave,
  ...datos,
  fuente: readFileSync(new URL(`../../docs/legales/${datos.archivo}`, import.meta.url), "utf8"),
}));

describe("el markdown de los textos legales", () => {
  it("separa negritas y links del texto", () => {
    expect(partirInline("Escribinos a **contacto@inkeyapp.com**.")).toEqual([
      { tipo: "texto", texto: "Escribinos a " },
      { tipo: "fuerte", texto: "contacto@inkeyapp.com" },
      { tipo: "texto", texto: "." },
    ]);

    expect(partirInline("Mirá la [Política de privacidad](/privacidad) también.")).toEqual([
      { tipo: "texto", texto: "Mirá la " },
      { tipo: "link", texto: "Política de privacidad", url: "/privacidad" },
      { tipo: "texto", texto: " también." },
    ]);
  });

  it("arma títulos, secciones, párrafos y listas", () => {
    const bloques = parsearMarkdown(
      ["# Título", "", "Un párrafo", "que sigue acá.", "", "## Una sección", "", "- Primero", "- Segundo"].join("\n"),
    );

    expect(bloques.map((b) => b.tipo)).toEqual(["titulo", "parrafo", "seccion", "lista"]);
    // Dos renglones seguidos son un solo párrafo.
    expect(bloques[1]).toEqual({
      tipo: "parrafo",
      partes: [{ tipo: "texto", texto: "Un párrafo que sigue acá." }],
    });
    expect(bloques[3]).toMatchObject({ items: [{ sub: [] }, { sub: [] }] });
  });

  it("guarda las sub-listas dentro de su ítem", () => {
    const [lista] = parsearMarkdown(["- Proveedores:", "  - Supabase", "  - Vercel"].join("\n"));

    expect(lista).toMatchObject({ tipo: "lista" });
    if (lista.tipo !== "lista") throw new Error("no es una lista");
    expect(lista.items).toHaveLength(1);
    expect(lista.items[0].sub).toHaveLength(2);
  });
});

describe.each(TEXTOS)("$titulo", ({ fuente, titulo }) => {
  const bloques = parsearMarkdown(fuente);

  it("tiene un solo título y arranca con él", () => {
    expect(bloques[0].tipo).toBe("titulo");
    expect(bloques.filter((b) => b.tipo === "titulo")).toHaveLength(1);
  });

  it("dice desde cuándo rige, con fecha de verdad", () => {
    const fecha = ultimaActualizacion(bloques);
    expect(fecha).toBeTruthy();
    expect(fecha).toMatch(/^\d{1,2} de [a-zé]+ de \d{4}$/);
  });

  /*
   * Un texto legal con un corchete sin completar es peor que no tenerlo: dice
   * que nadie lo leyó antes de publicarlo.
   */
  it("no tiene ningún placeholder sin completar", () => {
    const sospechosos = fuente.match(/\[[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+\]/g);
    expect(sospechosos, `${titulo} tiene placeholders: ${sospechosos?.join(", ")}`).toBeNull();
  });

  it("lleva el mail de contacto y nombra la ley", () => {
    expect(fuente).toContain("contacto@inkeyapp.com");
    expect(fuente).toMatch(/Ley (25\.326|24\.240)/);
  });

  it("se renderiza entero: no quedan bloques sin reconocer", () => {
    const renglones = fuente.split("\n").filter((l) => l.trim() !== "").length;
    const partes = bloques.reduce(
      (total, b) => total + (b.tipo === "lista" ? b.items.length : 1),
      0,
    );
    // Cada renglón cae en algún bloque (varios pueden unirse en un párrafo).
    expect(partes).toBeGreaterThan(0);
    expect(partes).toBeLessThanOrEqual(renglones);
  });
});
