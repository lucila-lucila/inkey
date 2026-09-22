import { describe, expect, it } from "vitest";
import { formatearFecha } from "@/lib/domain/alquiler";
import {
  cuentaEnFecha,
  nombrePeriodo,
  periodoActual,
  periodosDelAlquiler,
  vencimientoDe,
} from "@/lib/domain/pagos";
import { reportePagoSchema } from "@/lib/validation/pago";

describe("períodos", () => {
  it("lista los meses del contrato, del más nuevo al más viejo", () => {
    const periodos = periodosDelAlquiler(
      { start_date: "2026-01-01" },
      new Date("2026-04-15T12:00:00Z"),
    );
    expect(periodos).toEqual(["2026-04-01", "2026-03-01", "2026-02-01", "2026-01-01"]);
  });

  it("se corta cuando el contrato terminó", () => {
    const periodos = periodosDelAlquiler(
      { start_date: "2025-11-01", end_date: "2026-01-31" },
      new Date("2026-06-15T12:00:00Z"),
    );
    expect(periodos).toEqual(["2026-01-01", "2025-12-01", "2025-11-01"]);
  });

  it("cruza el cambio de año sin marearse", () => {
    const periodos = periodosDelAlquiler(
      { start_date: "2025-12-01" },
      new Date("2026-02-10T12:00:00Z"),
    );
    expect(periodos).toEqual(["2026-02-01", "2026-01-01", "2025-12-01"]);
  });

  it("un alquiler que arranca este mes tiene un solo período", () => {
    const periodos = periodosDelAlquiler(
      { start_date: "2026-09-01" },
      new Date("2026-09-20T12:00:00Z"),
    );
    expect(periodos).toEqual(["2026-09-01"]);
  });

  it("el período actual es el mes en curso", () => {
    expect(periodoActual(new Date("2026-09-20T12:00:00Z"))).toBe("2026-09-01");
  });

  it("nombra los meses en el idioma de quien lee", () => {
    expect(nombrePeriodo("2026-09-01")).toBe("septiembre de 2026");
    expect(nombrePeriodo("2026-09-01", "en")).toBe("September 2026");
    expect(nombrePeriodo("2026-09-01", "es", true)).toContain("2026");
  });

  it("la fecha mantiene el orden de acá en los dos idiomas", () => {
    // Día, mes y año: lo único que cambia es el nombre del mes.
    expect(formatearFecha("2026-09-21")).toBe("21 de septiembre de 2026");
    expect(formatearFecha("2026-09-21", "en")).toBe("21 September 2026");
  });
});

describe("vencimientos", () => {
  it("usa el día del contrato", () => {
    expect(vencimientoDe("2026-09-01", 10)).toBe("2026-09-10");
  });

  it("si el mes no tiene ese día, vence el último", () => {
    expect(vencimientoDe("2026-02-01", 31)).toBe("2026-02-28");
    expect(vencimientoDe("2028-02-01", 30)).toBe("2028-02-29");
    expect(vencimientoDe("2026-04-01", 31)).toBe("2026-04-30");
  });
});

describe("qué cuenta para el historial", () => {
  it("solo suma lo confirmado y en fecha", () => {
    expect(cuentaEnFecha({ status: "confirmed", on_time: true })).toBe(true);
    expect(cuentaEnFecha({ status: "confirmed", on_time: false })).toBe(false);
    // Reportado pero sin confirmar no suma: no existe el mes a medias.
    expect(cuentaEnFecha({ status: "reported", on_time: true })).toBe(false);
    // Y lo que el dueño no recibió tampoco resta: simplemente no suma.
    expect(cuentaEnFecha({ status: "not_received", on_time: true })).toBe(false);
  });
});

describe("reporte de pago", () => {
  const BASE = {
    rental_id: "11111111-1111-4111-8111-111111111111",
    period: "2026-09-01",
    amount: "450.000",
    paid_on: "2026-09-08",
  };

  it("acepta un reporte normal y normaliza el monto", () => {
    const resultado = reportePagoSchema.safeParse(BASE);
    expect(resultado.success).toBe(true);
    expect(resultado.data?.amount).toBe(450000);
  });

  it("no acepta una fecha de pago futura", () => {
    const maniana = new Date();
    maniana.setDate(maniana.getDate() + 1);
    const resultado = reportePagoSchema.safeParse({
      ...BASE,
      paid_on: maniana.toISOString().slice(0, 10),
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain("posterior a hoy");
  });

  it("no acepta montos de cero o negativos", () => {
    expect(reportePagoSchema.safeParse({ ...BASE, amount: "0" }).success).toBe(false);
    expect(reportePagoSchema.safeParse({ ...BASE, amount: "-1000" }).success).toBe(false);
  });

  it("no acepta un alquiler que no es un id", () => {
    expect(reportePagoSchema.safeParse({ ...BASE, rental_id: "cualquiera" }).success).toBe(false);
  });
});
