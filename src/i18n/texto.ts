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

export function texto(
  t: Traductor,
  clave: string | undefined | null,
  valores?: Valores,
): string {
  if (!clave) return "";
  return t.has(clave) ? t(clave, valores) : clave;
}
