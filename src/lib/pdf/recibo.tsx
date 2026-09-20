import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { nombrePeriodo } from "@/lib/domain/pagos";
import type { Moneda } from "@/lib/validation/rental";

/*
 * Recibo de pago.
 *
 * Usa los colores de la marca pero tipografías estándar del PDF: incrustar
 * Fraunces obligaría a traer los archivos de fuente en cada render, y un
 * recibo tiene que salir rápido y siempre igual.
 */

const COLORES = {
  tinta: "#1D1A15",
  cuerpo: "#4F493F",
  apagado: "#5E574B",
  linea: "#CFC5B3",
  verde: "#1E5B47",
  verdeTinte: "#E4EFE9",
  fondo: "#FFFDF8",
};

const estilos = StyleSheet.create({
  pagina: {
    backgroundColor: COLORES.fondo,
    color: COLORES.tinta,
    fontFamily: "Helvetica",
    fontSize: 11,
    padding: 48,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: COLORES.tinta,
    paddingBottom: 16,
    marginBottom: 24,
  },
  logo: { fontFamily: "Times-Bold", fontSize: 22 },
  etiquetaRecibo: { fontSize: 10, color: COLORES.apagado, textAlign: "right" },
  numeroRecibo: { fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "right" },
  titulo: { fontFamily: "Times-Bold", fontSize: 26, marginBottom: 4 },
  subtitulo: { color: COLORES.cuerpo, marginBottom: 24 },
  destacado: {
    backgroundColor: COLORES.verdeTinte,
    borderWidth: 1.5,
    borderColor: COLORES.verde,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  montoEtiqueta: { fontSize: 10, color: COLORES.verde, marginBottom: 4 },
  monto: { fontFamily: "Times-Bold", fontSize: 28, color: COLORES.verde },
  grilla: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  celda: { width: "50%", marginBottom: 16, paddingRight: 12 },
  etiqueta: { fontSize: 9, color: COLORES.apagado, marginBottom: 3 },
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
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
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
          <Text style={estilos.logo}>inkey.</Text>
          <View>
            <Text style={estilos.etiquetaRecibo}>Recibo</Text>
            <Text style={estilos.numeroRecibo}>{datos.numero}</Text>
          </View>
        </View>

        <Text style={estilos.titulo}>Pago confirmado</Text>
        <Text style={estilos.subtitulo}>
          Las dos partes confirmaron el alquiler de {nombrePeriodo(datos.periodo)}.
        </Text>

        <View style={estilos.destacado}>
          <Text style={estilos.montoEtiqueta}>Monto confirmado</Text>
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
