import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * La identidad tiene una regla dura: todo el texto llega a 4,5:1 (3:1 de 24px
 * para arriba), en los dos modos. Estos tests leen los tokens reales, así que
 * si alguien toca un color y rompe el contraste, se entera acá.
 */

const CSS = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

function tokensDelBloque(desde: string): Record<string, string> {
  const inicio = CSS.indexOf(desde);
  const bloque = CSS.slice(inicio, CSS.indexOf("}", inicio));
  const tokens: Record<string, string> = {};
  for (const [, nombre, valor] of bloque.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)) {
    tokens[nombre] = valor;
  }
  return tokens;
}

const claro = tokensDelBloque(":root {");
// El bloque oscuro solo redefine algunos tokens: el resto se hereda, igual
// que en la cascada real.
const oscuro = { ...claro, ...tokensDelBloque(':root[data-theme="dark"] {') };

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [mayor, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (mayor + 0.05) / (menor + 0.05);
}

/** [texto, fondo, mínimo] */
const PARES: Array<[string, string, number]> = [
  ["ink", "bg", 4.5],
  ["ink", "surface", 4.5],
  ["ink", "surface-sunk", 4.5],
  ["body", "bg", 4.5],
  ["body", "surface", 4.5],
  ["body", "surface-sunk", 4.5],
  ["muted", "bg", 4.5],
  ["muted", "surface", 4.5],
  ["primary-ink", "primary-soft", 4.5],
  ["primary-ink", "surface", 4.5],
  ["confirm-ink", "confirm-soft", 4.5],
  ["confirm-ink", "surface", 4.5],
  ["on-primary", "primary", 4.5],
  ["on-confirm", "confirm", 4.5],
  ["on-sun", "sun", 4.5],
  ["invertido-ink", "invertido-bg", 4.5],
];

describe.each([
  ["modo claro", claro],
  ["modo oscuro", oscuro],
])("contraste en %s", (_nombre, tokens) => {
  it("leyó los tokens del archivo", () => {
    expect(Object.keys(tokens).length).toBeGreaterThan(10);
  });

  it.each(PARES)("%s sobre %s llega a AA", (texto, fondo, minimo) => {
    const ratio = contraste(tokens[texto], tokens[fondo]);
    expect(ratio, `${texto} sobre ${fondo} da ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimo);
  });
});

describe("reglas de la identidad", () => {
  it("el amarillo nunca lleva texto claro encima", () => {
    // on-sun es tinta oscura en los dos modos, a propósito.
    for (const tokens of [claro, oscuro]) {
      expect(luminancia(tokens["on-sun"])).toBeLessThan(0.2);
    }
  });

  it("el verde de confirmación existe en los dos modos y no es el color de marca", () => {
    for (const tokens of [claro, oscuro]) {
      expect(tokens["confirm"]).toBeDefined();
      expect(tokens["confirm"]).not.toBe(tokens["primary"]);
    }
  });

  it("no quedó ningún token de la identidad vieja", () => {
    expect(CSS).not.toContain("--green");
    expect(CSS).not.toContain("--terra");
    expect(CSS).not.toContain("Fraunces");
    expect(CSS).not.toContain("Instrument Sans");
  });
});
