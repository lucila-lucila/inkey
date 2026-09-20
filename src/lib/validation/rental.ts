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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usá una fecha con el formato día/mes/año.");

const opcionalVacio = (esquema: z.ZodTypeAny) =>
  z.preprocess((valor) => {
    if (valor === null || valor === undefined) return undefined;
    if (typeof valor === "string" && valor.trim() === "") return undefined;
    return valor;
  }, esquema.optional());

export const datosAlquilerSchema = z
  .object({
    rol: z.enum(ROLES_ALQUILER, { message: "Elegí si lo cargás como inquilino o como dueño." }),

    full_address: z
      .string()
      .trim()
      .min(5, "Escribí la dirección completa, con altura.")
      .max(200, "Esa dirección es demasiado larga."),
    neighborhood_label: z
      .string()
      .trim()
      .min(2, "Escribí el barrio y la ciudad. Por ejemplo: Palermo, CABA.")
      .max(60, "Dejá solo el barrio y la ciudad."),

    start_date: fecha,
    end_date: opcionalVacio(fecha),

    monthly_amount: z.preprocess(
      parsearMonto,
      z
        .number({ message: "Escribí cuánto pagás por mes." })
        .positive("El monto tiene que ser mayor a cero.")
        .max(1_000_000_000, "Ese monto es demasiado grande."),
    ),
    currency: z.enum(MONEDAS, { message: "Elegí la moneda." }),
    due_day: z.preprocess(
      (valor) => (valor === "" || valor === null ? undefined : Number(valor)),
      z
        .number({ message: "Elegí el día de vencimiento." })
        .int()
        .min(1, "El día va del 1 al 31.")
        .max(31, "El día va del 1 al 31."),
    ),

    adjustment_index: opcionalVacio(
      z.string().trim().max(40, "Escribilo más corto: ICL, IPC, fijo…"),
    ),
    adjustment_every_months: z.preprocess(
      (valor) => (valor === "" || valor === null || valor === undefined ? undefined : Number(valor)),
      z
        .number()
        .int()
        .min(1, "El ajuste va de 1 a 60 meses.")
        .max(60, "El ajuste va de 1 a 60 meses.")
        .optional(),
    ),
  })
  .refine(
    (datos) => !datos.end_date || datos.end_date >= datos.start_date,
    { message: "La fecha de fin no puede ser anterior a la de inicio.", path: ["end_date"] },
  )
  .refine(
    (datos) => Boolean(datos.adjustment_index) === (datos.adjustment_every_months !== undefined),
    {
      message: "Completá el índice y cada cuántos meses ajusta, o dejá los dos vacíos.",
      path: ["adjustment_every_months"],
    },
  );

export type DatosAlquiler = z.infer<typeof datosAlquilerSchema>;

/** Los campos de cada paso del formulario, para validar de a poco. */
export const PASOS_ALQUILER = [
  { titulo: "¿Dónde es?", campos: ["full_address", "neighborhood_label"] },
  {
    titulo: "¿Desde cuándo y cuánto?",
    campos: ["start_date", "end_date", "monthly_amount", "currency", "due_day"],
  },
  {
    titulo: "Ajustes y contrato",
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
