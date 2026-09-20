import { z } from "zod";
import { TOPE_TEXTO_RESENA } from "@/lib/domain/resenas";

export const resenaSchema = z
  .object({
    rental_id: z.string().uuid("No encontramos el alquiler."),
    texto: z
      .string()
      .trim()
      .max(TOPE_TEXTO_RESENA, `El texto no puede pasar de ${TOPE_TEXTO_RESENA} caracteres.`)
      .optional(),
    etiquetas: z.array(z.string().max(60)).max(10, "Elegí hasta 10 etiquetas."),
  })
  .refine((datos) => Boolean(datos.texto) || datos.etiquetas.length > 0, {
    message: "Elegí al menos una etiqueta o escribí algo.",
    path: ["etiquetas"],
  });

export type ResenaInput = z.infer<typeof resenaSchema>;
