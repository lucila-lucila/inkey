import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizarSitio } from "@/lib/env";

/*
 * Vercel valida `vercel.json` contra su esquema ANTES de compilar: si hay una
 * propiedad que no conoce, el deploy muere en dos segundos y nada se publica.
 * Nos pasó con un `comment` dentro del cron. Este test es para que no vuelva a
 * pasar, porque el error no se ve en ningún test de la app.
 */

type Cron = { path: string; schedule: string };

const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  crons?: Cron[];
};

describe("vercel.json", () => {
  const crons = config.crons ?? [];

  it("cada cron tiene solo las dos propiedades que Vercel acepta", () => {
    for (const cron of crons) {
      expect(Object.keys(cron).sort()).toEqual(["path", "schedule"]);
    }
  });

  it("el endpoint de cada cron existe en el repo", () => {
    for (const cron of crons) {
      expect(cron.path.startsWith("/")).toBe(true);
      expect(existsSync(`src/app${cron.path}/route.ts`)).toBe(true);
    }
  });

  /*
   * El plan Hobby permite hasta dos crons y como mucho uno por día. Una
   * expresión más frecuente (`0 * * * *`) no se "degrada": hace fallar el
   * deploy entero.
   */
  it("entra en el plan Hobby: como mucho dos, y una vez por día", () => {
    expect(crons.length).toBeLessThanOrEqual(2);

    for (const cron of crons) {
      const campos = cron.schedule.trim().split(/\s+/);
      expect(campos).toHaveLength(5);

      const [minuto, hora] = campos;
      // Minuto y hora fijos: cualquier `*`, `*/n` o lista dispara más de una
      // vez por día.
      expect(minuto).toMatch(/^\d{1,2}$/);
      expect(hora).toMatch(/^\d{1,2}$/);
    }
  });
});

describe("el dominio del sitio", () => {
  it("acepta el dominio bien escrito", () => {
    expect(normalizarSitio("https://www.inkeyapp.com")).toBe("https://www.inkeyapp.com");
  });

  it("perdona la barra final y los espacios", () => {
    expect(normalizarSitio(" https://www.inkeyapp.com/ ")).toBe("https://www.inkeyapp.com");
  });

  it("completa el https si se cargó sin protocolo", () => {
    // Antes esto hacía fallar el build entero, no solo los links.
    expect(normalizarSitio("www.inkeyapp.com")).toBe("https://www.inkeyapp.com");
  });

  it("cae a localhost si no hay nada usable, sin romper nada", () => {
    expect(normalizarSitio(null)).toBe("http://localhost:3000");
    expect(normalizarSitio("  ")).toBe("http://localhost:3000");
    expect(normalizarSitio("javascript:alert(1)")).toBe("http://localhost:3000");
  });

  it("sirve de base para armar un link", () => {
    const url = new URL("/pagos/abc", normalizarSitio("https://www.inkeyapp.com"));
    expect(url.toString()).toBe("https://www.inkeyapp.com/pagos/abc");
  });
});
