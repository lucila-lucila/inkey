import { z } from "zod";

export const MONEDAS = ["ARS", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

export const ROLES_ALQUILER = ["inquilino", "propietario"] as const;
export type RolAlquiler = (typeof ROLES_ALQUILER)[number];

/**
 * Acepta el monto como lo escribe la gente acá: "450.000", "450000,50",
 * "$ 450.000". Devuelve NaN si no hay ningún número.
 */
export function parsearMonto(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor !== "string") return Number.NaN;

  const limpio = valor
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (limpio === "" || limpio === "-") return Number.NaN;
  return Number(limpio);
}

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "validacion.fecha.formato");

const opcionalVacio = (esquema: z.ZodTypeAny) =>
  z.preprocess((valor) => {
    if (valor === null || valor === undefined) return undefined;
    if (typeof valor === "string" && valor.trim() === "") return undefined;
    return valor;
  }, esquema.optional());

export const datosAlquilerSchema = z
  .object({
    rol: z.enum(ROLES_ALQUILER, { message: "validacion.alquiler.rol" }),

    full_address: z
      .string()
      .trim()
      .min(5, "validacion.alquiler.direccionCorta")
      .max(200, "validacion.alquiler.direccionLarga"),
    neighborhood_label: z
      .string()
      .trim()
      .min(2, "validacion.alquiler.barrioCorto")
      .max(60, "validacion.alquiler.barrioLargo"),

    start_date: fecha,
    end_date: opcionalVacio(fecha),

    monthly_amount: z.preprocess(
      parsearMonto,
      z
        .number({ message: "validacion.alquiler.montoFalta" })
        .positive("validacion.monto.mayorACero")
        .max(1_000_000_000, "validacion.monto.demasiadoGrande"),
    ),
    currency: z.enum(MONEDAS, { message: "validacion.alquiler.moneda" }),
    due_day: z.preprocess(
      (valor) => (valor === "" || valor === null ? undefined : Number(valor)),
      z
        .number({ message: "validacion.alquiler.diaFalta" })
        .int()
        .min(1, "validacion.alquiler.diaFueraDeRango")
        .max(31, "validacion.alquiler.diaFueraDeRango"),
    ),

    adjustment_index: opcionalVacio(
      z.string().trim().max(40, "validacion.alquiler.indiceLargo"),
    ),
    adjustment_every_months: z.preprocess(
      (valor) => (valor === "" || valor === null || valor === undefined ? undefined : Number(valor)),
      z
        .number()
        .int()
        .min(1, "validacion.alquiler.ajusteFueraDeRango")
        .max(60, "validacion.alquiler.ajusteFueraDeRango")
        .optional(),
    ),
  })
  .refine(
    (datos) => !datos.end_date || datos.end_date >= datos.start_date,
    { message: "validacion.alquiler.finAntesDeInicio", path: ["end_date"] },
  )
  .refine(
    (datos) => Boolean(datos.adjustment_index) === (datos.adjustment_every_months !== undefined),
    {
      message: "validacion.alquiler.ajusteIncompleto",
      path: ["adjustment_every_months"],
    },
  );

export type DatosAlquiler = z.infer<typeof datosAlquilerSchema>;

/*
 * Los campos de cada paso del formulario, para validar de a poco. El título
 * de cada paso sale del archivo de textos: acá va solo su clave.
 */
export const PASOS_ALQUILER = [
  { clave: "donde", campos: ["full_address", "neighborhood_label"] },
  {
    clave: "cuando",
    campos: ["start_date", "end_date", "monthly_amount", "currency", "due_day"],
  },
  {
    clave: "ajustes",
    campos: ["adjustment_index", "adjustment_every_months", "contrato"],
  },
] as const;

/**
 * En qué paso vive un campo. Sirve para que un error del servidor nunca quede
 * escondido en un paso que no se está viendo.
 */
export function pasoDelCampo(campo: string): number | null {
  const indice = PASOS_ALQUILER.findIndex((paso) =>
    (paso.campos as readonly string[]).includes(campo),
  );
  return indice === -1 ? null : indice;
}

/** Mandar el link de invitación por mail desde Inkey. */
export const invitacionPorMailSchema = z.object({
  rental_id: z.string().uuid("validacion.alquilerNoEncontrado"),
  token: z.string().trim().min(1, "validacion.faltaElLink"),
  email: z
    .string()
    .trim()
    .min(1, "validacion.mailDeLaPersona")
    .max(254, "validacion.mailLargo")
    .email("validacion.mailFormato")
    .transform((valor) => valor.toLowerCase()),
});
