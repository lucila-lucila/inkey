import { describe, expect, it } from "vitest";
import { aCsv, celda, nombreDeArchivo } from "@/lib/exportar";
import { datosPersonalesSchema, nombreDeContraparte } from "@/lib/validation/profile";

const EXPORT = {
  exportado_el: "2026-09-21T12:00:00Z",
  perfil: { first_name: "Martina", last_name: "Rossi", phone: "+54 9 11 5555 1111" },
  alquileres: [
    { id: "1", barrio: "Palermo, CABA", estado: "active", monto_mensual: 450000 },
    { id: "2", barrio: "Almagro, CABA", estado: "ended", monto_mensual: 260000 },
  ],
  pagos: [{ periodo: "2026-08-01", estado: "confirmed", en_fecha: true }],
  "reseñas_que_escribí": [],
  "reseñas_que_recibí": [{ texto: "Siempre al día", etiquetas: ["siempre_al_dia"] }],
  links_compartidos: [],
};

describe("descargar mis datos", () => {
  it("arma una sección por tipo de dato", () => {
    const csv = aCsv(EXPORT);

    for (const titulo of [
      "PERFIL",
      "ALQUILERES",
      "PAGOS",
      "RESEÑAS QUE ESCRIBÍ",
      "RESEÑAS QUE RECIBÍ",
      "LINKS COMPARTIDOS",
    ]) {
      expect(csv, `falta la sección ${titulo}`).toContain(titulo);
    }
    expect(csv).toContain("Palermo, CABA");
    expect(csv).toContain("(sin datos)");
  });

  it("empieza con el BOM, o Excel rompe los acentos", () => {
    expect(aCsv(EXPORT).startsWith("﻿")).toBe(true);
  });

  it("escapa comas, comillas y saltos de línea", () => {
    expect(celda("Palermo, CABA")).toBe('"Palermo, CABA"');
    expect(celda('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(celda("dos\nlíneas")).toBe('"dos\nlíneas"');
    expect(celda(null)).toBe("");
    // Una lista se junta con un separador que no obliga a entrecomillar.
    expect(celda(["a", "b"])).toBe("a · b");
    expect(celda(["Palermo, CABA", "Almagro"])).toBe('"Palermo, CABA · Almagro"');
  });

  /*
   * Una celda que arranca con = la corre Excel como fórmula. El texto lo
   * escribe la otra parte del alquiler (una nota, una reseña): no puede
   * ejecutarse en la máquina de nadie al abrir el archivo.
   */
  it("no deja que una nota ajena se ejecute como fórmula en Excel", () => {
    for (const ataque of ["=1+1", "+34", "-2", "@SUM(A1)"]) {
      expect(celda(ataque).replace(/^"|"$/g, "").startsWith("'"), ataque).toBe(true);
    }
    expect(celda("=HYPERLINK(\"http://malo\")")).toContain("'=HYPERLINK");
  });

  it("el archivo lleva la fecha en el nombre", () => {
    expect(nombreDeArchivo("json", new Date("2026-09-21T10:00:00Z"))).toBe(
      "inkey-mis-datos-2026-09-21.json",
    );
    expect(nombreDeArchivo("csv", new Date("2026-09-21T10:00:00Z"))).toMatch(/\.csv$/);
  });
});

describe("editar mis datos", () => {
  const base = { first_name: "Martina", last_name: "Rossi", phone: "+54 9 11 5555 1111" };

  it("acepta los datos de siempre", () => {
    expect(datosPersonalesSchema.parse(base).first_name).toBe("Martina");
  });

  it("no deja borrar el nombre ni romper el celular", () => {
    expect(datosPersonalesSchema.safeParse({ ...base, first_name: "" }).success).toBe(false);
    expect(datosPersonalesSchema.safeParse({ ...base, phone: "no es un teléfono" }).success).toBe(
      false,
    );
  });
});

describe("quien se dio de baja", () => {
  it("tiene un nombre, porque el historial de la otra parte sigue existiendo", () => {
    expect(nombreDeContraparte({ first_name: null, last_name: null, deleted_at: "2026-09-01" })).toBe(
      "Usuario dado de baja",
    );
  });

  it("se sigue llamando como se llama mientras esté", () => {
    expect(nombreDeContraparte({ first_name: "Jorge", last_name: "Lema" })).toBe("Jorge L.");
  });

  it("cuando todavía no hay nadie, lo dice con el rol", () => {
    expect(nombreDeContraparte(null, "tu dueño")).toBe("tu dueño");
    expect(nombreDeContraparte({ first_name: null, last_name: null }, "tu inquilino")).toBe(
      "tu inquilino",
    );
  });
});
