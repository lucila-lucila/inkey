import { readdirSync, readFileSync } from "node:fs";
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

  /*
   * Los huecos de cada texto. Una frase que en castellano dice {anio} y en
   * inglés {year} compila igual y explota recién cuando alguien abre esa
   * pantalla en inglés.
   */
  function huecos(texto: string): string[] {
    return [...texto.matchAll(/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/g)]
      .map((coincidencia) => coincidencia[1])
      .sort();
  }

  function valorDe(mensajes: unknown, clave: string): unknown {
    return clave
      .split(".")
      .reduce<unknown>((parcial, parte) => (parcial as Record<string, unknown>)?.[parte], mensajes);
  }

  it("usa los mismos huecos en los dos idiomas", () => {
    const distintas = claves(es).filter((clave) => {
      const enEs = valorDe(es, clave);
      const enEn = valorDe(en, clave);
      if (typeof enEs !== "string" || typeof enEn !== "string") return false;
      return huecos(enEs).join("|") !== huecos(enEn).join("|");
    });
    expect(distintas).toEqual([]);
  });

  it("no deja ningún texto vacío", () => {
    for (const [idioma, mensajes] of [["es", es], ["en", en]] as const) {
      const vacias = claves(mensajes).filter((clave) => {
        const valor = valorDe(mensajes, clave);
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

/*
 * Las fechas y los nombres de mes se arman con Intl, y sin idioma salen
 * siempre en castellano. Es el error más silencioso que tiene la traducción:
 * la pantalla se ve entera en inglés menos "12 de marzo de 2026", y nadie lo
 * nota hasta que lo ve alguien que no lee castellano.
 */
describe("las fechas siempre saben en qué idioma van", () => {
  const RAIZ = new URL("../../src/", import.meta.url);
  /* Acá viven las funciones: es el único lugar donde el idioma tiene default. */
  const DEFINICIONES = ["lib/domain/alquiler.ts", "lib/domain/pagos.ts"];

  function archivos(carpeta: URL, prefijo = ""): Array<{ nombre: string; codigo: string }> {
    return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
      const nombre = `${prefijo}${entrada.name}`;
      if (entrada.isDirectory()) {
        return archivos(new URL(`${entrada.name}/`, carpeta), `${nombre}/`);
      }
      if (!/\.tsx?$/.test(entrada.name)) return [];
      return [{ nombre, codigo: readFileSync(new URL(entrada.name, carpeta), "utf8") }];
    });
  }

  /** Los argumentos de una llamada, contando paréntesis para no cortar mal. */
  function argumentos(codigo: string, desde: number): number {
    let nivel = 0;
    let cantidad = 1;
    for (let i = desde; i < codigo.length; i += 1) {
      const caracter = codigo[i];
      if (caracter === "(" || caracter === "{" || caracter === "[") nivel += 1;
      else if (caracter === ")" || caracter === "}" || caracter === "]") {
        if (nivel === 0) return cantidad;
        nivel -= 1;
      } else if (caracter === "," && nivel === 0) cantidad += 1;
    }
    return cantidad;
  }

  it("ninguna pantalla ni PDF las formatea sin pasar el idioma", () => {
    const sinIdioma: string[] = [];

    for (const { nombre, codigo } of archivos(RAIZ)) {
      if (DEFINICIONES.includes(nombre)) continue;
      for (const funcion of ["formatearFecha", "nombrePeriodo"]) {
        for (const coincidencia of codigo.matchAll(new RegExp(`\\b${funcion}\\(`, "g"))) {
          const abre = coincidencia.index! + coincidencia[0].length;
          if (argumentos(codigo, abre) < 2) {
            const renglon = codigo.slice(0, abre).split("\n").length;
            sinIdioma.push(`${nombre}:${renglon} ${funcion}`);
          }
        }
      }
    }

    expect(sinIdioma).toEqual([]);
  });
});

/*
 * El servidor manda claves, no frases (ver src/i18n/texto.ts). Una frase
 * suelta acá se ve en castellano aunque la persona esté leyendo en inglés, y
 * no la agarra ningún test de pantalla porque solo aparece cuando algo falla.
 */
describe("los avisos del servidor son claves", () => {
  const RAIZ = new URL("../../src/", import.meta.url);

  function archivos(carpeta: URL, prefijo = ""): Array<{ nombre: string; codigo: string }> {
    return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
      const nombre = `${prefijo}${entrada.name}`;
      if (entrada.isDirectory()) {
        return archivos(new URL(`${entrada.name}/`, carpeta), `${nombre}/`);
      }
      if (!/\.tsx?$/.test(entrada.name)) return [];
      return [{ nombre, codigo: readFileSync(new URL(entrada.name, carpeta), "utf8") }];
    });
  }

  function existe(clave: string): boolean {
    return (
      clave.split(".").reduce<unknown>(
        (parcial, parte) => (parcial as Record<string, unknown>)?.[parte],
        es,
      ) !== undefined
    );
  }

  it("ninguna acción del servidor devuelve una frase escrita a mano", () => {
    const frases: string[] = [];

    for (const { nombre, codigo } of archivos(RAIZ)) {
      // Donde el servidor arma lo que la pantalla va a mostrar.
      if (!/actions\.ts$|^lib\/storage\.ts$|^lib\/domain\/mensajes\.ts$/.test(nombre)) continue;

      for (const coincidencia of codigo.matchAll(/\b(mensaje|error):\s*"([^"]+)"/g)) {
        const valor = coincidencia[2];
        if (existe(valor)) continue;
        const renglon = codigo.slice(0, coincidencia.index!).split("\n").length;
        frases.push(`${nombre}:${renglon} ${JSON.stringify(valor)}`);
      }
    }

    expect(frases).toEqual([]);
  });

  it("ningún esquema de validación devuelve una frase escrita a mano", () => {
    const frases: string[] = [];

    for (const { nombre, codigo } of archivos(RAIZ)) {
      if (!nombre.startsWith("lib/validation/")) continue;

      /*
       * Zod recibe el mensaje suelto, sin nombre de campo: acá cualquier
       * texto con un espacio es una frase, y las claves no llevan ninguno.
       */
      for (const coincidencia of codigo.matchAll(/"([^"]* [^"]*)"/g)) {
        const valor = coincidencia[1];
        if (existe(valor)) continue;
        const renglon = codigo.slice(0, coincidencia.index!).split("\n").length;
        frases.push(`${nombre}:${renglon} ${JSON.stringify(valor)}`);
      }
    }

    expect(frases).toEqual([]);
  });
});
