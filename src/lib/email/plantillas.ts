import type { Traductor } from "@/i18n/texto";
import { claveDeRol, formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { nombrePeriodo } from "@/lib/domain/pagos";
import type { Moneda } from "@/lib/validation/rental";

/*
 * Los mails, en la identidad de la marca (docs/identidad.md) pero con las
 * limitaciones del correo: estilos en línea, tipografías del sistema y un PNG
 * como marca, porque muchos clientes no muestran SVG.
 *
 * El tono es el mismo que en la app: voseo, frases cortas y nada de jerga.
 */

const COLORES = {
  bg: "#FFF6EA",
  surface: "#FFFFFF",
  hundido: "#F1E7D8",
  ink: "#23201C",
  body: "#57504A",
  muted: "#8B8179",
  linea: "#E6DACA",
  marca: "#B8451A",
  onMarca: "#FFF6EA",
  confirmado: "#2F7A5F",
  confirmadoTinte: "#E8F0EB",
  confirmadoTinta: "#24614B",
};

const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export type Mail = { asunto: string; html: string; texto: string };

/*
 * El idioma del mail sale del traductor de quien lo recibe. Lo guardamos en
 * el propio traductor para no tener que pasarlo dos veces a cada plantilla.
 */
function idiomaDe(t: Traductor): string {
  return t("mail.codigoIdioma");
}

/*
 * Nombres y barrios los escribe la gente, y acá terminan dentro de HTML. Un
 * cliente de correo no corre JavaScript, pero sí dibuja etiquetas: sin esto,
 * alguien podría llamarse `<a href="...">` y meter un link en un mail nuestro.
 */
function esc(valor: string): string {
  return limpio(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Sin saltos de línea ni caracteres de control: van al asunto y al texto. */
function limpio(valor: string): string {
  return String(valor ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

function boton(url: string, texto: string, tono: "marca" | "confirmado" | "suave"): string {
  const fondo =
    tono === "confirmado" ? COLORES.confirmado : tono === "marca" ? COLORES.marca : COLORES.hundido;
  const color = tono === "suave" ? COLORES.ink : "#FFFFFF";

  return `<a href="${url}" style="display:inline-block;background:${fondo};color:${color};font:600 16px/1 ${FUENTE};text-decoration:none;padding:16px 28px;border-radius:999px;">${texto}</a>`;
}

/*
 * El armazón de todos los mails. `cuerpo` es HTML que armamos nosotros y entra
 * tal cual; el título viene del asunto, que puede llevar el nombre de alguien,
 * así que se escapa acá también.
 */
function marco(opciones: {
  t: Traductor;
  titulo: string;
  cuerpo: string;
  siteUrl: string;
  pie?: string;
}): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(opciones.titulo)}</title></head>
<body style="margin:0;padding:24px 12px;background:${COLORES.bg};font-family:${FUENTE};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding:8px 4px 20px;">
      <span style="font:700 28px/1 ${FUENTE};letter-spacing:-1.1px;color:${COLORES.ink};vertical-align:baseline;">inkey</span><img src="${opciones.siteUrl}/brand/inkey-simbolo.png" width="24" height="10" alt="" style="vertical-align:baseline;margin-left:2px;border:0;">
    </td></tr>
    <tr><td style="background:${COLORES.surface};border-radius:24px;padding:28px;">
      ${opciones.cuerpo}
    </td></tr>
    <tr><td style="padding:20px 8px;font:400 13px/1.5 ${FUENTE};color:${COLORES.muted};">
      ${opciones.pie ?? opciones.t("mail.pieGenerico")}
      <br>${opciones.t("mail.firma")}
    </td></tr>
  </table>
</body></html>`;
}

const h1 = `font:700 24px/1.2 ${FUENTE};letter-spacing:-0.6px;color:${COLORES.ink};margin:0 0 12px;`;
const p = `font:400 16px/1.6 ${FUENTE};color:${COLORES.body};margin:0 0 16px;`;
const dato = `font:400 15px/1.6 ${FUENTE};color:${COLORES.body};margin:0;`;

function ficha(filas: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORES.hundido};border-radius:16px;padding:16px;margin:0 0 20px;"><tr><td>
    ${filas
      .map(
        ([etiqueta, valor]) =>
          `<div style="${dato}"><span style="color:${COLORES.muted};">${etiqueta}:</span> <strong style="color:${COLORES.ink};">${valor}</strong></div>`,
      )
      .join("")}
  </td></tr></table>`;
}

export type DatosPago = {
  /* En el idioma de quien recibe el mail, no en el de quien lo dispara. */
  t: Traductor;
  nombreInquilino: string;
  periodo: string;
  monto: string;
  moneda: Moneda;
  pagadoEl: string;
  barrio: string;
  siteUrl: string;
};

/** Al dueño: su inquilino reportó el pago del mes. */
export function pagoReportado(
  datos: DatosPago & { urlConfirmar: string; urlNoRecibido: string },
  recordatorio = false,
): Mail {
  const mes = nombrePeriodo(datos.periodo, idiomaDe(datos.t));
  const monto = formatearMonto(datos.monto, datos.moneda);

  const t = datos.t;
  const asunto = recordatorio
    ? t("mail.pagoAsuntoRecordatorio", { mes })
    : t("mail.pagoAsunto", { quien: limpio(datos.nombreInquilino), mes });

  const cuerpo = `
    <h1 style="${h1}">${recordatorio ? t("mail.pagoTituloRecordatorio") : t("mail.pagoTitulo")}</h1>
    <p style="${p}">
      ${
        recordatorio
          ? t("mail.pagoCuerpoRecordatorio", {
              quien: esc(datos.nombreInquilino),
              mes,
              barrio: esc(datos.barrio),
            })
          : t("mail.pagoCuerpo", {
              quien: esc(datos.nombreInquilino),
              mes,
              barrio: esc(datos.barrio),
            })
      }
    </p>
    ${ficha([
      [t("mail.monto"), monto],
      [t("mail.loPagoEl"), formatearFecha(datos.pagadoEl, idiomaDe(t))],
      [t("mail.periodo"), mes],
    ])}
    <p style="${p}">${t("mail.pagoRespondeDesdeAca")}</p>
    <div style="margin:0 0 12px;">${boton(datos.urlConfirmar, t("mail.recibido"), "confirmado")}</div>
    <div>${boton(datos.urlNoRecibido, t("mail.noMeLlego"), "suave")}</div>
  `;

  const texto = [
    recordatorio ? t("mail.pagoTituloRecordatorio") : t("mail.pagoTitulo"),
    "",
    t("mail.pagoCuerpo", {
      quien: limpio(datos.nombreInquilino),
      mes,
      barrio: limpio(datos.barrio),
    }),
    `${t("mail.monto")}: ${monto}`,
    `${t("mail.loPagoEl")}: ${formatearFecha(datos.pagadoEl, idiomaDe(t))}`,
    "",
    t("mail.pagoTextoConfirmar", { url: datos.urlConfirmar }),
    t("mail.pagoTextoNoLlego", { url: datos.urlNoRecibido }),
  ].join("\n");

  return { asunto, html: marco({ t, titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/** Al inquilino: el dueño confirmó. */
export function pagoConfirmado(datos: {
  t: Traductor;
  periodo: string;
  barrio: string;
  monto: string;
  moneda: Moneda;
  urlRecibo: string;
  siteUrl: string;
}): Mail {
  const t = datos.t;
  const mes = nombrePeriodo(datos.periodo, idiomaDe(t));
  const asunto = t("mail.confirmadoAsunto", { mes });

  const cuerpo = `
    <div style="display:inline-block;background:${COLORES.confirmadoTinte};color:${COLORES.confirmadoTinta};font:600 13px/1 ${FUENTE};letter-spacing:1px;text-transform:uppercase;padding:8px 12px;border-radius:12px;margin:0 0 16px;">${t("mail.confirmadoSello")}</div>
    <h1 style="${h1}">${t("mail.confirmadoTitulo")}</h1>
    <p style="${p}">
      ${t("mail.confirmadoCuerpo", { mes, barrio: esc(datos.barrio) })}
    </p>
    ${ficha([
      [t("mail.monto"), formatearMonto(datos.monto, datos.moneda)],
      [t("mail.periodo"), mes],
    ])}
    <div>${boton(datos.urlRecibo, t("mail.confirmadoBoton"), "marca")}</div>
  `;

  const texto = [
    t("mail.confirmadoTitulo"),
    "",
    t("mail.confirmadoCuerpo", { mes, barrio: limpio(datos.barrio) }),
    t("mail.confirmadoTexto", { url: datos.urlRecibo }),
  ].join("\n");

  return { asunto, html: marco({ t, titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/** A quien recibe una invitación a confirmar un alquiler. */
export function invitacion(datos: {
  t: Traductor;
  quien: string;
  barrio: string;
  rol: "owner" | "tenant";
  url: string;
  siteUrl: string;
}): Mail {
  const t = datos.t;
  const asunto = t("mail.invitacionAsunto", { quien: limpio(datos.quien) });
  const comoQue = t(claveDeRol(datos.rol));

  const cuerpo = `
    <h1 style="${h1}">${t("mail.invitacionTitulo", { quien: esc(datos.quien) })}</h1>
    <p style="${p}">
      ${t("mail.invitacionCuerpo", { barrio: esc(datos.barrio), rol: comoQue })}
    </p>
    <p style="${p}">${t("mail.invitacionAbri")}</p>
    <div>${boton(datos.url, t("mail.invitacionBoton"), "marca")}</div>
    <p style="${p}margin-top:20px;font-size:14px;color:${COLORES.muted};">
      ${t("mail.invitacionNota")}
    </p>
  `;

  const texto = [
    t("mail.invitacionTexto", { quien: limpio(datos.quien), barrio: limpio(datos.barrio) }),
    "",
    t("mail.invitacionTextoLink", { url: datos.url }),
    t("mail.invitacionTextoVence"),
  ].join("\n");

  return {
    asunto,
    html: marco({
      t,
      titulo: asunto,
      cuerpo,
      siteUrl: datos.siteUrl,
      pie: t("mail.pieInvitacion"),
    }),
    texto,
  };
}

/** A quien invitó: la otra parte respondió. */
export function invitacionRespondida(datos: {
  t: Traductor;
  acepto: boolean;
  barrio: string;
  url: string;
  siteUrl: string;
}): Mail {
  const t = datos.t;
  const asunto = datos.acepto
    ? t("mail.respuestaAsuntoSi", { barrio: limpio(datos.barrio) })
    : t("mail.respuestaAsuntoNo", { barrio: limpio(datos.barrio) });

  const cuerpo = datos.acepto
    ? `
      <h1 style="${h1}">${t("mail.respuestaTituloSi")}</h1>
      <p style="${p}">${t("mail.respuestaCuerpoSi", { barrio: esc(datos.barrio) })}</p>
      <div>${boton(datos.url, t("mail.verElAlquiler"), "marca")}</div>`
    : `
      <h1 style="${h1}">${t("mail.respuestaTituloNo")}</h1>
      <p style="${p}">${t("mail.respuestaCuerpoNo", { barrio: esc(datos.barrio) })}</p>
      <div>${boton(datos.url, t("mail.verElAlquiler"), "suave")}</div>`;

  const texto = datos.acepto
    ? t("mail.respuestaTextoSi", { barrio: limpio(datos.barrio), url: datos.url })
    : t("mail.respuestaTextoNo", { barrio: limpio(datos.barrio), url: datos.url });

  return { asunto, html: marco({ t, titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/** A las dos partes, cuando el contrato termina. */
export function contratoTerminado(datos: {
  t: Traductor;
  barrio: string;
  quien: string;
  url: string;
  siteUrl: string;
}): Mail {
  const t = datos.t;
  const asunto = t("mail.finAsunto", { barrio: limpio(datos.barrio) });

  const cuerpo = `
    <h1 style="${h1}">${t("mail.finTitulo", { barrio: esc(datos.barrio) })}</h1>
    <p style="${p}">
      ${t("mail.finCuerpo")}
    </p>
    <p style="${p}">
      ${t("mail.finNadieVe", { quien: esc(datos.quien) })}
    </p>
    <div>${boton(datos.url, t("mail.finBoton"), "marca")}</div>
  `;

  const texto = [
    t("mail.finTexto", { barrio: limpio(datos.barrio) }),
    "",
    t("mail.finTextoLink", { url: datos.url }),
    t("mail.finTextoNadieVe", { quien: limpio(datos.quien) }),
  ].join("\n");

  return { asunto, html: marco({ t, titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/**
 * A la contraparte: alguien con quien compartís un alquiler se dio de baja y
 * sus comprobantes se van a borrar. Tiene 30 días para descargarlos.
 *
 * El tono importa: no es una mala noticia ni un reclamo. Es un aviso para que
 * nadie se quede sin su respaldo.
 */
export function comprobantesPorBorrar(datos: {
  t: Traductor;
  barrio: string;
  url: string;
  vence: string;
  siteUrl: string;
}): Mail {
  const t = datos.t;
  const asunto = t("mail.archivosAsunto", {
    barrio: limpio(datos.barrio),
    fecha: formatearFecha(datos.vence, idiomaDe(t)),
  });

  const cuerpo = `
    <h1 style="${h1}">${t("mail.archivosTitulo")}</h1>
    <p style="${p}">
      ${t("mail.archivosCuerpo", { barrio: esc(datos.barrio), fecha: formatearFecha(datos.vence, idiomaDe(t)) })}
    </p>
    <p style="${p}">
      ${t("mail.archivosHasta")}
    </p>
    <div>${boton(datos.url, t("mail.verElAlquiler"), "marca")}</div>
  `;

  const texto = [
    t("mail.archivosTitulo"),
    "",
    t("mail.archivosTexto1", { barrio: limpio(datos.barrio) }),
    t("mail.archivosTexto2", { fecha: formatearFecha(datos.vence, idiomaDe(t)) }),
    t("mail.archivosTexto3", { url: datos.url }),
    "",
    t("mail.archivosTexto4"),
  ].join("\n");

  return { asunto, html: marco({ t, titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}
