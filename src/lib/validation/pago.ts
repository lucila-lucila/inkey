import { z } from "zod";
import { parsearMonto } from "./rental";

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "validacion.fecha.formato");

export const reportePagoSchema = z
  .object({
    rental_id: z.string().uuid("validacion.alquilerNoEncontrado"),
    period: fecha,
    amount: z.preprocess(
      parsearMonto,
      z
        .number({ message: "validacion.montoDelPago" })
        .positive("validacion.monto.mayorACero")
        .max(1_000_000_000, "validacion.monto.demasiadoGrande"),
    ),
    paid_on: fecha,
  })
  .refine((datos) => datos.paid_on <= new Date().toISOString().slice(0, 10), {
    message: "validacion.fechaFutura",
    path: ["paid_on"],
  });

export type ReportePago = z.infer<typeof reportePagoSchema>;

export const notaDueñoSchema = z
  .string()
  .trim()
  .max(500, "validacion.notaLarga")
  .optional();
