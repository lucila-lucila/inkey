/*
 * El servidor manda claves, no frases.
 *
 * Una acción de servidor no sabe —ni tiene por qué saber— en qué idioma está
 * mirando la persona: devuelve `dominio.mensajePago.ya_reportado` y la
 * pantalla lo traduce. Si alguna vez llega algo que no es una clave, se
 * muestra tal cual en lugar de romper la pantalla: un mensaje raro es mejor
 * que una pantalla en blanco.
 */

export type Valores = Record<string, string | number | Date>;

export type Traductor = {
  (clave: string, valores?: Valores): string;
  has(clave: string): boolean;
};

export function traducirMensaje(
  t: Traductor,
  clave: string | undefined | null,
  valores?: Valores,
): string {
  if (!clave) return "";
  return t.has(clave) ? t(clave, valores) : clave;
}

/** Lo que manda el servidor cuando algo sale mal: una clave y sus valores. */
export type AvisoDelServidor = {
  mensaje?: string | null;
  /** El código corto que buscamos en los logs si la persona nos escribe. */
  ref?: string;
  valores?: Valores;
  /*
   * Un aviso que va delante, también como clave: "el archivo no se subió",
   * antes de "el alquiler quedó guardado igual". Se encadena acá y no en el
   * archivo de idiomas porque una clave no puede meterse dentro de otra.
   */
  antes?: { mensaje: string; valores?: Valores };
};

/**
 * El aviso del servidor, ya traducido.
 *
 * El código de referencia y los valores viajan aparte de la clave, y hay que
 * volver a juntarlos acá: un texto que lleva {ref} adentro, traducido sin
 * pasárselo, no se muestra a medias sino que se muestra como
 * "errores.inesperado" en la cara de la persona.
 */
export function traducirAviso(
  t: Traductor,
  aviso: AvisoDelServidor | string | null | undefined,
): string {
  if (!aviso) return "";
  if (typeof aviso === "string") return traducirMensaje(t, aviso, { ref: "" });

  const partes = [
    aviso.antes ? traducirMensaje(t, aviso.antes.mensaje, { ref: "", ...aviso.antes.valores }) : "",
    traducirMensaje(t, aviso.mensaje, { ref: aviso.ref ?? "", ...aviso.valores }),
  ];
  return partes.filter(Boolean).join(" ");
}
