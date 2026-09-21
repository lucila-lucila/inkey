import "server-only";
import { Circle, Document, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { nombrePeriodo } from "@/lib/domain/pagos";
import type { Moneda } from "@/lib/validation/rental";

/*
 * Recibo de pago.
 *
 * Usa la paleta de la marca (docs/identidad.md) con las tipografías estándar
 * del PDF: incrustar Bricolage y DM Sans obligaría a traer los archivos de
 * fuente en cada render, y un recibo tiene que salir rápido y siempre igual.
 * Helvetica es la que más se parece a DM Sans de las que trae el formato.
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
  fondo: "#FFF6EA",
  superficie: "#FFFFFF",
};

const estilos = StyleSheet.create({
  pagina: {
    backgroundColor: COLORES.superficie,
    color: COLORES.tinta,
    fontFamily: "Helvetica",
    fontSize: 11,
    padding: 48,
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
  logo: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: -1, color: COLORES.tinta },
  marca: { flexDirection: "row", alignItems: "center", gap: 6 },
  etiquetaRecibo: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.2, color: COLORES.apagado, textAlign: "right" },
  numeroRecibo: { fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "right" },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 26, letterSpacing: -1, marginBottom: 4 },
  subtitulo: { color: COLORES.cuerpo, marginBottom: 24 },
  destacado: {
    backgroundColor: COLORES.confirmadoTinte,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  montoEtiqueta: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: COLORES.confirmadoTinta,
    marginBottom: 6,
  },
  monto: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    letterSpacing: -0.5,
    color: COLORES.confirmadoTinta,
  },
  grilla: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  celda: { width: "50%", marginBottom: 16, paddingRight: 12 },
  etiqueta: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.2, color: COLORES.apagado, marginBottom: 4 },
  valor: { fontSize: 12 },
  separador: { borderTopWidth: 1, borderTopColor: COLORES.linea, marginVertical: 16 },
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

export type DatosRecibo = {
  numero: string;
  periodo: string;
  monto: string;
  moneda: Moneda;
  pagadoEl: string;
  vencia: string;
  enFecha: boolean;
  confirmadoEl: string;
  inquilino: string;
  duenio: string;
  direccion: string;
  barrio: string;
  conComprobante: boolean;
};

function Celda({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.celda}>
      <Text style={estilos.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

function Recibo({ datos }: { datos: DatosRecibo }) {
  return (
    <Document
      title={`Recibo ${datos.numero} · ${nombrePeriodo(datos.periodo)}`}
      author="Inkey"
      language="es-AR"
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
              {/* El cruce de arriba: la llave izquierda pasa por delante. */}
              <Path d="M49.40 11.23A15 15 0 0 1 66.10 20.87" stroke={COLORES.marca} strokeWidth={8} />
            </Svg>
            <Text style={estilos.logo}>inkey</Text>
          </View>
          <View>
            <Text style={estilos.etiquetaRecibo}>RECIBO</Text>
            <Text style={estilos.numeroRecibo}>{datos.numero}</Text>
          </View>
        </View>

        <Text style={estilos.titulo}>Pago confirmado</Text>
        <Text style={estilos.subtitulo}>
          Las dos partes confirmaron el alquiler de {nombrePeriodo(datos.periodo)}.
        </Text>

        <View style={estilos.destacado}>
          <Text style={estilos.montoEtiqueta}>MONTO CONFIRMADO</Text>
          <Text style={estilos.monto}>{formatearMonto(datos.monto, datos.moneda)}</Text>
        </View>

        <View style={estilos.grilla}>
          <Celda etiqueta="Período" valor={nombrePeriodo(datos.periodo)} />
          <Celda etiqueta="Fecha de pago" valor={formatearFecha(datos.pagadoEl)} />
          <Celda etiqueta="Vencimiento" valor={formatearFecha(datos.vencia)} />
          <Celda
            etiqueta="Puntualidad"
            valor={datos.enFecha ? "Pagado en fecha" : "Pagado después del vencimiento"}
          />
        </View>

        <View style={estilos.separador} />

        <View style={estilos.grilla}>
          <Celda etiqueta="Inquilino" valor={datos.inquilino} />
          <Celda etiqueta="Propietario" valor={datos.duenio} />
          <Celda etiqueta="Propiedad" valor={datos.direccion} />
          <Celda etiqueta="Barrio" valor={datos.barrio} />
        </View>

        <View style={estilos.separador} />

        <Text style={estilos.nota}>
          Confirmado por el propietario el {formatearFecha(datos.confirmadoEl)}.
          {datos.conComprobante
            ? " El inquilino adjuntó comprobante del pago."
            : " El pago se registró sin comprobante adjunto."}
          {"\n"}
          Este documento deja constancia de que ambas partes registraron y confirmaron el pago en
          Inkey. No reemplaza al recibo fiscal ni a lo que establezca el contrato de locación.
        </Text>

        <View style={estilos.pie} fixed>
          <Text>Inkey · Tu historial de alquiler, confirmado</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generarRecibo(datos: DatosRecibo): Promise<Buffer> {
  return renderToBuffer(<Recibo datos={datos} />);
}
