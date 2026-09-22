import { MENSAJES_PAGO } from "./pagos";
import { MENSAJES_RESENA } from "./resenas";

/*
 * De un código de la base a una clave de texto.
 *
 * Las funciones de Postgres devuelven códigos (`ya_reportado`,
 * `alquiler_inactivo`). Acá se convierten en claves del archivo de idiomas.
 * Un código que no conocemos cae en el mensaje genérico: preferimos decir
 * "no se pudo" antes que mostrar el nombre interno de un error.
 */
export function claveDeMensajePago(
  codigo: string | null | undefined,
  porDefecto: string,
): string {
  if (codigo && (MENSAJES_PAGO as readonly string[]).includes(codigo)) {
    return `dominio.mensajePago.${codigo}`;
  }
  return porDefecto;
}

/** Lo mismo para las reseñas y el fin de contrato. */
export function claveDeMensajeResena(
  codigo: string | null | undefined,
  porDefecto: string,
): string {
  if (codigo && (MENSAJES_RESENA as readonly string[]).includes(codigo)) {
    return `dominio.mensajeResena.${codigo}`;
  }
  return porDefecto;
}
