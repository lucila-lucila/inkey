import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { traductor } from "./apoyo/traductor";
import { generarRecibo, type DatosRecibo } from "@/lib/pdf/recibo";

const EJEMPLO: DatosRecibo = {
  t: traductor("es"),
  idioma: "es",
  numero: "0007",
  periodo: "2026-09-01",
  monto: "450000",
  moneda: "ARS",
  pagadoEl: "2026-09-08",
  vencia: "2026-09-10",
  enFecha: true,
  confirmadoEl: "2026-09-09",
  inquilino: "Martina R.",
  duenio: "Jorge L.",
  direccion: "Gurruchaga 1234, 3° B",
  barrio: "Palermo, CABA",
  conComprobante: true,
};

describe("recibo en PDF", () => {
  it("genera un PDF válido y con contenido", async () => {
    const pdf = await generarRecibo(EJEMPLO);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2000);

    // Para mirarlo a ojo: INKEY_PDF=/tmp/recibo.pdf pnpm test
    if (process.env.INKEY_PDF) writeFileSync(process.env.INKEY_PDF, pdf);
  }, 30_000);

  it("sale en inglés cuando quien lo baja lee en inglés", async () => {
    const pdf = await generarRecibo({ ...EJEMPLO, t: traductor("en"), idioma: "en" });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30_000);

  it("sale igual cuando el pago fue tarde y sin comprobante", async () => {
    const pdf = await generarRecibo({
      ...EJEMPLO,
      enFecha: false,
      conComprobante: false,
      moneda: "USD",
      monto: "1200",
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30_000);
});

describe("perfil en PDF", () => {
  it("genera un PDF válido con las métricas", async () => {
    const { generarPerfilPdf } = await import("@/lib/pdf/perfil");

    const pdf = await generarPerfilPdf({
      nombre: "Martina",
      inicialApellido: "R",
      rol: "tenant",
      generadoEl: "2026-09-20",
      t: traductor("es"),
      idioma: "es",
      metricas: {
        meses_confirmados: 12,
        pagos_en_fecha: 11,
        porcentaje_en_fecha: 92,
        contratos_cumplidos: 1,
        contratos_totales: 2,
        con_comprobante: 9,
        con_contrato: 1,
        desde: "2025-01-01",
        barrios: ["Palermo, CABA", "Villa Crespo, CABA"],
        ultimos_12: Array.from({ length: 12 }, (_, i) => ({
          periodo: `2026-${String(i + 1).padStart(2, "0")}`,
          confirmado: i % 4 !== 0,
        })),
      },
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2000);

    if (process.env.INKEY_PDF_PERFIL) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(process.env.INKEY_PDF_PERFIL, pdf);
    }
  }, 30_000);
});

describe("resumen anual en PDF", () => {
  it("genera un PDF válido en los dos idiomas", async () => {
    const { generarResumen } = await import("@/lib/pdf/resumen");
    const { resumenAnual } = await import("@/lib/domain/resumen");

    const resumen = resumenAnual({
      alquiler: { start_date: "2026-01-01", end_date: "2026-12-31", due_day: 10 },
      anio: 2026,
      pagos: [
        {
          id: "a",
          period: "2026-01-01",
          status: "confirmed",
          amount: "400000.00",
          currency: "ARS",
          paid_on: "2026-01-08",
          due_date: "2026-01-10",
          on_time: true,
          receipt_serial: 1,
        },
        {
          id: "b",
          period: "2026-07-01",
          status: "confirmed",
          amount: "500000.00",
          currency: "ARS",
          paid_on: "2026-07-14",
          due_date: "2026-07-10",
          on_time: false,
          receipt_serial: 2,
        },
      ],
      hoy: new Date("2026-12-20T12:00:00Z"),
    });

    for (const idioma of ["es", "en"] as const) {
      const pdf = await generarResumen({
        t: traductor(idioma),
        idioma,
        resumen,
        barrio: "Almagro, CABA",
        direccion: "Av. Siempreviva 742",
        inquilino: "Ana G.",
        duenio: "Carlos M.",
        generadoEl: "2026-12-20",
      });

      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(2000);

      if (process.env.INKEY_PDF_RESUMEN) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(`${process.env.INKEY_PDF_RESUMEN}-${idioma}.pdf`, pdf);
      }
    }
  }, 60_000);
});
