import { ImageResponse } from "next/og";
import { nombreVisible, resumenParaCompartir } from "@/lib/domain/perfil";
import { perfilDelToken } from "./datos";

export const runtime = "nodejs";
export const alt = "Historial de alquiler confirmado en Inkey";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
 * La imagen que se ve cuando alguien manda su perfil por WhatsApp.
 * Pide los datos sin contar la visita: el preview lo genera el mensajero, no
 * una persona mirando el perfil.
 */
export default async function Imagen({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const perfil = await perfilDelToken(token, { contar: false });

  const crema = "#FFF6EA";
  const tinta = "#23201C";
  const verde = "#2F7A5F";
  const marca = "#B8451A";
  const sol = "#F2D06B";

  if (perfil.estado !== "valido") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: crema,
            color: tinta,
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", color: marca }}>inkey</div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 16 }}>
            Este link ya no está disponible
          </div>
        </div>
      ),
      size,
    );
  }

  const nombre = nombreVisible(perfil.nombre, perfil.inicial_apellido);
  const { metricas } = perfil;
  const esInquilino = perfil.rol === "tenant";

  const numeros = esInquilino
    ? [
        { valor: String(metricas.meses_confirmados), etiqueta: "meses confirmados", destacado: true },
        {
          valor: metricas.porcentaje_en_fecha === null ? "—" : `${metricas.porcentaje_en_fecha}%`,
          etiqueta: "pagos en fecha",
          destacado: false,
        },
        { valor: String(metricas.contratos_cumplidos), etiqueta: "contratos cumplidos", destacado: false },
      ]
    : [
        { valor: String(metricas.contratos_totales), etiqueta: "alquileres", destacado: true },
        { valor: String(metricas.meses_confirmados), etiqueta: "pagos confirmados", destacado: false },
        { valor: String(metricas.contratos_cumplidos), etiqueta: "contratos cumplidos", destacado: false },
      ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: crema,
          color: tinta,
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: marca }}>inkey</div>
          <div
            style={{
              display: "flex",
              background: "#E8F0EB",
              color: "#24614B",
              padding: "12px 24px",
              borderRadius: 999,
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            Confirmado por la otra parte
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>
            {nombre}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#57504A", marginTop: 8 }}>
            {resumenParaCompartir(metricas, perfil.rol)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {numeros.map((dato) => (
            <div
              key={dato.etiqueta}
              style={{
                display: "flex",
                flexDirection: "column",
                background: dato.destacado ? sol : "#FFFFFF",
                borderRadius: 24,
                padding: 28,
                width: 330,
              }}
            >
              <div style={{ display: "flex", fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>
                {dato.valor}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: dato.destacado ? tinta : "#57504A" }}>
                {dato.etiqueta}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", fontSize: 22, color: verde }}>
          Historial de alquiler confirmado entre inquilino y dueño
        </div>
      </div>
    ),
    size,
  );
}
