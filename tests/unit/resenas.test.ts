import { describe, expect, it } from "vitest";
import {
  DIAS_PARA_PUBLICAR,
  direccionDe,
  fechaDePublicacion,
  TOPE_TEXTO_RESENA,
} from "@/lib/domain/resenas";
import { resenaSchema } from "@/lib/validation/resena";

const BASE = {
  rental_id: "11111111-1111-4111-8111-111111111111",
  texto: "Resolvió todo rápido.",
  etiquetas: ["resolvio_arreglos_rapido"],
};

describe("dirección de la reseña", () => {
  it("el inquilino reseña al dueño y el dueño al inquilino", () => {
    expect(direccionDe(true)).toBe("tenant_to_owner");
    expect(direccionDe(false)).toBe("owner_to_tenant");
  });
});

describe("cuándo se publica", () => {
  it("a los 14 días del fin del contrato", () => {
    expect(DIAS_PARA_PUBLICAR).toBe(14);
    const fecha = fechaDePublicacion("2026-09-01T12:00:00Z");
    expect(fecha.toISOString().slice(0, 10)).toBe("2026-09-15");
  });

  it("cruza el cambio de mes sin marearse", () => {
    expect(fechaDePublicacion("2026-01-25T12:00:00Z").toISOString().slice(0, 10)).toBe("2026-02-08");
  });
});

describe("validación de la reseña", () => {
  it("acepta etiquetas y texto", () => {
    expect(resenaSchema.safeParse(BASE).success).toBe(true);
  });

  it("acepta solo etiquetas, sin texto", () => {
    expect(resenaSchema.safeParse({ ...BASE, texto: undefined }).success).toBe(true);
  });

  it("acepta solo texto, sin etiquetas", () => {
    expect(resenaSchema.safeParse({ ...BASE, etiquetas: [] }).success).toBe(true);
  });

  it("no acepta una reseña vacía", () => {
    const resultado = resenaSchema.safeParse({ ...BASE, texto: undefined, etiquetas: [] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain("al menos una etiqueta");
  });

  it("corta el texto en 500 caracteres", () => {
    expect(resenaSchema.safeParse({ ...BASE, texto: "a".repeat(TOPE_TEXTO_RESENA) }).success).toBe(
      true,
    );
    expect(
      resenaSchema.safeParse({ ...BASE, texto: "a".repeat(TOPE_TEXTO_RESENA + 1) }).success,
    ).toBe(false);
  });

  it("no acepta una lista interminable de etiquetas", () => {
    const muchas = Array.from({ length: 11 }, (_, i) => `etiqueta_${i}`);
    expect(resenaSchema.safeParse({ ...BASE, etiquetas: muchas }).success).toBe(false);
  });
});
