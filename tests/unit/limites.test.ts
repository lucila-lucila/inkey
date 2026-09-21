import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIMITES } from "@/lib/ratelimit";

/*
 * Toda acción que escriba tiene que pasar por el limitador.
 *
 * El test lee el código: si mañana alguien suma una acción nueva que llama a
 * una función que escribe en la base y se olvida del límite, esto se pone en
 * rojo. Es más confiable que acordarse.
 */

const RAIZ = new URL("../../src/app/", import.meta.url).pathname;

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return ruta.endsWith(".ts") || ruta.endsWith(".tsx") ? [ruta] : [];
  });
}

/** Las funciones de base que cambian algo. Leer no necesita límite. */
const ESCRIBEN = [
  "payment_report",
  "payment_confirm",
  "payment_not_received",
  "payment_confirm_with_token",
  "payment_not_received_with_token",
  "review_submit",
  "invitation_accept",
  "invitation_reject",
  "account_delete",
  "account_export",
];

/*
 * Las excepciones, con su motivo. Una excepción sin motivo es un olvido
 * disfrazado.
 */
const EXCEPCIONES: Record<string, string> = {
  "api/cron/recordatorios/route.ts":
    "lo dispara Vercel con el secreto del cron, no una persona",
  "(app)/cuenta/actions.ts":
    "darse de baja es un derecho: un limitador no puede dejar a nadie encerrado en su cuenta",
};

describe("límites de frecuencia", () => {
  const sospechosos = archivos(RAIZ)
    .map((ruta) => ({ ruta, fuente: readFileSync(ruta, "utf8") }))
    .filter(({ fuente }) => ESCRIBEN.some((rpc) => fuente.includes(`rpc("${rpc}"`)));

  it("encuentra las acciones que escriben", () => {
    // Si este número baja de golpe, el test dejó de mirar lo que tenía que mirar.
    expect(sospechosos.length).toBeGreaterThanOrEqual(6);
  });

  for (const { ruta, fuente } of sospechosos) {
    const relativa = ruta.slice(RAIZ.length);
    const motivo = EXCEPCIONES[relativa];

    it(`${relativa}${motivo ? " (exceptuada)" : ""}`, () => {
      if (motivo) {
        expect(motivo.length, "la excepción tiene que tener un motivo escrito").toBeGreaterThan(20);
        return;
      }
      expect(fuente, `${relativa} escribe en la base sin pasar por el limitador`).toContain(
        "consumirIntento(",
      );
    });
  }
});

describe("las reglas", () => {
  it("cubren las acciones que decía la auditoría", () => {
    for (const accion of ["confirmacion_pago", "resena", "export_datos"]) {
      expect(LIMITES).toHaveProperty(accion);
    }
  });

  it("son holgadas para una persona y apretadas para un script", () => {
    for (const [accion, regla] of Object.entries(LIMITES)) {
      expect(regla.limite, accion).toBeGreaterThanOrEqual(5);
      expect(regla.limite, accion).toBeLessThanOrEqual(50);
      expect(regla.ventanaSegundos, accion).toBeGreaterThanOrEqual(15 * 60);
    }
  });
});
