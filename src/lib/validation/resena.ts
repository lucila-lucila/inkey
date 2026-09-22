import { z } from "zod";
import { TOPE_TEXTO_RESENA } from "@/lib/domain/resenas";

export const resenaSchema = z
  .object({
    rental_id: z.string().uuid("validacion.alquilerNoEncontrado"),
    texto: z
      .string()
      .trim()
      .max(TOPE_TEXTO_RESENA, "validacion.resena.textoLargo")
      .optional(),
    etiquetas: z.array(z.string().max(60)).max(10, "validacion.resena.etiquetasDeMas"),
  })
  .refine((datos) => Boolean(datos.texto) || datos.etiquetas.length > 0, {
    message: "validacion.resena.algoQueDecir",
    path: ["etiquetas"],
  });

export type ResenaInput = z.infer<typeof resenaSchema>;
