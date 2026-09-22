import { describe, expect, it } from "vitest";
import {
  enlaceWhatsApp,
  conSeparadores,
  formatearMonto,
  montoParaCampo,
  mensajeInvitacion,
  rolInvitado,
  textoVencimiento,
  vencimientoDelPeriodo,
} from "@/lib/domain/alquiler";
import { datosAlquilerSchema, parsearMonto } from "@/lib/validation/rental";

const BASE = {
  rol: "inquilino",
  full_address: "Gurruchaga 1234, 3B",
  neighborhood_label: "Palermo, CABA",
  start_date: "2026-01-01",
  end_date: "",
  monthly_amount: "450.000",
  currency: "ARS",
  due_day: "10",
  adjustment_index: "",
  adjustment_every_months: "",
};

describe("monto", () => {
  it("entiende el monto como lo escribe la gente acá", () => {
    expect(parsearMonto("450.000")).toBe(450000);
    expect(parsearMonto("450000,50")).toBe(450000.5);
    expect(parsearMonto("$ 450.000")).toBe(450000);
    expect(parsearMonto("450000")).toBe(450000);
  });

  it("devuelve NaN si no hay ningún número", () => {
    expect(parsearMonto("lo que sea")).toBeNaN();
    expect(parsearMonto("")).toBeNaN();
  });

  it("no deja que el signo se separe del número al cortar el renglón", () => {
    // Espacio duro, no uno común: "$" y "450.000" son una sola cosa.
    expect(formatearMonto(450000, "ARS")).toContain("\u00a0");
    expect(formatearMonto(450000, "ARS")).not.toContain("$ 4");
  });

  it("separa los miles mientras se escribe el monto", () => {
    expect(conSeparadores("450000")).toBe("450.000");
    expect(conSeparadores("1234567")).toBe("1.234.567");
    expect(conSeparadores("450")).toBe("450");
    // Lo que no es número se cae; la coma decimal sobrevive, una sola.
    expect(conSeparadores("$ 450.000")).toBe("450.000");
    expect(conSeparadores("1000,5")).toBe("1.000,5");
    expect(conSeparadores("1000,5,3")).toBe("1.000,53");
  });

  it("deja el monto de la base listo para el campo", () => {
    expect(montoParaCampo(450000)).toBe("450.000");
    expect(montoParaCampo("450000.00")).toBe("450.000");
    expect(montoParaCampo(null)).toBe("");
    expect(montoParaCampo("")).toBe("");
  });

  it("muestra los dólares tal cual, sin convertir", () => {
    expect(formatearMonto(1200, "USD")).toBe("US$\u00a01.200");
    expect(formatearMonto(450000, "ARS")).toBe("$\u00a0450.000");
  });
});

describe("datos del alquiler", () => {
  it("acepta un alquiler completo", () => {
    const resultado = datosAlquilerSchema.safeParse(BASE);
    expect(resultado.success).toBe(true);
    expect(resultado.data?.monthly_amount).toBe(450000);
    expect(resultado.data?.end_date).toBeUndefined();
  });

  it("no deja que el fin sea anterior al inicio", () => {
    const resultado = datosAlquilerSchema.safeParse({ ...BASE, end_date: "2025-12-01" });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("validacion.alquiler.finAntesDeInicio");
  });

  it("pide índice y frecuencia juntos, o ninguno", () => {
    expect(datosAlquilerSchema.safeParse({ ...BASE, adjustment_index: "ICL" }).success).toBe(false);
    expect(
      datosAlquilerSchema.safeParse({ ...BASE, adjustment_index: "ICL", adjustment_every_months: "6" })
        .success,
    ).toBe(true);
  });

  it("rechaza un día de vencimiento imposible", () => {
    expect(datosAlquilerSchema.safeParse({ ...BASE, due_day: "0" }).success).toBe(false);
    expect(datosAlquilerSchema.safeParse({ ...BASE, due_day: "32" }).success).toBe(false);
  });

  it("rechaza montos de cero o negativos", () => {
    expect(datosAlquilerSchema.safeParse({ ...BASE, monthly_amount: "0" }).success).toBe(false);
    expect(datosAlquilerSchema.safeParse({ ...BASE, monthly_amount: "-5000" }).success).toBe(false);
  });

  it("no acepta un barrio que en realidad es la dirección entera", () => {
    const largo = "Gurruchaga 1234, 3B, Palermo, Ciudad Autónoma de Buenos Aires, Argentina";
    expect(datosAlquilerSchema.safeParse({ ...BASE, neighborhood_label: largo }).success).toBe(false);
  });
});

