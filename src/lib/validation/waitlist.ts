import { z } from "zod";

export const ROLES_LISTA = ["inquilino", "propietario"] as const;
export type RolLista = (typeof ROLES_LISTA)[number];

export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Escribí tu mail.")
    .max(254, "Ese mail es demasiado largo.")
    .email("Revisá el mail: tiene que ser del estilo nombre@mail.com.")
    .transform((valor) => valor.toLowerCase()),
  rol: z.enum(ROLES_LISTA, { message: "Elegí si sos inquilino/a o propietario/a." }),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
