import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
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
function marco(opciones: { titulo: string; cuerpo: string; siteUrl: string; pie?: string }): string {
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
      ${opciones.pie ?? "Te escribimos porque compartís un alquiler en Inkey."}
      <br>Inkey · Tu historial de alquiler, confirmado
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
  const mes = nombrePeriodo(datos.periodo);
  const monto = formatearMonto(datos.monto, datos.moneda);

  const asunto = recordatorio
    ? `Te falta confirmar el pago de ${mes}`
    : `${limpio(datos.nombreInquilino)} pagó ${mes}`;

  const cuerpo = `
    <h1 style="${h1}">${recordatorio ? "Te falta confirmar un pago" : "¿Te llegó este pago?"}</h1>
    <p style="${p}">
      ${
        recordatorio
          ? `Hace unos días ${esc(datos.nombreInquilino)} reportó el pago de ${mes} en ${esc(datos.barrio)} y todavía no nos dijiste si te llegó.`
          : `${esc(datos.nombreInquilino)} reportó que pagó el alquiler de ${mes} en ${esc(datos.barrio)}.`
      }
    </p>
    ${ficha([
      ["Monto", monto],
      ["Lo pagó el", formatearFecha(datos.pagadoEl)],
      ["Período", mes],
    ])}
    <p style="${p}">Respondé desde acá, sin entrar ni crear contraseña:</p>
    <div style="margin:0 0 12px;">${boton(datos.urlConfirmar, "Recibido", "confirmado")}</div>
    <div>${boton(datos.urlNoRecibido, "Todavía no me llegó", "suave")}</div>
  `;

  const texto = [
    recordatorio ? "Te falta confirmar un pago" : "¿Te llegó este pago?",
    "",
    `${limpio(datos.nombreInquilino)} reportó que pagó ${mes} en ${limpio(datos.barrio)}.`,
    `Monto: ${monto}`,
    `Lo pagó el: ${formatearFecha(datos.pagadoEl)}`,
    "",
    `Confirmar que lo recibiste: ${datos.urlConfirmar}`,
    `Decir que todavía no llegó: ${datos.urlNoRecibido}`,
  ].join("\n");

  return { asunto, html: marco({ titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/** Al inquilino: el dueño confirmó. */
export function pagoConfirmado(datos: {
  periodo: string;
  barrio: string;
  monto: string;
  moneda: Moneda;
  urlRecibo: string;
  siteUrl: string;
}): Mail {
  const mes = nombrePeriodo(datos.periodo);
  const asunto = `Tu dueño confirmó el pago de ${mes}`;

  const cuerpo = `
    <div style="display:inline-block;background:${COLORES.confirmadoTinte};color:${COLORES.confirmadoTinta};font:600 13px/1 ${FUENTE};letter-spacing:1px;text-transform:uppercase;padding:8px 12px;border-radius:12px;margin:0 0 16px;">Confirmado</div>
    <h1 style="${h1}">Listo, quedó confirmado</h1>
    <p style="${p}">
      Tu dueño confirmó el pago de ${mes} en ${esc(datos.barrio)}. Ese mes ya suma a tu historial, y los
      dos tienen el recibo.
    </p>
    ${ficha([
      ["Monto", formatearMonto(datos.monto, datos.moneda)],
      ["Período", mes],
    ])}
    <div>${boton(datos.urlRecibo, "Descargar el recibo", "marca")}</div>
  `;

  const texto = [
    "Listo, quedó confirmado.",
    "",
    `Tu dueño confirmó el pago de ${mes} en ${limpio(datos.barrio)}.`,
    `Descargá el recibo: ${datos.urlRecibo}`,
  ].join("\n");

  return { asunto, html: marco({ titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/** A quien recibe una invitación a confirmar un alquiler. */
export function invitacion(datos: {
  quien: string;
  barrio: string;
  rol: "owner" | "tenant";
  url: string;
  siteUrl: string;
}): Mail {
  const asunto = `${limpio(datos.quien)} te invita a confirmar un alquiler en Inkey`;
  const comoQue = datos.rol === "owner" ? "dueño" : "inquilino";

  const cuerpo = `
    <h1 style="${h1}">${esc(datos.quien)} te invita a confirmar un alquiler</h1>
    <p style="${p}">
      Registró el alquiler de ${esc(datos.barrio)} en Inkey y te suma como ${comoQue}. En Inkey las dos
      partes confirman cada pago: así el historial vale, porque nadie puede inventarse un mes.
    </p>
    <p style="${p}">Abrí el link, mirá el resumen y confirmá si es correcto.</p>
    <div>${boton(datos.url, "Ver la invitación", "marca")}</div>
    <p style="${p}margin-top:20px;font-size:14px;color:${COLORES.muted};">
      Si no es tu propiedad, desde ahí mismo podés decirlo. El link vence en 7 días.
    </p>
  `;

  const texto = [
    `${limpio(datos.quien)} te invita a confirmar el alquiler de ${limpio(datos.barrio)} en Inkey.`,
    "",
    `Abrí el link: ${datos.url}`,
    "El link vence en 7 días.",
  ].join("\n");

  return {
    asunto,
    html: marco({
      titulo: asunto,
      cuerpo,
      siteUrl: datos.siteUrl,
      pie: "Te escribimos porque alguien te invitó a confirmar un alquiler en Inkey.",
    }),
    texto,
  };
}

/** A quien invitó: la otra parte respondió. */
export function invitacionRespondida(datos: {
  acepto: boolean;
  barrio: string;
  url: string;
  siteUrl: string;
}): Mail {
  const asunto = datos.acepto
    ? `Confirmaron el alquiler de ${limpio(datos.barrio)}`
    : `No confirmaron el alquiler de ${limpio(datos.barrio)}`;

  const cuerpo = datos.acepto
    ? `
      <h1 style="${h1}">Listo, ya está confirmado</h1>
      <p style="${p}">
        La otra parte confirmó el alquiler de ${esc(datos.barrio)}. Desde ahora van a ir confirmando
        cada pago, mes a mes.
      </p>
      <div>${boton(datos.url, "Ver el alquiler", "marca")}</div>`
    : `
      <h1 style="${h1}">Esa propiedad no era suya</h1>
      <p style="${p}">
        Quien recibió el link de ${esc(datos.barrio)} dijo que no es su propiedad. Puede que te hayas
        equivocado de contacto: cargá el alquiler de nuevo con los datos correctos.
      </p>
      <div>${boton(datos.url, "Ver el alquiler", "suave")}</div>`;

  const texto = datos.acepto
    ? `Confirmaron el alquiler de ${limpio(datos.barrio)}. Verlo: ${datos.url}`
    : `Quien recibió el link de ${limpio(datos.barrio)} dijo que no es su propiedad. Verlo: ${datos.url}`;

  return { asunto, html: marco({ titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/** A las dos partes, cuando el contrato termina. */
export function contratoTerminado(datos: {
  barrio: string;
  quien: string;
  url: string;
  siteUrl: string;
}): Mail {
  const asunto = `Terminó el alquiler de ${limpio(datos.barrio)}: contá cómo fue`;

  const cuerpo = `
    <h1 style="${h1}">Terminó el alquiler de ${esc(datos.barrio)}</h1>
    <p style="${p}">
      Los dos confirmaron que el contrato terminó. Ahora pueden dejarse una reseña: etiquetas
      rápidas y, si querés, unas líneas.
    </p>
    <p style="${p}">
      Nadie ve tu reseña hasta que ${esc(datos.quien)} deje la suya, o hasta 14 días después. Así nadie
      escribe mirando lo que dijo el otro.
    </p>
    <div>${boton(datos.url, "Dejar mi reseña", "marca")}</div>
  `;

  const texto = [
    `Terminó el alquiler de ${limpio(datos.barrio)}.`,
    "",
    `Dejá tu reseña: ${datos.url}`,
    `Nadie la ve hasta que ${limpio(datos.quien)} deje la suya, o hasta 14 días después.`,
  ].join("\n");

  return { asunto, html: marco({ titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}

/**
 * A la contraparte: alguien con quien compartís un alquiler se dio de baja y
 * sus comprobantes se van a borrar. Tiene 30 días para descargarlos.
 *
 * El tono importa: no es una mala noticia ni un reclamo. Es un aviso para que
 * nadie se quede sin su respaldo.
 */
export function comprobantesPorBorrar(datos: {
  barrio: string;
  url: string;
  vence: string;
  siteUrl: string;
}): Mail {
  const asunto = `Descargá los comprobantes de ${limpio(datos.barrio)} antes del ${formatearFecha(datos.vence)}`;

  const cuerpo = `
    <h1 style="${h1}">Guardá los comprobantes que necesites</h1>
    <p style="${p}">
      La otra parte del alquiler de ${esc(datos.barrio)} dio de baja su cuenta. Los comprobantes y el
      contrato que había subido se borran el ${formatearFecha(datos.vence)}.
    </p>
    <p style="${p}">
      Hasta esa fecha podés descargarlos desde el alquiler. Tu historial de pagos confirmados no se
      toca: ese también es tuyo y queda como está.
    </p>
    <div>${boton(datos.url, "Ver el alquiler", "marca")}</div>
  `;

  const texto = [
    "Guardá los comprobantes que necesites.",
    "",
    `La otra parte del alquiler de ${limpio(datos.barrio)} dio de baja su cuenta.`,
    `Los archivos que había subido se borran el ${formatearFecha(datos.vence)}.`,
    `Descargalos desde acá: ${datos.url}`,
    "",
    "Tu historial de pagos confirmados no se toca.",
  ].join("\n");

  return { asunto, html: marco({ titulo: asunto, cuerpo, siteUrl: datos.siteUrl }), texto };
}