describe("el alta tal cual la manda el navegador", () => {
  // Regresión: el formulario manda todo como texto y el file vacío cuando no
  // se adjunta contrato. Esto tiene que parsear sin chistar.
  it("parsea el formulario completo, con ajuste cargado", () => {
    const delNavegador = {
      rol: "inquilino",
      full_address: "Gurruchaga 1234, 3B",
      neighborhood_label: "Palermo, CABA",
      start_date: "2026-01-01",
      end_date: "",
      monthly_amount: "450000",
      currency: "ARS",
      due_day: "10",
      adjustment_index: "IPC",
      adjustment_every_months: "6",
      contrato: new File([], ""),
    };

    const resultado = datosAlquilerSchema.safeParse(delNavegador);
    expect(resultado.success).toBe(true);
    expect(resultado.data?.adjustment_index).toBe("IPC");
    expect(resultado.data?.adjustment_every_months).toBe(6);
    expect(resultado.data?.end_date).toBeUndefined();
  });

  it("parsea igual sin ajuste ni fecha de fin", () => {
    const resultado = datosAlquilerSchema.safeParse({
      rol: "propietario",
      full_address: "Av. Rivadavia 5000",
      neighborhood_label: "Caballito, CABA",
      start_date: "2026-03-01",
      end_date: "",
      monthly_amount: "1.200",
      currency: "USD",
      due_day: "1",
      adjustment_index: "",
      adjustment_every_months: "",
      contrato: new File([], ""),
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.monthly_amount).toBe(1200);
  });
});

describe("vencimiento", () => {
  it("si el mes no tiene ese día, vence el último", () => {
    expect(vencimientoDelPeriodo(2026, 2, 31).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(vencimientoDelPeriodo(2028, 2, 31).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(vencimientoDelPeriodo(2026, 4, 31).toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("el día normal cae donde tiene que caer", () => {
    expect(vencimientoDelPeriodo(2026, 10, 10).toISOString().slice(0, 10)).toBe("2026-10-10");
  });

  it("avisa cuando el día puede correrse", () => {
    expect(textoVencimiento(10)).toBe("El 10 de cada mes");
    expect(textoVencimiento(31)).toContain("último día");
  });
});

describe("invitación", () => {
  it("el inquilino invita al dueño y el dueño al inquilino", () => {
    expect(rolInvitado("inquilino")).toBe("owner");
    expect(rolInvitado("propietario")).toBe("tenant");
  });

  it("arma un mensaje con el link y sin datos de más", () => {
    const mensaje = mensajeInvitacion({
      rolInvitado: "owner",
      nombre: "Martina",
      barrio: "Palermo, CABA",
      url: "https://inkey.app/invitacion/abc",
    });
    expect(mensaje).toContain("Martina");
    expect(mensaje).toContain("Palermo, CABA");
    expect(mensaje).toContain("https://inkey.app/invitacion/abc");
    expect(mensaje).not.toContain("undefined");
  });

  it("el link de WhatsApp lleva el mensaje escapado", () => {
    const enlace = enlaceWhatsApp("Hola, ¿confirmás?\nhttps://inkey.app/x");
    expect(enlace.startsWith("https://wa.me/?text=")).toBe(true);
    expect(enlace).not.toContain(" ");
    expect(decodeURIComponent(enlace.split("text=")[1])).toContain("https://inkey.app/x");
  });
});
