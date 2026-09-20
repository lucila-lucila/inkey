import { describe, expect, it } from "vitest";
import { waitlistSchema } from "@/lib/validation/waitlist";

describe("lista de espera", () => {
  it("acepta un mail válido y un rol conocido", () => {
    const resultado = waitlistSchema.safeParse({ email: "ana@mail.com", rol: "inquilino" });
    expect(resultado.success).toBe(true);
  });

  it("normaliza el mail a minúsculas y sin espacios", () => {
    const resultado = waitlistSchema.parse({ email: "  Ana@Mail.COM ", rol: "propietario" });
    expect(resultado.email).toBe("ana@mail.com");
  });

  it("rechaza un mail mal escrito con un mensaje en criollo", () => {
    const resultado = waitlistSchema.safeParse({ email: "ana@", rol: "inquilino" });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain("nombre@mail.com");
  });

  it("no acepta un rol inventado", () => {
    const resultado = waitlistSchema.safeParse({ email: "ana@mail.com", rol: "administrador" });
    expect(resultado.success).toBe(false);
  });
});
