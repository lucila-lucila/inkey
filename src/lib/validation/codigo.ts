import { z } from "zod";

/**
 * El código de 6 dígitos que va en el mail además del link. Existe porque
 * algunos servicios de correo abren los links solos para revisarlos y los
 * gastan: el código siempre funciona, se escriba donde se escriba.
 */
export const codigoSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Falta el mail.")
    .email("Revisá el mail.")
    .transform((valor) => valor.toLowerCase()),
  codigo: z
    .string()
    .trim()
    // Se pega con espacios o guiones más veces de las que uno cree.
    .transform((valor) => valor.replace(/[\s-]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d{6}$/, "El código son los 6 números que te llegaron por mail."),
    ),
});

export type CodigoInput = z.infer<typeof codigoSchema>;
