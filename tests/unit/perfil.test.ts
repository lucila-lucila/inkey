import { describe, expect, it } from "vitest";
import {
  cifraPrincipal,
  nivelesDeVerificacion,
  nombreVisible,
  resumenDeMetricas,
  resumenParaCompartir,
  type Metricas,
} from "@/lib/domain/perfil";
import { tokenDeLink, pareceToken, hashearToken } from "@/lib/tokens";
import { traductor } from "./apoyo/traductor";

/*
 * Estas funciones devuelven claves, no frases: el texto lo arma el archivo de
 * idiomas. Los tests lo atraviesan de punta a punta —clave más archivo— y de
 * paso verifican los plurales de cada idioma, que es donde se cometen los
 * errores que nadie ve hasta que alguien tiene un solo alquiler.
 */
const escribir = (idioma: "es" | "en", cifra: { clave: string; numero: number }) =>
  traductor(idioma)(cifra.clave, { numero: cifra.numero });

const resumir = (idioma: "es" | "en", metricas: Metricas, esInquilino: boolean) =>
  resumenDeMetricas(metricas, esInquilino)
    .map((parte) => traductor(idioma)(parte.clave, { cantidad: parte.cantidad }))
    .join(" · ");

const detalle = (idioma: "es" | "en", nivel: { clave: string; cantidad: number }) =>
  traductor(idioma)(`dominio.nivel.${nivel.clave}.detalle`, { cantidad: nivel.cantidad });

const METRICAS: Metricas = {
  meses_confirmados: 12,
  pagos_en_fecha: 11,
  porcentaje_en_fecha: 92,
  contratos_cumplidos: 1,
  contratos_totales: 2,
  con_comprobante: 9,
  con_contrato: 1,
  desde: "2025-01-01",
  barrios: ["Palermo, CABA"],
  ultimos_12: [],
};

const VACIAS: Metricas = {
  ...METRICAS,
  meses_confirmados: 0,
  pagos_en_fecha: 0,
  porcentaje_en_fecha: null,
  contratos_cumplidos: 0,
  contratos_totales: 0,
  con_comprobante: 0,
  con_contrato: 0,
  barrios: [],
};

describe("nombre público", () => {
  it("muestra el nombre y la inicial, nunca el apellido", () => {
    expect(nombreVisible("Martina", "R")).toBe("Martina R.");
    expect(nombreVisible("Martina", "")).toBe("Martina");
  });
});

describe("la cifra grande del historial", () => {
  it("al inquilino le cuenta los meses; al dueño, los alquileres", () => {
    expect(cifraPrincipal(METRICAS, true)).toEqual({
      numero: 12,
      clave: "dominio.cifra.inquilino",
    });
    expect(cifraPrincipal(METRICAS, false)).toEqual({
      numero: 2,
      clave: "dominio.cifra.propietario",
    });
  });

  it("no dice «1 alquileres» ni «1 leases»", () => {
    // El plural lo resuelve el archivo de textos, en cada idioma.
    expect(escribir("es", cifraPrincipal({ ...METRICAS, contratos_totales: 1 }, false))).toBe(
      "alquiler en Inkey",
    );
    expect(escribir("en", cifraPrincipal({ ...METRICAS, contratos_totales: 1 }, false))).toBe(
      "lease on Inkey",
    );
  });

  it("el resumen deja afuera la puntualidad cuando todavía no hay pagos", () => {
    expect(resumir("es", METRICAS, true)).toBe("92% en fecha · 1 contrato cumplido");
    expect(resumir("en", METRICAS, true)).toBe("92% on time · 1 lease completed");
    // Sin pagos confirmados no hay porcentaje: no inventamos un 0%.
    expect(resumir("es", VACIAS, true)).toBe("0 contratos cumplidos");
  });

  it("del lado del dueño cuenta los pagos que confirmó", () => {
    expect(resumir("es", METRICAS, false)).toBe("12 pagos confirmados · 1 contrato cumplido");
    expect(resumir("en", METRICAS, false)).toBe("12 payments confirmed · 1 lease completed");
  });
});

