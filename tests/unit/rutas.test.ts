import { describe, expect, it } from "vitest";
import { ingresoSchema, rutaInternaSegura } from "@/lib/validation/auth";

describe("rutaInternaSegura", () => {
  it("deja pasar una ruta interna", () => {
    expect(rutaInternaSegura("/alquileres/123")).toBe("/alquileres/123");
  });

  it("cae al destino por defecto si no hay nada", () => {
    expect(rutaInternaSegura(null)).toBe("/panel");
    expect(rutaInternaSegura("")).toBe("/panel");
  });

  it("no permite mandar a la persona a otro sitio", () => {
    expect(rutaInternaSegura("https://sitio-falso.com")).toBe("/panel");
    expect(rutaInternaSegura("//sitio-falso.com")).toBe("/panel");
    expect(rutaInternaSegura("javascript:alert(1)")).toBe("/panel");
  });
});

describe("ingreso", () => {
  it("normaliza el mail", () => {
    expect(ingresoSchema.parse({ email: " ANA@mail.com " }).email).toBe("ana@mail.com");
  });

  it("rechaza vacío", () => {
    expect(ingresoSchema.safeParse({ email: "  " }).success).toBe(false);
  });
});
