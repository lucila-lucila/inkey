import type { Traductor } from "@/i18n/texto";
import type { Moneda, RolAlquiler } from "@/lib/validation/rental";

/** El tono de cada estado. El texto vive en `dominio.estadoAlquiler`. */
export const ESTADOS_ALQUILER = {
  pending: { tono: "primary" },
  active: { tono: "confirm" },
  pending_end: { tono: "primary" },
  ended: { tono: "neutral" },
  rejected: { tono: "neutral" },
} as const;

export type EstadoAlquiler = keyof typeof ESTADOS_ALQUILER;

/*
 * El signo va pegado al número con un espacio duro: "$ 450.000" es una sola
 * cosa y no puede partirse al final de un renglón, ni en pantalla, ni en el
 * mail, ni en el PDF.
 */
const ESPACIO_DURO = "\u00a0";

export function formatearMonto(monto: number | string, moneda: Moneda): string {
  const numero = typeof monto === "string" ? Number(monto) : monto;
  const formateado = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numero);
  // Los dólares se muestran tal cual: no convertimos nada.
  const signo = moneda === "USD" ? "US$" : "$";
  return `${signo}${ESPACIO_DURO}${formateado}`;
}

/*
 * Los miles mientras se escribe, para el campo donde se carga un monto.
 * "450000" obliga a contar ceros; "450.000" se lee de un vistazo.
 */
export function conSeparadores(valor: string): string {
  // Solo dígitos y una coma decimal: lo demás se cae solo.
  const limpio = valor.replace(/[^\d,]/g, "");
  const [enteros, ...resto] = limpio.split(",");
  const agrupados = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // Una sola coma, aunque escriban varias.
  return resto.length > 0 ? `${agrupados},${resto.join("")}` : agrupados;
}

/*
 * El valor inicial del campo. Llega como numérico de la base ("450000.00"),
 * donde el punto es el decimal y no el separador de miles: por eso se lee
 * como número y recién después se le ponen los puntos de los miles.
 */
export function montoParaCampo(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  return conSeparadores(String(numero).replace(".", ","));
}

/*
 * El orden es siempre el de acá: día, mes, año. Lo único que cambia con el
 * idioma es el nombre del mes, porque "septiembre" adentro de una frase en
 * inglés no lo lee nadie. `en-GB` usa el mismo orden que `es-AR`, así que la
 * fecha se ve igual en los dos: "21 de septiembre de 2026" / "21 September
 * 2026".
 */
export function intlDe(idioma: string): string {
  return idioma === "en" ? "en-GB" : "es-AR";
}

export function formatearFecha(fecha: string | null | undefined, idioma = "es"): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat(intlDe(idioma), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

/**
 * Día de vencimiento de un período. Si el mes no tiene ese día (31 en
 * febrero), vence el último día del mes.
 */
export function vencimientoDelPeriodo(anio: number, mes: number, diaVencimiento: number): Date {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes - 1, Math.min(diaVencimiento, ultimoDia)));
}

/*
 * El día de vencimiento, en palabras. Del 29 en adelante hace falta la
 * aclaración: febrero no tiene 30.
 */
export function claveDeVencimiento(diaVencimiento: number): string {
  return diaVencimiento >= 29 ? "dominio.vencimiento.conAclaracion" : "dominio.vencimiento.simple";
}

/** Quién falta en el alquiler: a quién hay que invitar. */
export function rolInvitado(rolDeQuienCrea: RolAlquiler): "owner" | "tenant" {
  return rolDeQuienCrea === "inquilino" ? "owner" : "tenant";
}

export function claveDeRol(rol: "owner" | "tenant"): string {
  return rol === "owner" ? "dominio.rol.owner" : "dominio.rol.tenant";
}

/** Mensaje armado para mandar por WhatsApp. */
export function mensajeInvitacion(opciones: {
  t: Traductor;
  rolInvitado: "owner" | "tenant";
  nombre: string;
  barrio: string;
  url: string;
}): string {
  const { t, rolInvitado: rol, nombre, barrio, url } = opciones;
  const presentacion = nombre ? t("mensajes.soy", { nombre }) : "";
  const cuerpo = t(rol === "owner" ? "mensajes.invitarDueno" : "mensajes.invitarInquilino", {
    presentacion,
    barrio,
  });

  return `${cuerpo}\n\n${url}`;
}

export function enlaceWhatsApp(mensaje: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}

export function enlaceMail(opciones: { asunto: string; mensaje: string }): string {
  return `mailto:?subject=${encodeURIComponent(opciones.asunto)}&body=${encodeURIComponent(opciones.mensaje)}`;
}
