import { describe, expect, it } from "vitest";
import { iniciales, nombrePublico, onboardingSchema } from "@/lib/validation/profile";

const BASE = {
  first_name: "Martina",
  last_name: "Rossi",
  phone: "+54 9 11 5555 5555",
  intencion: "inquilino",
  acepta_terminos: "on",
  acepta_privacidad: "on",
};

describe("onboarding", () => {
  it("acepta los datos completos", () => {
    expect(onboardingSchema.safeParse(BASE).success).toBe(true);
  });

  it("no deja seguir si no se aceptaron los términos", () => {
    const resultado = onboardingSchema.safeParse({ ...BASE, acepta_terminos: null });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("validacion.aceptar");
  });

  it("no deja seguir si no se aceptó la privacidad", () => {
    const resultado = onboardingSchema.safeParse({ ...BASE, acepta_privacidad: undefined });
    expect(resultado.success).toBe(false);
  });

  it("rechaza un celular con letras", () => {
    const resultado = onboardingSchema.safeParse({ ...BASE, phone: "llamame" });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain("celular");
  });

  it("acepta el celular escrito de varias formas", () => {
    for (const phone of ["1155555555", "+5491155555555", "(011) 5555-5555", "11 5555 5555"]) {
      expect(onboardingSchema.safeParse({ ...BASE, phone }).success).toBe(true);
    }
  });

  it("recorta los espacios del nombre", () => {
    const resultado = onboardingSchema.parse({ ...BASE, first_name: "  Martina  " });
    expect(resultado.first_name).toBe("Martina");
  });
});

describe("nombre público", () => {
  it("muestra el nombre y la inicial del apellido, nunca el apellido entero", () => {
    expect(nombrePublico("Martina", "Rossi")).toBe("Martina R.");
    expect(nombrePublico("Martina", "Rossi")).not.toContain("Rossi");
  });

  it("no rompe si falta el apellido", () => {
    expect(nombrePublico("Martina", "")).toBe("Martina");
  });

  it("arma las iniciales del avatar", () => {
    expect(iniciales("martina", "rossi")).toBe("MR");
  });
});
