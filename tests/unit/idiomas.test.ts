import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { idiomaDelNavegador, partirRuta, prefijoDe, rutaEnIdioma } from "@/i18n/idioma";
import { esIdioma, IDIOMAS } from "@/i18n/routing";
import {
  estaActivo,
  haySeleccionDeIdioma,
  idiomaDeRespaldo,
  idiomasActivos,
} from "@/i18n/activos";

function claves(objeto: unknown, prefijo = ""): string[] {
  if (typeof objeto !== "object" || objeto === null) return [prefijo];
  return Object.entries(objeto).flatMap(([clave, valor]) =>
    claves(valor, prefijo ? `${prefijo}.${clave}` : clave),
  );
}

describe("archivos de mensajes", () => {
  it("dicen exactamente las mismas claves en los dos idiomas", () => {
    // Una clave suelta en un idioma es una pantalla rota en el otro.
    expect(claves(en).sort()).toEqual(claves(es).sort());
  });

  it("no deja ningún texto vacío", () => {
    for (const [idioma, mensajes] of [["es", es], ["en", en]] as const) {
      const vacias = claves(mensajes).filter((clave) => {
        const valor = clave.split(".").reduce<unknown>(
          (parcial, parte) => (parcial as Record<string, unknown>)?.[parte],
          mensajes,
        );
        return typeof valor !== "string" || valor.trim() === "";
      });
      expect(vacias, `textos vacíos en ${idioma}`).toEqual([]);
    }
  });
});

describe("el idioma del navegador", () => {
  it("entiende las variantes y respeta la calidad", () => {
    expect(idiomaDelNavegador("en-US,en;q=0.9")).toBe("en");
    expect(idiomaDelNavegador("es-AR,es;q=0.9,en;q=0.8")).toBe("es");
    // El de mayor peso gana aunque venga segundo.
    expect(idiomaDelNavegador("fr;q=0.5,en;q=0.9")).toBe("en");
  });

  it("no inventa un idioma que no tenemos", () => {
    expect(idiomaDelNavegador("fr-FR,fr;q=0.9")).toBeNull();
    expect(idiomaDelNavegador("")).toBeNull();
    expect(idiomaDelNavegador(null)).toBeNull();
  });
});

describe("las rutas por idioma", () => {
  it("el castellano no lleva prefijo, para no romper los links ya mandados", () => {
    expect(prefijoDe("es")).toBe("");
    expect(prefijoDe("en")).toBe("/en");
    expect(partirRuta("/p/abc")).toEqual({ idioma: "es", resto: "/p/abc" });
    expect(partirRuta("/en/p/abc")).toEqual({ idioma: "en", resto: "/p/abc" });
  });

  it("pasa la misma pantalla de un idioma al otro", () => {
    expect(rutaEnIdioma("/panel", "en")).toBe("/en/panel");
    expect(rutaEnIdioma("/en/panel", "es")).toBe("/panel");
    expect(rutaEnIdioma("/", "en")).toBe("/en");
    expect(rutaEnIdioma("/en", "es")).toBe("/");
  });

  it("solo reconoce los idiomas que existen", () => {
    expect(IDIOMAS.every(esIdioma)).toBe(true);
    expect(esIdioma("fr")).toBe(false);
    expect(esIdioma(undefined)).toBe(false);
  });
});

describe("prender y apagar idiomas", () => {
  it("lee la variable y respeta el orden del catálogo", () => {
    expect(idiomasActivos("es,en")).toEqual(["es", "en"]);
    // Aunque los escriban al revés o con espacios de más.
    expect(idiomasActivos(" en , es ")).toEqual(["es", "en"]);
    expect(idiomasActivos("EN")).toEqual(["en"]);
  });

  it("nunca se queda sin ningún idioma", () => {
    // Vacía, mal escrita o con idiomas que no existen: hablamos castellano.
    for (const valor of ["", "   ", "fr", "es-AR", "basura,otra", ",,,"]) {
      expect(idiomasActivos(valor), `con "${valor}"`).toEqual(["es"]);
    }
    expect(idiomasActivos(undefined)).toEqual(["es"]);
  });

  it("dice cuál está prendido", () => {
    expect(estaActivo("en", "es,en")).toBe(true);
    expect(estaActivo("en", "es")).toBe(false);
    expect(estaActivo("fr", "es,en")).toBe(false);
  });

  it("el respaldo es el castellano, salvo que lo apaguen", () => {
    expect(idiomaDeRespaldo("es,en")).toBe("es");
    expect(idiomaDeRespaldo("es")).toBe("es");
    // Si apagaron el castellano, cae en el que quede.
    expect(idiomaDeRespaldo("en")).toBe("en");
  });

  it("con un solo idioma no hay selector", () => {
    expect(haySeleccionDeIdioma("es")).toBe(false);
    expect(haySeleccionDeIdioma("en")).toBe(false);
    expect(haySeleccionDeIdioma("es,en")).toBe(true);
    expect(haySeleccionDeIdioma("")).toBe(false);
  });
});
