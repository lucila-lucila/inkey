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
import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { nombrePeriodo } from "@/lib/domain/pagos";
import { nivelesDeVerificacion, nombreVisible, type Metricas } from "@/lib/domain/perfil";
import type { ResenaPublica } from "@/lib/domain/resenas";
import type { Moneda } from "@/lib/validation/rental";

/*
 * El perfil, en PDF. Mismo contenido que la página: si algo no se muestra en
 * la web, acá tampoco.
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
  crema: "#FFF6EA",
  hundido: "#F1E7D8",
  sol: "#F2D06B",
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
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORES.linea,
    paddingBottom: 16,
    marginBottom: 28,
  },
  marca: { flexDirection: "row", alignItems: "center", gap: 6 },
  logo: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: -1 },
  sello: {
    backgroundColor: COLORES.confirmadoTinte,
    color: COLORES.confirmadoTinta,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  nombre: { fontFamily: "Helvetica-Bold", fontSize: 30, letterSpacing: -1 },
  rol: { color: COLORES.cuerpo, marginTop: 2, marginBottom: 24 },
  numeros: { flexDirection: "row", gap: 12, marginBottom: 28 },
  numero: { flex: 1, borderRadius: 16, padding: 16 },
  numeroValor: { fontFamily: "Helvetica-Bold", fontSize: 26, letterSpacing: -0.5 },
  numeroEtiqueta: { fontSize: 9, color: COLORES.cuerpo, marginTop: 2 },
  etiqueta: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: COLORES.apagado,
    marginBottom: 8,
  },
  barras: { flexDirection: "row", gap: 4, marginBottom: 6 },
  barraColumna: { flex: 1, alignItems: "center" },
  barra: { width: "100%", height: 26, borderRadius: 5 },
  barraMes: { fontSize: 7, color: COLORES.apagado, marginTop: 4 },
  seccion: { borderTopWidth: 1, borderTopColor: COLORES.linea, paddingTop: 20, marginTop: 4 },
  nivel: { flexDirection: "row", gap: 8, marginBottom: 10, alignItems: "flex-start" },
  nivelTitulo: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  nivelDetalle: { fontSize: 10, color: COLORES.cuerpo },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: COLORES.hundido,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 9,
  },
  nota: { fontSize: 9, color: COLORES.apagado, lineHeight: 1.5, marginTop: 20 },
  resena: {
    backgroundColor: COLORES.crema,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  resenaTexto: { fontSize: 10, color: COLORES.cuerpo, lineHeight: 1.5, marginBottom: 4 },
  resenaEtiquetas: { fontSize: 9, color: COLORES.confirmadoTinta, marginBottom: 4 },
  resenaAutor: { fontSize: 9, color: COLORES.apagado },
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

export type DatosPerfilPdf = {
  nombre: string;
  inicialApellido: string;
  rol: "tenant" | "owner";
  metricas: Metricas;
  resenas?: ResenaPublica[];
  generadoEl: string;
};

function Simbolo() {
  /*
   * El mismo dibujo que `public/brand/inkey-simbolo.svg`, con las primitivas
   * de react-pdf. Dos tintas: terracota y verde, como en todos los usos.
   */
  return (
    <Svg viewBox="13.5 6.5 93 39" width={48} height={20}>
      <Circle cx="52" cy="26" r="15" stroke={COLORES.marca} strokeWidth={8} />
      <Path d="M37 26H18" stroke={COLORES.marca} strokeWidth={8} strokeLinecap="round" />
      <Circle cx="68" cy="26" r="15" stroke={COLORES.confirmado} strokeWidth={8} />
      <Path d="M83 26h19" stroke={COLORES.confirmado} strokeWidth={8} strokeLinecap="round" />
      {/* El cruce de arriba: la llave izquierda pasa por delante. */}
      <Path d="M49.40 11.23A15 15 0 0 1 66.10 20.87" stroke={COLORES.marca} strokeWidth={8} />
    </Svg>
  );
}

