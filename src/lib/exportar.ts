/*
 * "Descargar mis datos" (Ley 25.326, art. 14).
 *
 * El JSON es la copia fiel. El CSV existe porque mucha gente lo que quiere es
 * abrirlo en una planilla: como los datos no son una sola tabla, se arma un
 * archivo con varias secciones, cada una con su encabezado, separadas por una
 * línea en blanco. Excel y Google Sheets lo abren sin quejarse.
 */

export type DatosExportados = Record<string, unknown>;

/** Una celda de CSV: comillas dobles siempre que haya algo que pueda romper. */
export function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (Array.isArray(valor)) return celda(valor.join(" · "));
  if (typeof valor === "object") return celda(JSON.stringify(valor));

  const texto = String(valor);
  /*
   * Una celda que empieza con =, +, - o @ la interpreta Excel como fórmula:
   * un dato que vino de otra persona no puede ejecutarse al abrir el archivo.
   */
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[",\n;]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

function seccion(titulo: string, filas: Array<Record<string, unknown>>): string {
  if (filas.length === 0) return `${titulo}\n(sin datos)\n`;

  const columnas = [...new Set(filas.flatMap((fila) => Object.keys(fila)))];
  const lineas = [
    titulo,
    columnas.join(","),
    ...filas.map((fila) => columnas.map((columna) => celda(fila[columna])).join(",")),
  ];
  return `${lineas.join("\n")}\n`;
}

/** El export completo en CSV, por secciones. */
export function aCsv(datos: DatosExportados): string {
  const bloques: string[] = [`Inkey · mis datos,exportado el,${celda(datos.exportado_el)}`, ""];

  const perfil = datos.perfil as Record<string, unknown> | null;
  bloques.push(seccion("PERFIL", perfil ? [perfil] : []), "");

  for (const [clave, titulo] of [
    ["alquileres", "ALQUILERES"],
    ["pagos", "PAGOS"],
    ["reseñas_que_escribí", "RESEÑAS QUE ESCRIBÍ"],
    ["reseñas_que_recibí", "RESEÑAS QUE RECIBÍ"],
    ["links_compartidos", "LINKS COMPARTIDOS"],
  ] as const) {
    const filas = (datos[clave] ?? []) as Array<Record<string, unknown>>;
    bloques.push(seccion(titulo, filas), "");
  }

  /*
   * BOM al principio: sin esto Excel en Windows abre los acentos rotos, y el
   * archivo está lleno de "reseñas" y "días".
   */
  return `﻿${bloques.join("\n")}`;
}

/** Nombre del archivo que baja, con la fecha adentro. */
export function nombreDeArchivo(formato: "json" | "csv", hoy = new Date()): string {
  return `inkey-mis-datos-${hoy.toISOString().slice(0, 10)}.${formato}`;
}
