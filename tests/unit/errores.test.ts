import { afterEach, describe, expect, it, vi } from "vitest";
import { conRedDeSeguridad, mensajeInesperado, registrarFalla } from "@/lib/errores";
import { variablesFaltantes } from "@/lib/env";
import { pasoDelCampo, PASOS_ALQUILER } from "@/lib/validation/rental";

afterEach(() => vi.restoreAllMocks());

describe("nada falla en silencio", () => {
  it("una excepción se convierte en un mensaje con código de referencia", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await conRedDeSeguridad(
      "prueba",
      async () => {
        throw new Error("se rompió todo");
      },
      (mensaje) => ({ estado: "error" as const, mensaje }),
    );

    expect(resultado.estado).toBe("error");
    expect(resultado.mensaje).toContain("código");
    // El código de referencia tiene que estar, para buscarlo en los logs.
    expect(resultado.mensaje).toMatch(/[0-9a-f]{6}/);
  });

  it("el mismo código va a los logs del servidor", () => {
    const logs: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => void logs.push(args));

    const ref = registrarFalla("contexto", new Error("ups"));

    expect(String(logs[0]?.[0])).toContain(`[inkey:${ref}]`);
    expect(mensajeInesperado(ref)).toContain(ref);
  });

  it("no se traga los redirect de Next", async () => {
    const redireccion = Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;push;/panel" });

    await expect(
      conRedDeSeguridad(
        "prueba",
        async () => {
          throw redireccion;
        },
        (mensaje) => ({ estado: "error" as const, mensaje }),
      ),
    ).rejects.toBe(redireccion);
  });
});

describe("configuración", () => {
  it("avisa qué variables faltan, sin decir ningún valor", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "una-clave");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("RATE_LIMIT_SALT", "");

    const faltan = variablesFaltantes();

    expect(faltan.imprescindibles).toEqual([]);
    expect(faltan.secundarias).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(faltan.secundarias).toContain("RATE_LIMIT_SALT");
    expect(JSON.stringify(faltan)).not.toContain("una-clave");

    vi.unstubAllEnvs();
  });
});

describe("errores de campo", () => {
  it("todos los campos del formulario saben a qué paso pertenecen", () => {
    // Si un campo no está en ningún paso, un error suyo quedaría invisible.
    const campos = [
      "full_address",
      "neighborhood_label",
      "start_date",
      "end_date",
      "monthly_amount",
      "currency",
      "due_day",
      "adjustment_index",
      "adjustment_every_months",
      "contrato",
    ];

    for (const campo of campos) {
      expect(pasoDelCampo(campo), `el campo ${campo} no está en ningún paso`).not.toBeNull();
    }
  });

  it("ningún campo quedó fuera de los pasos declarados", () => {
    const enPasos = PASOS_ALQUILER.flatMap((paso) => [...paso.campos]);
    expect(new Set(enPasos).size).toBe(enPasos.length);
  });

  it("un campo desconocido no rompe nada", () => {
    expect(pasoDelCampo("inventado")).toBeNull();
  });
});

describe("el rate limiting es una protección secundaria", () => {
  it("sin sal configurada se apaga, y no rompe la acción", async () => {
    vi.stubEnv("RATE_LIMIT_SALT", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { identificadorCliente, consumirIntento } = await import("@/lib/ratelimit");

    // Sin sal no hay identificador...
    const identificador = await identificadorCliente();
    expect(identificador).toBeNull();

    // ...y sin identificador el intento se permite en vez de fallar.
    const resultado = await consumirIntento("invitacion", identificador);
    expect(resultado.permitido).toBe(true);

    vi.unstubAllEnvs();
  });
});