function Perfil({ datos }: { datos: DatosPerfilPdf }) {
  const { metricas, rol } = datos;
  const esInquilino = rol === "tenant";
  const niveles = nivelesDeVerificacion(metricas);

  const numeros = esInquilino
    ? [
        { valor: String(metricas.meses_confirmados), etiqueta: "meses confirmados", destacado: true },
        {
          valor: metricas.porcentaje_en_fecha === null ? "—" : `${metricas.porcentaje_en_fecha}%`,
          etiqueta: "pagos en fecha",
          destacado: false,
        },
        {
          valor: String(metricas.contratos_cumplidos),
          etiqueta: "contratos cumplidos",
          destacado: false,
        },
      ]
    : [
        { valor: String(metricas.contratos_totales), etiqueta: "alquileres", destacado: true },
        { valor: String(metricas.meses_confirmados), etiqueta: "pagos confirmados", destacado: false },
        {
          valor: String(metricas.contratos_cumplidos),
          etiqueta: "contratos cumplidos",
          destacado: false,
        },
      ];

  return (
    <Document
      title={`Historial de alquiler · ${nombreVisible(datos.nombre, datos.inicialApellido)}`}
      author="Inkey"
      language="es-AR"
    >
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <View style={estilos.marca}>
            <Simbolo />
            <Text style={estilos.logo}>inkey</Text>
          </View>
          <Text style={estilos.sello}>CONFIRMADO POR LA OTRA PARTE</Text>
        </View>

        <Text style={estilos.nombre}>{nombreVisible(datos.nombre, datos.inicialApellido)}</Text>
        <Text style={estilos.rol}>
          {esInquilino ? "Inquilino" : "Propietario"} en Inkey
          {metricas.desde ? ` · desde ${formatearFecha(metricas.desde)}` : ""}
        </Text>

        <View style={estilos.numeros}>
          {numeros.map((dato) => (
            <View
              key={dato.etiqueta}
              style={[
                estilos.numero,
                { backgroundColor: dato.destacado ? COLORES.sol : COLORES.hundido },
              ]}
            >
              <Text style={estilos.numeroValor}>{dato.valor}</Text>
              <Text style={estilos.numeroEtiqueta}>{dato.etiqueta}</Text>
            </View>
          ))}
        </View>

        {metricas.ultimos_12?.length > 0 && (
          <View>
            <Text style={estilos.etiqueta}>ÚLTIMOS 12 MESES</Text>
            <View style={estilos.barras}>
              {metricas.ultimos_12.map((mes) => (
                <View key={mes.periodo} style={estilos.barraColumna}>
                  <View
                    style={[
                      estilos.barra,
                      { backgroundColor: mes.confirmado ? COLORES.confirmado : COLORES.hundido },
                    ]}
                  />
                  <Text style={estilos.barraMes}>
                    {nombrePeriodo(`${mes.periodo}-01`, true).slice(0, 3)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={estilos.numeroEtiqueta}>
              Los meses llenos son los que confirmó la otra parte.
            </Text>
          </View>
        )}

        <View style={estilos.seccion}>
          <Text style={estilos.etiqueta}>QUÉ ESTÁ CONFIRMADO</Text>
          {niveles.map((nivel) => (
            <View key={nivel.titulo} style={estilos.nivel}>
              <Text style={{ color: nivel.logrado ? COLORES.confirmado : COLORES.apagado }}>
                {nivel.logrado ? "•" : "◦"}
              </Text>
              <View>
                <Text style={estilos.nivelTitulo}>{nivel.titulo}</Text>
                <Text style={estilos.nivelDetalle}>{nivel.detalle}</Text>
              </View>
            </View>
          ))}
        </View>

        {metricas.barrios?.length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.etiqueta}>{esInquilino ? "ALQUILÓ EN" : "ALQUILA EN"}</Text>
            <View style={estilos.chips}>
              {metricas.barrios.map((barrio) => (
                <Text key={barrio} style={estilos.chip}>
                  {barrio}
                </Text>
              ))}
            </View>
          </View>
        )}

        {metricas.montos && (
          <View style={estilos.seccion}>
            <Text style={estilos.etiqueta}>MONTOS</Text>
            {metricas.montos.mensual_actual && (
              <Text style={estilos.nivelDetalle}>
                Alquiler actual:{" "}
                {formatearMonto(
                  metricas.montos.mensual_actual.monto,
                  metricas.montos.mensual_actual.moneda as Moneda,
                )}{" "}
                por mes
              </Text>
            )}
            {Object.entries(metricas.montos.total_confirmado ?? {}).map(([moneda, total]) => (
              <Text key={moneda} style={estilos.nivelDetalle}>
                Total confirmado: {formatearMonto(total, moneda as Moneda)}
              </Text>
            ))}
          </View>
        )}

        {(datos.resenas?.length ?? 0) > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.etiqueta}>LO QUE DIJO LA OTRA PARTE</Text>
            {datos.resenas!.map((resena, indice) => (
              <View key={`${resena.fecha}-${indice}`} style={estilos.resena}>
                {resena.etiquetas.length > 0 && (
                  <Text style={estilos.resenaEtiquetas}>{resena.etiquetas.join(" · ")}</Text>
                )}
                {resena.texto && <Text style={estilos.resenaTexto}>“{resena.texto}”</Text>}
                <Text style={estilos.resenaAutor}>
                  {resena.de}, {formatearFecha(resena.fecha.slice(0, 10))}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={estilos.nota}>
          Cada mes confirmado de este historial fue registrado por el inquilino y confirmado por el
          propietario. Inkey no muestra dirección, teléfono, mail ni comprobantes, y los meses sin
          confirmar no figuran. No consultamos bancos ni bureaus de crédito.
          {"\n"}
          Generado el {formatearFecha(datos.generadoEl)} a pedido de quien comparte el perfil.
        </Text>

        <View style={estilos.pie} fixed>
          <Text>Inkey · Tu historial de alquiler, confirmado</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generarPerfilPdf(datos: DatosPerfilPdf): Promise<Buffer> {
  return renderToBuffer(<Perfil datos={datos} />);
}
