import { describe, expect, it } from "vitest";
import {
  aCentavos,
  anioValido,
  aniosConResumen,
  csvDelResumen,
  periodosDelAnio,
  resumenAnual,
  type PagoDelResumen,
} from "@/lib/domain/resumen";
import { traductor } from "./apoyo/traductor";

const ALQUILER = { start_date: "2025-11-01", end_date: "2027-02-28", due_day: 10 };
const HOY = new Date("2026-12-20T12:00:00Z");

function pago(parcial: Partial<PagoDelResumen> & { period: string }): PagoDelResumen {
  return {
    id: `id-${parcial.period}`,
    status: "confirmed",
    amount: "450000.00",
    currency: "ARS",
    paid_on: `${parcial.period.slice(0, 7)}-05`,
    due_date: `${parcial.period.slice(0, 7)}-10`,
    on_time: true,
    receipt_serial: null,
    ...parcial,
  };
}

describe("los años del alquiler", () => {
  it("van del más nuevo al más viejo y no pasan de hoy", () => {
    expect(aniosConResumen(ALQUILER, HOY)).toEqual([2026, 2025]);
  });

  it("los meses del año van al revés, del más viejo al más nuevo", () => {
    expect(periodosDelAnio(ALQUILER, 2025, HOY)).toEqual(["2025-11-01", "2025-12-01"]);
    expect(periodosDelAnio(ALQUILER, 2026, HOY)).toHaveLength(12);
    // Un año que el contrato no llegó a tocar no tiene meses.
    expect(periodosDelAnio(ALQUILER, 2024, HOY)).toEqual([]);
  });

  it("no acepta cualquier cosa como año", () => {
    expect(anioValido("2026")).toBe(2026);
    expect(anioValido("26")).toBeNull();
    expect(anioValido("1999")).toBeNull();
    expect(anioValido("2026-01")).toBeNull();
    expect(anioValido("../../etc")).toBeNull();
  });
});

describe("el resumen del año", () => {
  it("cuenta los meses del contrato, no los del calendario", () => {
    const resumen = resumenAnual({ alquiler: ALQUILER, anio: 2025, pagos: [], hoy: HOY });
    expect(resumen.cantidadDeMeses).toBe(2);
    expect(resumen.confirmados).toBe(0);
    // Sin ningún mes confirmado, 0 % diría algo que no es cierto.
    expect(resumen.puntualidad).toBeNull();
    expect(resumen.totales).toEqual([]);
  });

  it("deja el mes sin pago en la lista: es parte del año igual", () => {
    const resumen = resumenAnual({
      alquiler: ALQUILER,
      anio: 2025,
      pagos: [pago({ period: "2025-11-01" })],
      hoy: HOY,
    });
    expect(resumen.meses.map((mes) => mes.pago !== null)).toEqual([true, false]);
    // Sin pago todavía, el vencimiento sale del día del alquiler.
    expect(resumen.meses[1].vence).toBe("2025-12-10");
  });

  it("solo suma lo confirmado", () => {
    const resumen = resumenAnual({
      alquiler: ALQUILER,
      anio: 2025,
      pagos: [
        pago({ period: "2025-11-01" }),
        pago({ period: "2025-12-01", status: "reported" }),
      ],
      hoy: HOY,
    });
    expect(resumen.confirmados).toBe(1);
    expect(resumen.totales).toEqual([{ moneda: "ARS", total: "450000.00", meses: 1 }]);
  });

  it("suma en centavos, sin arrastrar el error del punto flotante", () => {
    const resumen = resumenAnual({
      alquiler: ALQUILER,
      anio: 2025,
      pagos: [
        pago({ period: "2025-11-01", amount: "333333.33" }),
        pago({ period: "2025-12-01", amount: "333333.34" }),
      ],
      hoy: HOY,
    });
    expect(resumen.totales[0].total).toBe("666666.67");
    expect(aCentavos("450000.00")).toBe(45000000);
  });

  it("separa los totales por moneda, con los pesos primero", () => {
    const resumen = resumenAnual({
      alquiler: ALQUILER,
      anio: 2025,
      pagos: [
        pago({ period: "2025-11-01", amount: "700.00", currency: "USD" }),
        pago({ period: "2025-12-01", amount: "450000.00" }),
      ],
      hoy: HOY,
    });
    expect(resumen.totales).toEqual([
      { moneda: "ARS", total: "450000.00", meses: 1 },
      { moneda: "USD", total: "700.00", meses: 1 },
    ]);
  });

  it("la puntualidad se mide sobre lo confirmado", () => {
    const resumen = resumenAnual({
      alquiler: ALQUILER,
      anio: 2026,
      pagos: [
        pago({ period: "2026-01-01" }),
        pago({ period: "2026-02-01", on_time: false }),
        pago({ period: "2026-03-01" }),
        // Este no cuenta para ningún lado: no está confirmado.
        pago({ period: "2026-04-01", status: "not_received", on_time: false }),
      ],
      hoy: HOY,
    });
    expect(resumen.confirmados).toBe(3);
    expect(resumen.enFecha).toBe(2);
    expect(resumen.puntualidad).toBe(67);
  });
});

