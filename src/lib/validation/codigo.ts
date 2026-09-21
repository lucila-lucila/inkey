import { z } from "zod";

/**
 * El código que va en el mail además del link. Existe porque algunos
 * servicios de correo abren los links solos para revisarlos y los gastan.
 *
 * El largo lo decide Supabase (Authentication → "Email OTP Length"), así que
 * acá se acepta un rango: si alguien cambia esa opción, la pantalla sigue
 * andando en vez de rechazar un código legítimo.
 */
export const LARGO_CODIGO = { minimo: 6, maximo: 10 } as const;

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
        .regex(
          new RegExp(`^\\d{${LARGO_CODIGO.minimo},${LARGO_CODIGO.maximo}}$`),
          "El código son los números que te llegaron por mail.",
        ),
    ),
});

export type CodigoInput = z.infer<typeof codigoSchema>;
