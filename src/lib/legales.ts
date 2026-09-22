import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Los textos legales viven en `docs/legales/*.md` y las pantallas se arman de
 * ahí. Una sola fuente: si alguien corrige el texto, la página cambia sola y
 * no hay dos versiones diciendo cosas distintas.
 *
 * El markdown que se usa es el mínimo: títulos, párrafos, listas (con un nivel
 * de anidado), negritas y links. No hay HTML crudo, y nada de esto se arma con
 * texto de nadie: son archivos del repo.
 */

export const LEGALES = {
  terminos: { archivo: "terminos.md", titulo: "Términos y condiciones", ruta: "/terminos" },
  privacidad: { archivo: "privacidad.md", titulo: "Política de privacidad", ruta: "/privacidad" },
} as const;

export type Legal = keyof typeof LEGALES;

export type Inline =
  | { tipo: "texto"; texto: string }
  | { tipo: "fuerte"; texto: string }
  | { tipo: "link"; texto: string; url: string };

export type Bloque =
  | { tipo: "titulo"; texto: string }
  | { tipo: "seccion"; texto: string }
  | { tipo: "parrafo"; partes: Inline[] }
  | { tipo: "lista"; items: Array<{ partes: Inline[]; sub: Inline[][] }> }
  /* La nota de "esto es una traducción de cortesía". */
  | { tipo: "aviso"; partes: Inline[] };

/** `**negrita**` y `[texto](url)`, que es todo lo que usan estos textos. */
export function partirInline(texto: string): Inline[] {
  const partes: Inline[] = [];
  const patron = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let desde = 0;

  for (const encontrado of texto.matchAll(patron)) {
    const indice = encontrado.index ?? 0;
    if (indice > desde) {
      partes.push({ tipo: "texto", texto: texto.slice(desde, indice) });
    }

    if (encontrado[1] !== undefined) {
      partes.push({ tipo: "fuerte", texto: encontrado[1] });
    } else {
      partes.push({ tipo: "link", texto: encontrado[2]!, url: encontrado[3]! });
    }
    desde = indice + encontrado[0].length;
  }

  if (desde < texto.length) partes.push({ tipo: "texto", texto: texto.slice(desde) });
  return partes;
}

export function parsearMarkdown(fuente: string): Bloque[] {
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];

  function cerrarParrafo() {
    if (parrafo.length === 0) return;
    bloques.push({ tipo: "parrafo", partes: partirInline(parrafo.join(" ")) });
    parrafo = [];
  }

  function listaAbierta() {
    const ultimo = bloques.at(-1);
    return ultimo?.tipo === "lista" ? ultimo : null;
  }

  for (const linea of fuente.split("\n")) {
    const vacia = linea.trim() === "";
    const anidada = /^\s{2,}-\s+/.test(linea);
    const item = /^-\s+/.test(linea);

    if (vacia) {
      cerrarParrafo();
      continue;
    }

    if (linea.startsWith("# ")) {
      cerrarParrafo();
      bloques.push({ tipo: "titulo", texto: linea.slice(2).trim() });
      continue;
    }

    if (linea.startsWith("> ")) {
      cerrarParrafo();
      bloques.push({ tipo: "aviso", partes: partirInline(linea.slice(2).trim()) });
      continue;
    }

    if (linea.startsWith("## ")) {
      cerrarParrafo();
      bloques.push({ tipo: "seccion", texto: linea.slice(3).trim() });
      continue;
    }

    if (anidada) {
      const lista = listaAbierta();
      const padre = lista?.items.at(-1);
      if (padre) {
        padre.sub.push(partirInline(linea.trim().slice(2)));
        continue;
      }
    }

    if (item) {
      cerrarParrafo();
      const nuevo = { partes: partirInline(linea.slice(2).trim()), sub: [] as Inline[][] };
      const lista = listaAbierta();
      if (lista) lista.items.push(nuevo);
      else bloques.push({ tipo: "lista", items: [nuevo] });
      continue;
    }

    // Un renglón suelto continúa el párrafo: el markdown viene con saltos.
    parrafo.push(linea.trim());
  }

  cerrarParrafo();
  return bloques;
}

/*
 * Lee el archivo del repo. Solo se llama en el servidor, al renderizar.
 *
 * El castellano es la versión que vale. La inglesa está de cortesía y lo dice
 * en su primera línea; si algún día falta, se muestra la castellana antes que
 * dejar la pantalla vacía.
 */
export function leerLegal(cual: Legal, idioma = "es"): Bloque[] {
  const carpeta = join(process.cwd(), "docs", "legales");
  const traducida = join(carpeta, idioma, LEGALES[cual].archivo);
  const ruta = idioma !== "es" && existsSync(traducida)
    ? traducida
    : join(carpeta, LEGALES[cual].archivo);
  return parsearMarkdown(readFileSync(ruta, "utf8"));
}

/** La fecha de la línea "Última actualización", para el `<time>` y el aviso. */
export function ultimaActualizacion(bloques: Bloque[]): string | null {
  for (const bloque of bloques) {
    if (bloque.tipo !== "parrafo") continue;
    const texto = bloque.partes.map((parte) => parte.texto).join("");
    const encontrado = texto.match(/Última actualización:\s*(.+)/i);
    if (encontrado) return encontrado[1].trim();
  }
  return null;
}