describe("cómo se movió el alquiler", () => {
  it("compara el primer mes confirmado con el último", () => {
    const resumen = resumenAnual({
      alquiler: ALQUILER,
      anio: 2026,
      pagos: [
        pago({ period: "2026-01-01", amount: "400000.00" }),
        pago({ period: "2026-07-01", amount: "500000.00" }),
      ],
      hoy: HOY,
    });
    expect(resumen.movimiento).toEqual({
      moneda: "ARS",
      desde: "400000.00",
      hasta: "500000.00",
      primerMes: "2026-01-01",
      ultimoMes: "2026-07-01",
      porcentaje: 25,
    });
  });

  it("no dice nada si el monto no se movió, o si hay uno solo", () => {
    const igual = resumenAnual({
      alquiler: ALQUILER,
      anio: 2026,
      pagos: [pago({ period: "2026-01-01" }), pago({ period: "2026-02-01" })],
      hoy: HOY,
    });
    expect(igual.movimiento).toBeNull();

    const unoSolo = resumenAnual({
      alquiler: ALQUILER,
      anio: 2026,
      pagos: [pago({ period: "2026-01-01" })],
      hoy: HOY,
    });
    expect(unoSolo.movimiento).toBeNull();
  });

  it("no compara pesos con dólares: eso no es un aumento", () => {
    const resumen = resumenAnual({
      alquiler: ALQUILER,
      anio: 2026,
      pagos: [
        pago({ period: "2026-01-01", amount: "400000.00" }),
        pago({ period: "2026-07-01", amount: "700.00", currency: "USD" }),
      ],
      hoy: HOY,
    });
    expect(resumen.movimiento).toBeNull();
  });
});

describe("el resumen en CSV", () => {
  const resumen = resumenAnual({
    alquiler: ALQUILER,
    anio: 2025,
    pagos: [pago({ period: "2025-11-01", receipt_serial: 3 })],
    hoy: HOY,
  });

  const armar = (idioma: "es" | "en", direccion = "Av. Siempreviva 742") =>
    csvDelResumen({
      t: traductor(idioma),
      resumen,
      barrio: "Almagro, CABA",
      direccion,
      inquilino: "Ana G.",
      duenio: "Carlos M.",
      generadoEl: "2026-12-20",
    });

  it("trae el encabezado, los meses y las fechas en ISO", () => {
    const csv = armar("es");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Almagro, CABA");
    expect(csv).toContain("2025-11,450000.00,ARS,2025-11-05,2025-11-10,Confirmado,Sí,3");
    // El mes sin pago está igual, con las columnas vacías.
    expect(csv).toContain("2025-12,,,,2025-12-10,Sin reportar,,");
  });

  it("sale traducido", () => {
    expect(armar("en")).toContain("Not reported");
  });

  it("no deja que una dirección se abra como fórmula en Excel", () => {
    // Una celda que empieza con "=" la ejecuta Excel al abrir el archivo.
    expect(armar("es", "=HYPERLINK(\"http://malo\")")).toContain("'=HYPERLINK");
  });
});
