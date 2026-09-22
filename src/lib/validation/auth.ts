import { z } from "zod";

export const ingresoSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "validacion.mailFalta")
    .max(254, "validacion.mailLargo")
    .email("validacion.mailFormato")
    .transform((valor) => valor.toLowerCase()),
});

export type IngresoInput = z.infer<typeof ingresoSchema>;

/**
 * Solo permitimos volver a rutas internas: evita que un `?volver_a=` armado
 * por un tercero nos use de trampolín a otro sitio.
 */
export function rutaInternaSegura(valor: string | null | undefined, porDefecto = "/panel"): string {
  if (!valor) return porDefecto;
  if (!valor.startsWith("/") || valor.startsWith("//")) return porDefecto;
  return valor;
}
