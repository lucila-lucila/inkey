import { describe, expect, it } from "vitest";
import {
  codigoDeRebote,
  esRebote,
  mensajeDeRebote,
  MENSAJE_GENERICO,
} from "@/lib/auth/errores-link";
import { codigoSchema, LARGO_CODIGO } from "@/lib/validation/codigo";

describe("links de ingreso que ya no sirven", () => {
  it("reconoce el rebote de Supabase", () => {
    expect(esRebote(new URLSearchParams("error=access_denied&error_code=otp_expired"))).toBe(true);
    expect(esRebote(new URLSearchParams("error_description=Email+link+is+invalid"))).toBe(true);
  });

  it("no confunde un error nuestro con un rebote", () => {
    // /alquileres/123?error=cancelar es un mensaje de la app, no un link muerto.
    expect(esRebote(new URLSearchParams("error=cancelar"))).toBe(false);
    expect(esRebote(new URLSearchParams(""))).toBe(false);
  });

  it("traduce el link vencido a algo que se entienda", () => {
    const codigo = codigoDeRebote({ error: "access_denied", error_code: "otp_expired" });
    expect(codigo).toBe("otp_expired");
    expect(mensajeDeRebote(codigo)).toBe("El link venció o ya se usó. Pedí uno nuevo.");
  });

  it("un código que no conocemos no viaja en la URL", () => {
    expect(codigoDeRebote({ error_code: "algo_raro<script>" })).toBe("link");
    expect(mensajeDeRebote("link")).toBe(MENSAJE_GENERICO);
  });

  it("sin error, no hay nada que decir", () => {
    expect(codigoDeRebote({})).toBe(null);
    expect(mensajeDeRebote(null)).toBeUndefined();
  });
});

describe("el código del mail", () => {
  const base = { email: "ana@mail.com" };

  it("acepta los 6 números de siempre", () => {
    expect(codigoSchema.parse({ ...base, codigo: "123456" }).codigo).toBe("123456");
  });

  /*
   * El largo lo decide Supabase ("Email OTP Length"). Ya nos pasó que llegara
   * uno de 7 y la pantalla lo rechazara siendo válido: por eso el rango.
   */
  it("acepta cualquier largo que pueda mandar Supabase", () => {
    for (let largo = LARGO_CODIGO.minimo; largo <= LARGO_CODIGO.maximo; largo += 1) {
      const codigo = "1234567890".slice(0, largo);
      expect(codigoSchema.safeParse({ ...base, codigo }).success, `largo ${largo}`).toBe(true);
    }
  });

  it("perdona cómo se pega desde el mail", () => {
    expect(codigoSchema.parse({ ...base, codigo: " 123 456 " }).codigo).toBe("123456");
    expect(codigoSchema.parse({ ...base, codigo: "123-456" }).codigo).toBe("123456");
    expect(codigoSchema.parse({ ...base, codigo: "123 4567" }).codigo).toBe("1234567");
  });

  it("rechaza lo que no sean números, o un largo imposible", () => {
    for (const codigo of ["12345", "12345678901", "12345a", "", "abcdef"]) {
      expect(codigoSchema.safeParse({ ...base, codigo }).success, codigo).toBe(false);
    }
  });

  it("normaliza el mail igual que el resto del ingreso", () => {
    expect(codigoSchema.parse({ email: " ANA@Mail.com ", codigo: "123456" }).email).toBe(
      "ana@mail.com",
    );
  });
});
