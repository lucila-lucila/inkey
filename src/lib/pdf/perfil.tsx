import type { Traductor } from "@/i18n/texto";
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
import {
  cifraPrincipal,
  nivelesDeVerificacion,
  nombreVisible,
  resumenDeMetricas,
  type Metricas,
} from "@/lib/domain/perfil";
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
  numeros: { marginBottom: 28 },
  cifra: { flexDirection: "row", alignItems: "center", gap: 10 },
  cifraValor: { fontFamily: "Helvetica-Bold", fontSize: 38, letterSpacing: -1 },
  cifraTexto: { fontSize: 11, color: COLORES.cuerpo, maxWidth: 170 },
  cifraResumen: { fontSize: 9, color: COLORES.apagado, marginTop: 6 },
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
  /*
   * El PDF se genera del lado del servidor, donde no hay contexto de React:
   * el traductor y el idioma llegan de afuera. Sale en el idioma de quien
   * pide el archivo, que es quien se lo va a mandar a alguien.
   */
  t: Traductor;
  idioma: string;
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

  const cifra = cifraPrincipal(metricas, esInquilino);
  const t = datos.t;

  return (
    <Document
      title={`${t("pdfPerfil.titulo")} · ${nombreVisible(datos.nombre, datos.inicialApellido)}`}
      author="Inkey"
      language={datos.idioma === "en" ? "en" : "es-AR"}
    >
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <View style={estilos.marca}>
            <Simbolo />
            <Text style={estilos.logo}>inkey</Text>
          </View>
          <Text style={estilos.sello}>{t("pdfPerfil.sello")}</Text>
        </View>

        <Text style={estilos.nombre}>{nombreVisible(datos.nombre, datos.inicialApellido)}</Text>
        <Text style={estilos.rol}>
          {esInquilino ? t("pdfPerfil.inquilino") : t("pdfPerfil.propietario")}
          {metricas.desde ? ` · ${t("pdfPerfil.desde", { fecha: formatearFecha(metricas.desde) })}` : ""}
        </Text>

        {/* La misma tarjeta que en pantalla: una cifra manda y el resto acompaña. */}
        <View style={estilos.numeros}>
          <View style={estilos.cifra}>
            <Text style={estilos.cifraValor}>{cifra.numero}</Text>
            <Text style={estilos.cifraTexto}>{t(cifra.clave, { numero: cifra.numero })}</Text>
          </View>
          <Text style={estilos.cifraResumen}>
            {resumenDeMetricas(metricas, esInquilino)
              .map((parte) => t(parte.clave, { cantidad: parte.cantidad }))
              .join(" · ")}
          </Text>
        </View>

        {metricas.ultimos_12?.length > 0 && (
          <View>
            <Text style={estilos.etiqueta}>{t("tarjetaPerfil.ultimos12").toUpperCase()}</Text>
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
                    {nombrePeriodo(`${mes.periodo}-01`, datos.idioma, true).slice(0, 3)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={estilos.numeroEtiqueta}>
              {t("tarjetaPerfil.mesesLlenos")}
            </Text>
          </View>
        )}

        <View style={estilos.seccion}>
          <Text style={estilos.etiqueta}>{t("tarjetaPerfil.queEstaConfirmado").toUpperCase()}</Text>
          {niveles.map((nivel) => (
            <View key={nivel.clave} style={estilos.nivel}>
              <Text style={{ color: nivel.logrado ? COLORES.confirmado : COLORES.apagado }}>
                {nivel.logrado ? "•" : "◦"}
              </Text>
              <View>
                <Text style={estilos.nivelTitulo}>{t(`dominio.nivel.${nivel.clave}.titulo`)}</Text>
                <Text style={estilos.nivelDetalle}>
                  {t(`dominio.nivel.${nivel.clave}.detalle`, { cantidad: nivel.cantidad })}
                </Text>
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
            <Text style={estilos.etiqueta}>{t("tarjetaPerfil.montos").toUpperCase()}</Text>
            {metricas.montos.mensual_actual && (
              <Text style={estilos.nivelDetalle}>
                {t("tarjetaPerfil.alquilerActual")}{" "}
                {formatearMonto(
                  metricas.montos.mensual_actual.monto,
                  metricas.montos.mensual_actual.moneda as Moneda,
                )}{" "}
                {t("tarjetaPerfil.porMes")}
              </Text>
            )}
            {Object.entries(metricas.montos.total_confirmado ?? {}).map(([moneda, total]) => (
              <Text key={moneda} style={estilos.nivelDetalle}>
                {t("tarjetaPerfil.totalConfirmado")} {formatearMonto(total, moneda as Moneda)}
              </Text>
            ))}
          </View>
        )}

        {(datos.resenas?.length ?? 0) > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.etiqueta}>{t("pdfPerfil.loQueDijo").toUpperCase()}</Text>
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
          {t("pdfPerfil.nota")}
          {"\n"}
          {t("pdfPerfil.generado", { fecha: formatearFecha(datos.generadoEl) })}
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

export async function generarPerfilPdf(datos: DatosPerfilPdf): Promise<Buffer> {
  return renderToBuffer(<Perfil datos={datos} />);
}
