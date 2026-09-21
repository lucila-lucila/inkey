import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { invitacion } from "@/lib/email/plantillas";

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

/*
 * El símbolo en el componente y el archivo de marca tienen que ser el mismo
 * dibujo. El archivo es lo que se manda por mail y lo que se comparte; el
 * componente, lo que se ve en pantalla. Si se separan, la marca se parte en
 * dos sin que nadie se entere.
 */
const SVG_MARCA = readFileSync(
  new URL("../../public/brand/inkey-simbolo.svg", import.meta.url),
  "utf8",
);
const SVG_UNA_TINTA = readFileSync(
  new URL("../../public/brand/inkey-simbolo-una-tinta.svg", import.meta.url),
  "utf8",
);
const LOGO = readFileSync(new URL("../../src/components/ui/logo.tsx", import.meta.url), "utf8");
const ICONO = readFileSync(new URL("../../src/app/icon.svg", import.meta.url), "utf8");

function atributo(nombre: string, texto = SVG_MARCA): string[] {
  return [...texto.matchAll(new RegExp(`${nombre}="([^"]+)"`, "g"))].map((m) => m[1]);
}

describe("el símbolo: componente y archivo de marca", () => {
  it("es una sola forma, la de siempre sin dientes", () => {
    const paths = atributo("d");
    // Dos paletas y el arco del cruce: nada más.
    expect(paths).toEqual([
      "M37 26H18",
      "M83 26h19",
      "M49.40 11.23A15 15 0 0 1 66.10 20.87",
    ]);
    expect(LOGO).toContain('const PALETA_IZQUIERDA = "M37 26H18"');
    expect(LOGO).toContain('const PALETA_DERECHA = "M83 26h19"');
    expect(LOGO).toContain(`const ARCO_DE_ADELANTE = "${paths[2]}"`);
  });

  it("ya no quedan versiones por tamaño", () => {
    // Como código, no como palabra: el componente habla de "medio radio".
    for (const viejo of [
      'version="',
      "DIENTES",
      "versionPara",
      "CAJA_AJUSTADA",
      "ajustado",
      'completo:',
      'medio:',
      'minimo:',
    ]) {
      expect(LOGO, `quedó rastro de "${viejo}"`).not.toContain(viejo);
    }
  });

  it("comparten la caja y el grosor del trazo", () => {
    const [viewBox] = atributo("viewBox");
    expect(viewBox).toBe("13.5 6.5 93 39");
    expect(LOGO).toContain(`viewBox: "${viewBox}"`);

    const [, , ancho, alto] = viewBox.split(" ");
    expect(LOGO).toContain(`ancho: ${ancho}, alto: ${alto}`);

    expect(atributo("stroke-width")).toEqual(["8"]);
    expect(LOGO).toContain("const TRAZO = 8;");
  });

  it("usa los mismos colores que los tokens en modo claro", () => {
    const colores = atributo("stroke").map((c) => c.toLowerCase());
    // Primera llave terracota, segunda verde, y el arco del cruce terracota.
    expect(colores).toEqual([claro.primary, claro.confirm, claro.primary]);
  });

  /*
   * En pantalla los colores salen de los tokens, así que el modo oscuro los
   * aclara solo. Es la razón por la que el componente no los escribe fijos.
   */
  it("en pantalla toma los colores del token, no del archivo", () => {
    expect(LOGO).toContain("var(--primary)");
    expect(LOGO).toContain("var(--confirm)");
    expect(LOGO).not.toContain(claro.primary.toUpperCase());
    expect(oscuro.primary).toBe("#e59b78");
    expect(oscuro.confirm).toBe("#7fc3a6");
  });

  it("la versión de una tinta recorta el aro de atrás en los dos cruces", () => {
    const recortes = atributo("d", SVG_UNA_TINTA).filter((d) => d.startsWith("M-20 -20"));
    expect(recortes).toHaveLength(2);
    expect(LOGO).toContain(`const CLIP_IZQUIERDA =
  "${recortes[0]}"`);
    expect(LOGO).toContain(`const CLIP_DERECHA =
  "${recortes[1]}"`);
  });

  it("los ids del recorte no pueden chocar entre dos logos de la misma página", () => {
    // El archivo trae ids fijos; en el componente los pone quien lo usa, y el
    // tipo lo exige: no hay forma de pedir una tinta sin dar un id.
    expect(SVG_UNA_TINTA).toContain('id="cA1"');
    expect(LOGO).toContain("export type UnaTinta = { color: string; id: string }");
    expect(LOGO).toContain("`${id}-a`");
    expect(LOGO).toContain("`${id}-b`");
  });

  it("el ícono de la app usa los tonos oscuros sobre el fondo ink", () => {
    const colores = atributo("stroke", ICONO).map((c) => c.toLowerCase());
    expect(new Set(colores)).toEqual(new Set([oscuro.primary, oscuro.confirm]));
    expect(atributo("fill", ICONO)).toContain(claro.ink.toUpperCase());
    // Esquinas redondeadas de la marca.
    expect(ICONO).toContain('rx="26"');
    // Y es la forma única: sin dientes.
    expect(ICONO).not.toContain("v-7");
    expect(ICONO).not.toContain("M37 26H14");
  });
});

/*
 * En un encabezado, el nombre va primero y el símbolo después, como punto
 * final. Vale para el sitio, para la app y también para los mails: el de los
 * mails se nos había quedado al revés.
 *
 * El del pie sigue siendo el otro (símbolo a la izquierda), y por eso el test
 * mira solo el encabezado.
 */
const PLANTILLAS_SUPABASE = readdirSync(new URL("../../supabase/templates/", import.meta.url))
  .filter((nombre) => nombre.endsWith(".html"));

function encabezadoDe(html: string): string {
  const desde = html.indexOf('<tr><td style="padding:8px 4px 20px;">');
  expect(desde, "no encontré el encabezado").toBeGreaterThan(-1);
  return html.slice(desde, html.indexOf("</td></tr>", desde));
}

describe("el encabezado de los mails", () => {
  const mailDeLaApp = invitacion({
    quien: "Martina R.",
    barrio: "Palermo, CABA",
    rol: "owner",
    url: "https://inkey.test/invitacion/xyz",
    siteUrl: "https://inkey.test",
  }).html;

  const todos: Array<[string, string]> = [
    ...PLANTILLAS_SUPABASE.map(
      (nombre) =>
        [
          nombre,
          readFileSync(new URL(`../../supabase/templates/${nombre}`, import.meta.url), "utf8"),
        ] as [string, string],
    ),
    ["plantillas de la app", mailDeLaApp],
  ];

  it("están las cinco plantillas de Supabase", () => {
    expect(PLANTILLAS_SUPABASE).toHaveLength(5);
  });

  for (const [nombre, html] of todos) {
    it(`${nombre}: primero el nombre, después el símbolo`, () => {
      const encabezado = encabezadoDe(html);
      const palabra = encabezado.indexOf(">inkey</span>");
      const simbolo = encabezado.indexOf("inkey-simbolo.png");

      expect(palabra, "falta el wordmark").toBeGreaterThan(-1);
      expect(simbolo, "falta el símbolo").toBeGreaterThan(-1);
      expect(simbolo, "el símbolo quedó antes del nombre").toBeGreaterThan(palabra);

      // Un espacio entre los dos se dibuja y rompe el remate.
      expect(encabezado).toContain("</span><img");
      // Y se apoya en la base del texto, no centrado.
      expect(encabezado).toContain("vertical-align:baseline");
      // El ícono cuadrado de la app no es el lockup del encabezado.
      expect(encabezado).not.toContain("apple-icon");
    });
  }
});
