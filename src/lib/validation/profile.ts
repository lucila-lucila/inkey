import { z } from "zod";

/** Celular argentino, tolerante al formato con el que la gente lo escribe. */
const telefonoRegex = /^[0-9+().\s-]{8,20}$/;

export const INTENCIONES = ["inquilino", "propietario"] as const;
export type Intencion = (typeof INTENCIONES)[number];

const casillaObligatoria = z
  .literal("on", { message: "Necesitamos que aceptes para seguir." })
  .transform(() => true);

export const onboardingSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, "Escribí tu nombre.")
    .max(60, "Ese nombre es demasiado largo."),
  last_name: z
    .string()
    .trim()
    .min(2, "Escribí tu apellido.")
    .max(60, "Ese apellido es demasiado largo."),
  phone: z
    .string()
    .trim()
    .regex(telefonoRegex, "Revisá el celular: por ejemplo +54 9 11 5555 5555."),
  intencion: z.enum(INTENCIONES, { message: "Elegí qué querés hacer primero." }),
  acepta_terminos: casillaObligatoria,
  acepta_privacidad: casillaObligatoria,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Nombre público: nombre completo + inicial del apellido. Nunca el apellido entero. */
export function nombrePublico(firstName: string, lastName: string): string {
  const inicial = lastName.trim().charAt(0).toUpperCase();
  return inicial ? `${firstName.trim()} ${inicial}.` : firstName.trim();
}

export function iniciales(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}
