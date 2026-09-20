import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generarRecibo, type DatosRecibo } from "@/lib/pdf/recibo";

const EJEMPLO: DatosRecibo = {
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