describe("niveles de verificación", () => {
  it("son afirmaciones de lo que sí pasó", () => {
    const niveles = nivelesDeVerificacion(METRICAS);
    expect(niveles).toHaveLength(3);
    expect(niveles.every((nivel) => nivel.logrado)).toBe(true);
    expect(detalle("es", niveles[0])).toContain("12 meses confirmados");
    expect(detalle("en", niveles[0])).toContain("12 months confirmed");
  });

  it("cuando no hay nada, no acusan a nadie", () => {
    const niveles = nivelesDeVerificacion(VACIAS);
    expect(niveles.every((nivel) => !nivel.logrado)).toBe(true);
    const texto = niveles.map((nivel) => detalle("es", nivel)).join(" ").toLowerCase();
    // Nada de deuda, atraso, incumplimiento ni alarma.
    for (const palabra of ["deuda", "atraso", "moroso", "incumpl", "falta de pago"]) {
      expect(texto).not.toContain(palabra);
    }
  });

  it("habla en singular cuando corresponde", () => {
    const niveles = nivelesDeVerificacion({ ...VACIAS, meses_confirmados: 1, con_comprobante: 1 });
    expect(detalle("es", niveles[0])).toContain("1 mes confirmado");
    expect(detalle("es", niveles[1])).toContain("1 pago con comprobante");
    expect(detalle("en", niveles[0])).toContain("1 month confirmed");
  });
});

describe("resumen para compartir", () => {
  it("resume el historial del inquilino", () => {
    expect(resumenParaCompartir(traductor("es"), METRICAS, "tenant")).toBe(
      "12 meses confirmados · 92% en fecha",
    );
    expect(resumenParaCompartir(traductor("en"), METRICAS, "tenant")).toBe(
      "12 months confirmed · 92% on time",
    );
  });

  it("no promete nada si todavía no hay meses", () => {
    expect(resumenParaCompartir(traductor("es"), VACIAS, "tenant")).toBe(
      "Historial de alquiler en Inkey",
    );
  });

  it("para el dueño habla de alquileres", () => {
    expect(resumenParaCompartir(traductor("es"), METRICAS, "owner")).toBe("2 alquileres en Inkey");
    expect(resumenParaCompartir(traductor("es"), { ...VACIAS, contratos_totales: 1 }, "owner")).toBe(
      "1 alquiler en Inkey",
    );
  });
});

describe("token del link de perfil", () => {
  it("se deriva del id: el mismo link da siempre el mismo token", () => {
    process.env.SHARE_LINK_SECRET = "una-clave-de-prueba";
    const id = "11111111-1111-4111-8111-111111111111";

    const token = tokenDeLink(id);
    expect(token).not.toBeNull();
    expect(tokenDeLink(id)).toBe(token);
    expect(pareceToken(token!)).toBe(true);
  });

  it("dos links distintos dan tokens distintos", () => {
    process.env.SHARE_LINK_SECRET = "una-clave-de-prueba";
    expect(tokenDeLink("11111111-1111-4111-8111-111111111111")).not.toBe(
      tokenDeLink("22222222-2222-4222-8222-222222222222"),
    );
  });

  it("cambiar la clave invalida los links viejos", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    process.env.SHARE_LINK_SECRET = "clave-uno";
    const conUna = tokenDeLink(id);
    process.env.SHARE_LINK_SECRET = "clave-dos";
    expect(tokenDeLink(id)).not.toBe(conUna);
  });

  it("sin clave no inventa un token inseguro", () => {
    process.env.SHARE_LINK_SECRET = "";
    expect(tokenDeLink("11111111-1111-4111-8111-111111111111")).toBeNull();
  });

  it("de la base solo sale el hash, nunca el token", () => {
    process.env.SHARE_LINK_SECRET = "una-clave-de-prueba";
    const token = tokenDeLink("11111111-1111-4111-8111-111111111111")!;
    const hash = hashearToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token.slice(0, 12));
  });
});
