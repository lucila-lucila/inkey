import { z } from "zod";

/** Celular argentino, tolerante al formato con el que la gente lo escribe. */
const telefonoRegex = /^[0-9+().\s-]{8,20}$/;

export const INTENCIONES = ["inquilino", "propietario"] as const;
export type Intencion = (typeof INTENCIONES)[number];

const casillaObligatoria = z
  .literal("on", { message: "validacion.aceptar" })
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
    .min(2, "validacion.perfil.nombre")
    .max(60, "validacion.perfil.nombreLargo"),
  last_name: z
    .string()
    .trim()
    .min(2, "validacion.perfil.apellido")
    .max(60, "validacion.perfil.apellidoLargo"),
  phone: z
    .string()
    .trim()
    .regex(telefonoRegex, "validacion.perfil.celular"),
  intencion: z.enum(INTENCIONES, { message: "validacion.perfil.intencion" }),
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
 * Cómo se llama la otra parte.
 *
 * Los dos textos de reemplazo vienen de afuera ya traducidos: acá abajo no
 * sabemos en qué idioma está mirando la persona. Alguien que se dio de baja
 * tampoco puede quedar como un hueco: el historial de la otra parte sigue
 * existiendo y ese lugar tiene que decir algo.
 */
export function nombreDeContraparte(
  perfil: { first_name?: string | null; last_name?: string | null; deleted_at?: string | null } | null,
  textos: { siNoHay: string; dadoDeBaja: string },
): string {
  if (!perfil) return textos.siNoHay;
  if (perfil.deleted_at) return textos.dadoDeBaja;
  if (!perfil.first_name) return textos.siNoHay;
  return nombrePublico(perfil.first_name, perfil.last_name ?? "");
}
