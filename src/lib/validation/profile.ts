import { z } from "zod";

/** Celular argentino, tolerante al formato con el que la gente lo escribe. */
const telefonoRegex = /^[0-9+().\s-]{8,20}$/;

export const INTENCIONES = ["inquilino", "propietario"] as const;
export type Intencion = (typeof INTENCIONES)[number];

const casillaObligatoria = z
  .literal("on", { message: "Necesitamos que aceptes para seguir." })
  .transform(() => true);

/**
 * La intención que viaja desde la landing hasta el onboarding, por la URL.
 *
 * Es solo una preselección de "¿Qué querés hacer primero?": el rol en Inkey es
 * de cada alquiler, no de la cuenta. Si viene cualquier otra cosa, se ignora.
 */
export function intencionSegura(valor: string | null | undefined): Intencion | null {
  return INTENCIONES.includes(valor as Intencion) ? (valor as Intencion) : null;
}

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

/** Editar mis datos en /cuenta. Los mismos campos del onboarding, sin las casillas. */
export const datosPersonalesSchema = onboardingSchema.pick({
  first_name: true,
  last_name: true,
  phone: true,
});

export type DatosPersonales = z.infer<typeof datosPersonalesSchema>;

/**
 * Cómo se llama alguien que se dio de baja. El historial de la otra parte
 * sigue existiendo, así que el lugar de esa persona no puede quedar vacío.
 */
export const NOMBRE_DADO_DE_BAJA = "Usuario dado de baja";

export function nombreDeContraparte(
  perfil: { first_name?: string | null; last_name?: string | null; deleted_at?: string | null } | null,
  siNoHay = "La otra parte",
): string {
  if (!perfil) return siNoHay;
  if (perfil.deleted_at) return NOMBRE_DADO_DE_BAJA;
  if (!perfil.first_name) return siNoHay;
  return nombrePublico(perfil.first_name, perfil.last_name ?? "");
}
