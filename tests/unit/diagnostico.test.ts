import { describe, expect, it } from "vitest";
import { describirError, estadoDeConsulta } from "@/lib/diagnostico";

/*
 * El chequeo llegó a mostrar "error (?): " en producción: sin código y sin
 * mensaje, porque preguntaba con un HEAD y una respuesta HEAD no trae cuerpo.
 * Un renglón así manda a buscar el problema donde no está.
 */

describe("cómo se cuenta un error en /api/salud", () => {
  it("dice el código y el mensaje de PostgREST", () => {
    expect(
      describirError({ code: "42501", message: "permission denied for table rentals" }),
    ).toBe("error (42501): permission denied for table rentals");
  });

  it("nunca queda vacío, aunque el error no traiga nada", () => {
    const texto = describirError({ code: "", message: "" });
    expect(texto).toBe("error (sin código): sin mensaje");
    expect(describirError({})).toBe("error (sin código): sin mensaje");
  });

  it("si no hay mensaje, usa lo que haya", () => {
    expect(describirError({ code: "PGRST205", details: "la tabla no está en el caché" })).toBe(
      "error (PGRST205): la tabla no está en el caché",
    );
    expect(describirError({ hint: "probá recargando el esquema" })).toBe(
      "error (sin código): probá recargando el esquema",
    );
  });

  it("suma la pista cuando además hay mensaje", () => {
    expect(
      describirError({
        code: "PGRST205",
        message: "Could not find the table 'public.pagos'",
        hint: "Perhaps you meant 'public.payments'",
      }),
    ).toBe(
      "error (PGRST205): Could not find the table 'public.pagos' · Perhaps you meant 'public.payments'",
    );
  });
});

describe("el estado de una consulta", () => {
  it("sin error, ok", () => {
    expect(estadoDeConsulta({ error: null })).toBe("ok");
  });

  it("si no contestó, lo dice", () => {
    expect(estadoDeConsulta("timeout")).toBe("no respondió a tiempo");
  });

  it("con error, lo describe entero", () => {
    expect(estadoDeConsulta({ error: { code: "PGRST205", message: "no existe" } })).toBe(
      "error (PGRST205): no existe",
    );
  });
});
