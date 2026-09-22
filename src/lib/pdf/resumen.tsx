import "server-only";
import {
  Circle,
  Document,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Traductor } from "@/i18n/texto";
import { formatearFecha, formatearMonto, intlDe } from "@/lib/domain/alquiler";
import { nombrePeriodo } from "@/lib/domain/pagos";
import type { ResumenAnual } from "@/lib/domain/resumen";

/*
 * El resumen anual, en PDF. Mismo contenido que la pantalla: lo que no se
 * muestra ahí, tampoco acá.
 *
 * Tipografías estándar del formato, como en el recibo: incrustar las de la
 * marca obligaría a traer los archivos en cada render.
 */

const COLORES = {
  tinta: "#23201C",
  cuerpo: "#57504A",
  apagado: "#8B8179",
  linea: "#E6DACA",
  confirmado: "#2F7A5F",
  confirmadoTinte: "#E8F0EB",
  confirmadoTinta: "#24614B",
  marca: "#B8451A",
  hundido: "#F1E7D8",
  superficie: "#FFFFFF",
};

const estilos = StyleSheet.create({
  pagina: {
    backgroundColor: COLORES.superficie,
    color: COLORES.tinta,
    fontFamily: "Helvetica",
    fontSize: 11,
    padding: 48,
    paddingBottom: 72,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COLORES.linea,
    paddingBottom: 16,
    marginBottom: 24,
  },
  marca: { flexDirection: "row", alignItems: "center", gap: 6 },
  logo: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: -1, color: COLORES.tinta },
  sello: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: COLORES.apagado,
    textAlign: "right",
  },
  anio: { fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "right" },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 26, letterSpacing: -1, marginBottom: 4 },
  subtitulo: { color: COLORES.cuerpo, marginBottom: 24 },

  cifras: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  cifra: {
    width: "50%",
    marginBottom: 16,
    paddingRight: 12,
  },
  etiqueta: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: COLORES.apagado,
    marginBottom: 4,
  },
  numero: { fontFamily: "Helvetica-Bold", fontSize: 20, letterSpacing: -0.5 },
  detalle: { fontSize: 10, color: COLORES.cuerpo, marginTop: 2 },

  destacado: {
    backgroundColor: COLORES.confirmadoTinte,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  destacadoTexto: { color: COLORES.confirmadoTinta, fontSize: 11, lineHeight: 1.5 },

  separador: { borderTopWidth: 1, borderTopColor: COLORES.linea, marginVertical: 16 },

  filaEncabezado: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORES.linea,
    paddingBottom: 6,
    marginBottom: 2,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORES.hundido,
    paddingVertical: 6,
  },
  colMes: { width: "26%" },
  colMonto: { width: "22%", textAlign: "right", paddingRight: 10 },
  colFecha: { width: "20%" },
  colEstado: { width: "24%" },
  colRecibo: { width: "8%", textAlign: "right" },
  celda: { fontSize: 10 },

  nota: { fontSize: 9, color: COLORES.apagado, lineHeight: 1.5 },
  pie: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 9,
    color: COLORES.apagado,
    borderTopWidth: 1,
    borderTopColor: COLORES.linea,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export type DatosResumen = {
  t: Traductor;
  idioma: string;
  resumen: ResumenAnual;
  barrio: string;
  direccion: string;
  inquilino: string;
  duenio: string;
  generadoEl: string;
};

