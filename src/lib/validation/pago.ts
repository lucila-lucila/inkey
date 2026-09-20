import { z } from "zod";
import { parsearMonto } from "./rental";

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usá una fecha con el formato día/mes/año.");

export const reportePagoSchema = z
  .object({
    rental_id: z.string().uuid("No encontramos el alquiler."),
    period: fecha,
    amount: z.preprocess(
      parsearMonto,
      z
        .number({ message: "Escribí cuánto pagaste." })
        .positive("El monto tiene que ser mayor a cero.")
        .max(1_000_000_000, "Ese monto es demasiado grande."),
    ),
    paid_on: fecha,
  })
  .refine((datos) => datos.paid_on <= new Date().toISOString().slice(0, 10), {
    message: "La fecha de pago no puede ser posterior a hoy.",
    path: ["paid_on"],
  });

export type ReportePago = z.infer<typeof reportePagoSchema>;

export const notaDueñoSchema = z
  .string()
  .trim()
  .max(500, "La nota no puede pasar de 500 caracteres.")
  .optional();
