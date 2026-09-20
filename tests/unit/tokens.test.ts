import { describe, expect, it } from "vitest";
import { generarToken, hashearToken, hashesIguales, pareceToken } from "@/lib/tokens";
import { detectarTipoReal } from "@/lib/storage";

describe("tokens", () => {
  it("genera tokens de 32 bytes, distintos cada vez", () => {
    const uno = generarToken();
    const otro = generarToken();
    expect(uno).not.toBe(otro);
    // 32 bytes en base64url son 43 caracteres.
    expect(uno.length).toBe(43);
    expect(pareceToken(uno)).toBe(true);
  });

  it("el hash es estable y no deja adivinar el token", () => {
    const token = generarToken();
    expect(hashearToken(token)).toBe(hashearToken(token));
    expect(hashearToken(token)).not.toContain(token.slice(0, 10));
    expect(hashearToken(token)).toHaveLength(64);
  });

  it("descarta basura antes de tocar la base", () => {
    expect(pareceToken("")).toBe(false);
    expect(pareceToken("corto")).toBe(false);
    expect(pareceToken("'; drop table rentals; --")).toBe(false);
    expect(pareceToken("a".repeat(200))).toBe(false);
  });

  it("compara hashes sin filtrar en cuánto se parecen", () => {
    const a = hashearToken("uno");
    const b = hashearToken("otro");
    expect(hashesIguales(a, a)).toBe(true);
    expect(hashesIguales(a, b)).toBe(false);
    expect(hashesIguales(a, "abcd")).toBe(false);
  });
});

describe("tipo real de los archivos", () => {
  const bytes = (...valores: number[]) => new Uint8Array([...valores, ...new Array(20).fill(0)]);

  it("reconoce PDF, JPG, PNG y WEBP por sus primeros bytes", () => {
    expect(detectarTipoReal(bytes(0x25, 0x50, 0x44, 0x46))).toBe("application/pdf");
    expect(detectarTipoReal(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(detectarTipoReal(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");

    const webp = new Uint8Array(20);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(detectarTipoReal(webp)).toBe("image/webp");
  });

  it("no se deja engañar por un ejecutable con nombre de PDF", () => {
    expect(detectarTipoReal(bytes(0x4d, 0x5a))).toBeNull(); // .exe
    expect(detectarTipoReal(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // .zip
    expect(detectarTipoReal(new Uint8Array())).toBeNull();
  });
});