function Cifra({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <View style={estilos.cifra}>
      <Text style={estilos.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <Text style={estilos.numero}>{valor}</Text>
      {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
    </View>
  );
}

function ResumenPdf({ datos }: { datos: DatosResumen }) {
  const { t, idioma, resumen } = datos;
  const tr = (clave: string, valores?: Record<string, string | number>) =>
    t(`resumen.${clave}`, valores);
  const mover = resumen.movimiento;

  return (
    <Document
      title={`${tr("archivo")} ${resumen.anio} · ${datos.barrio}`}
      author="Inkey"
      language={intlDe(idioma)}
    >
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <View style={estilos.marca}>
            {/* El mismo dibujo que public/brand/inkey-simbolo.svg. */}
            <Svg viewBox="13.5 6.5 93 39" width={48} height={20}>
              <Circle cx="52" cy="26" r="15" stroke={COLORES.marca} strokeWidth={8} />
              <Path d="M37 26H18" stroke={COLORES.marca} strokeWidth={8} strokeLinecap="round" />
              <Circle cx="68" cy="26" r="15" stroke={COLORES.confirmado} strokeWidth={8} />
              <Path d="M83 26h19" stroke={COLORES.confirmado} strokeWidth={8} strokeLinecap="round" />
              <Path d="M49.40 11.23A15 15 0 0 1 66.10 20.87" stroke={COLORES.marca} strokeWidth={8} />
            </Svg>
            <Text style={estilos.logo}>inkey</Text>
          </View>
          <View>
            <Text style={estilos.sello}>{tr("archivo").toUpperCase()}</Text>
            <Text style={estilos.anio}>{resumen.anio}</Text>
          </View>
        </View>

        <Text style={estilos.titulo}>{tr("titulo", { anio: resumen.anio })}</Text>
        <Text style={estilos.subtitulo}>{datos.barrio}</Text>

        <View style={estilos.cifras}>
          <Cifra
            etiqueta={tr("mesesConfirmados")}
            valor={String(resumen.confirmados)}
            detalle={tr("deCuantos", { total: resumen.cantidadDeMeses })}
          />
          {resumen.puntualidad === null ? null : (
            <Cifra
              etiqueta={tr("puntualidad")}
              valor={`${resumen.puntualidad}%`}
              detalle={tr("puntualidadDetalle", {
                cantidad: resumen.enFecha,
                total: resumen.confirmados,
              })}
            />
          )}
          {resumen.totales.map((total) => (
            <Cifra
              key={total.moneda}
              etiqueta={`${tr("totalConfirmado")} (${total.moneda})`}
              valor={formatearMonto(total.total, total.moneda)}
              detalle={tr("enMeses", { meses: total.meses })}
            />
          ))}
        </View>

        {mover ? (
          <View style={estilos.destacado}>
            <Text style={estilos.destacadoTexto}>
              {tr(mover.porcentaje > 0 ? "movimientoSubio" : "movimientoBajo", {
                porcentaje: Math.abs(mover.porcentaje),
                desde: formatearMonto(mover.desde, mover.moneda),
                hasta: formatearMonto(mover.hasta, mover.moneda),
                primerMes: nombrePeriodo(mover.primerMes, idioma, true),
                ultimoMes: nombrePeriodo(mover.ultimoMes, idioma, true),
              })}
            </Text>
          </View>
        ) : null}

        <Text style={estilos.etiqueta}>{tr("mesAMes").toUpperCase()}</Text>
        <View style={estilos.filaEncabezado}>
          <Text style={[estilos.etiqueta, estilos.colMes]}>{tr("columnaMes").toUpperCase()}</Text>
          <Text style={[estilos.etiqueta, estilos.colMonto]}>{tr("columnaMonto").toUpperCase()}</Text>
          <Text style={[estilos.etiqueta, estilos.colFecha]}>{tr("columnaPagado").toUpperCase()}</Text>
          <Text style={[estilos.etiqueta, estilos.colEstado]}>{tr("columnaEstado").toUpperCase()}</Text>
          <Text style={[estilos.etiqueta, estilos.colRecibo]}>{tr("columnaRecibo").toUpperCase()}</Text>
        </View>

        {resumen.meses.map((mes) => {
          const pago = mes.pago;
          return (
            <View key={mes.periodo} style={estilos.fila} wrap={false}>
              <Text style={[estilos.celda, estilos.colMes]}>
                {nombrePeriodo(mes.periodo, idioma)}
              </Text>
              <Text style={[estilos.celda, estilos.colMonto]}>
                {pago ? formatearMonto(pago.amount, pago.currency) : "—"}
              </Text>
              <Text style={[estilos.celda, estilos.colFecha]}>
                {pago?.paid_on ? formatearFecha(String(pago.paid_on).slice(0, 10), idioma) : "—"}
              </Text>
              <Text style={[estilos.celda, estilos.colEstado]}>
                {pago ? t(`dominio.estadoPago.${pago.status}`) : tr("sinReportar")}
              </Text>
              <Text style={[estilos.celda, estilos.colRecibo]}>
                {pago?.status === "confirmed" && pago.receipt_serial
                  ? String(pago.receipt_serial)
                  : "—"}
              </Text>
            </View>
          );
        })}

        <View style={estilos.separador} />

        <View style={estilos.cifras}>
          <View style={estilos.cifra}>
            <Text style={estilos.etiqueta}>{tr("inquilino").toUpperCase()}</Text>
            <Text style={estilos.celda}>{datos.inquilino}</Text>
          </View>
          <View style={estilos.cifra}>
            <Text style={estilos.etiqueta}>{tr("propietario").toUpperCase()}</Text>
            <Text style={estilos.celda}>{datos.duenio}</Text>
          </View>
          <View style={estilos.cifra}>
            <Text style={estilos.etiqueta}>{tr("propiedad").toUpperCase()}</Text>
            <Text style={estilos.celda}>{datos.direccion}</Text>
          </View>
        </View>

        <Text style={estilos.nota}>
          {tr("nota")}
          {"\n"}
          {tr("generadoEl", { fecha: formatearFecha(datos.generadoEl, idioma) })}
        </Text>

        <View style={estilos.pie} fixed>
          <Text>{t("pdfPerfil.pie")}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              t("pdfPerfil.pagina", { pagina: pageNumber, total: totalPages })
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generarResumen(datos: DatosResumen): Promise<Buffer> {
  return renderToBuffer(<ResumenPdf datos={datos} />);
}
