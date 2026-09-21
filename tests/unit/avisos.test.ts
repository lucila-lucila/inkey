import { describe, expect, it } from "vitest";
import {
  contratoTerminado,
  invitacion,
  invitacionRespondida,
  pagoConfirmado,
  pagoReportado,
} from "@/lib/email/plantillas";
import {
  DIAS_PARA_INSISTIR,
  diasDesde,
  mensajeInsistirPago,
  sePuedeInsistir,
} from "@/lib/domain/pagos";

const SITE = "https://inkey.test";

const PAGO = {
  nombreInquilino: "Martina R.",
  periodo: "2026-09-01",
  monto: "450000",
  moneda: "ARS" as const,
  pagadoEl: "2026-09-08",
  barrio: "Palermo, CABA",
  siteUrl: SITE,
  urlConfirmar: `${SITE}/pagos/confirmar/abc123`,
  urlNoRecibido: `${SITE}/pagos/confirmar/abc123?respuesta=no`,
};

/** Todos los mails tienen que poder leerse sin HTML y no filtrar de más. */
function revisarMail(mail: { asunto: string; html: string; texto: string }) {
  expect(mail.asunto.length).toBeGreaterThan(0);
  expect(mail.asunto.length).toBeLessThanOrEqual(78);
  expect(mail.html).toContain("<!doctype html>");
  expect(mail.texto.trim().length).toBeGreaterThan(0);
  // Sin `<script>` ni fuentes externas: los clientes de correo no los corren.
  expect(mail.html).not.toContain("<script");
  expect(mail.html).not.toContain("fonts.googleapis");
}

describe("plantillas de mail", () => {
  it("el aviso de pago reportado lleva las dos respuestas", () => {
    const mail = pagoReportado(PAGO);
    revisarMail(mail);

    expect(mail.asunto).toBe("Martina R. pagó septiembre de 2026");
    expect(mail.html).toContain(PAGO.urlConfirmar);
    expect(mail.html).toContain(PAGO.urlNoRecibido);
    expect(mail.texto).toContain(PAGO.urlConfirmar);
    expect(mail.html).toContain("450.000");
  });

  it("el recordatorio dice que ya pasaron unos días, sin retar a nadie", () => {
    const mail = pagoReportado(PAGO, true);
    revisarMail(mail);

    expect(mail.asunto).toBe("Te falta confirmar el pago de septiembre de 2026");
    expect(mail.html).toContain("todavía no nos dijiste");
    for (const palabra of ["deuda", "moroso", "incumpl", "reclamo"]) {
      expect(mail.html.toLowerCase()).not.toContain(palabra);
    }
  });

  it("el aviso de confirmado lleva al recibo", () => {
    const mail = pagoConfirmado({
      periodo: "2026-09-01",
      barrio: "Palermo, CABA",
      monto: "450000",
      moneda: "ARS",
      urlRecibo: `${SITE}/pagos/abc/recibo`,
      siteUrl: SITE,
    });
    revisarMail(mail);

    expect(mail.html).toContain(`${SITE}/pagos/abc/recibo`);
    expect(mail.html).toContain("Confirmado");
  });

  it("la invitación dice quién invita, para qué y cuánto dura", () => {
    const mail = invitacion({
      quien: "Martina R.",
      barrio: "Palermo, CABA",
      rol: "owner",
      url: `${SITE}/invitacion/xyz`,
      siteUrl: SITE,
    });
    revisarMail(mail);

    expect(mail.html).toContain(`${SITE}/invitacion/xyz`);
    expect(mail.html).toContain("dueño");
    expect(mail.texto).toContain("vence en 7 días");
  });

  it("la respuesta a la invitación cambia según qué contestaron", () => {
    const si = invitacionRespondida({
      acepto: true,
      barrio: "Palermo, CABA",
      url: `${SITE}/alquileres/1`,
      siteUrl: SITE,
    });
    const no = invitacionRespondida({
      acepto: false,
      barrio: "Palermo, CABA",
      url: `${SITE}/alquileres/1`,
      siteUrl: SITE,
    });
    revisarMail(si);
    revisarMail(no);

    expect(si.asunto).toContain("Confirmaron");
    expect(no.asunto).toContain("No confirmaron");
  });

  it("el fin de contrato explica que la reseña no se ve enseguida", () => {
    const mail = contratoTerminado({
      barrio: "Palermo, CABA",
      quien: "Jorge L.",
      url: `${SITE}/alquileres/1`,
      siteUrl: SITE,
    });
    revisarMail(mail);

    expect(mail.html).toContain("14 días");
    expect(mail.texto).toContain("Jorge L.");
  });
});

describe("insistirle al dueño", () => {
  const reportado = { status: "reported", reported_at: "2026-09-08T12:00:00Z" };

  it("cuenta los días desde el reporte", () => {
    expect(diasDesde(reportado.reported_at, new Date("2026-09-15T12:00:00Z"))).toBe(7);
    expect(diasDesde("no es una fecha")).toBe(0);
  });

  it("recién se puede a la semana", () => {
    expect(sePuedeInsistir(reportado, new Date("2026-09-10T12:00:00Z"))).toBe(false);
    expect(
      sePuedeInsistir(
        reportado,
        new Date(`2026-09-${8 + DIAS_PARA_INSISTIR}T12:00:00Z`),
      ),
    ).toBe(true);
  });

  it("no se insiste por un pago que ya se respondió", () => {
    expect(
      sePuedeInsistir({ ...reportado, status: "confirmed" }, new Date("2026-10-01T12:00:00Z")),
    ).toBe(false);
    expect(
      sePuedeInsistir({ ...reportado, status: "not_received" }, new Date("2026-10-01T12:00:00Z")),
    ).toBe(false);
    expect(sePuedeInsistir({ status: "reported", reported_at: null })).toBe(false);
  });

  it("el mensaje lleva al pago en la app, nunca al link del mail", () => {
    const mensaje = mensajeInsistirPago({
      mes: "septiembre de 2026",
      barrio: "Palermo, CABA",
      url: `${SITE}/pagos/abc`,
    });

    expect(mensaje).toContain(`${SITE}/pagos/abc`);
    // El link que confirma sin sesión es del dueño y no puede viajar acá.
    expect(mensaje).not.toContain("/pagos/confirmar/");
    expect(mensaje).toContain("septiembre de 2026");
  });
});
