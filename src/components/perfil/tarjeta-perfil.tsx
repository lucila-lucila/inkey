import { useTranslations } from "next-intl";
import { Avatar, Card, CheckIcon, Pill } from "@/components/ui";
import { formatearMonto } from "@/lib/domain/alquiler";
import { nombrePeriodo } from "@/lib/domain/pagos";
import {
  cifraPrincipal,
  nivelesDeVerificacion,
  nombreVisible,
  resumenDeMetricas,
  type Metricas,
} from "@/lib/domain/perfil";
import { iniciales } from "@/lib/validation/profile";
import type { Moneda } from "@/lib/validation/rental";

/**
 * El historial, tal como lo ve quien recibe el link. Es la misma pieza en el
 * perfil propio y en el público: así lo que la persona ve antes de compartir
 * es exactamente lo que se comparte.
 */
export function TarjetaPerfil({
  nombre,
  inicialApellido,
  rol,
  metricas,
}: {
  nombre: string;
  inicialApellido: string;
  rol: "tenant" | "owner";
  metricas: Metricas;
}) {
  const niveles = nivelesDeVerificacion(metricas);
  const esInquilino = rol === "tenant";
  const meses = metricas.ultimos_12 ?? [];
  const cifra = cifraPrincipal(metricas, esInquilino);
  const t = useTranslations();
  const tt = useTranslations("tarjetaPerfil");

  return (
    <Card hero className="flex flex-col gap-7">
      <div className="flex items-center gap-4">
        <Avatar initials={iniciales(nombre || "?", inicialApellido || "?")} className="size-14" />
        <div>
          <p className="t-subtitulo m-0">{nombreVisible(nombre, inicialApellido)}</p>
          <p className="m-0 text-[15px] text-muted">
            {esInquilino ? "Inquilino" : "Propietario"} en Inkey
          </p>
        </div>
      </div>

      {/*
        Una sola cifra grande y el resto en una línea, igual que la tarjeta de
        ejemplo de la landing: lo que importa es cuántos meses hay confirmados.
        Las tres cajas de colores repartían el peso entre métricas que no valen
        lo mismo, y en el celular el texto no entraba.
      */}
      <div className="flex flex-col">
        <div className="flex items-center gap-4">
          <span className="t-numero font-display text-[52px] leading-none font-extrabold tracking-[-2px]">
            {cifra.numero}
          </span>
          <span className="max-w-[12em] text-[17px] leading-[1.35] text-body">
            {t(cifra.clave, { numero: cifra.numero })}
          </span>
        </div>

        <p className="mt-2 mb-0 text-[15px] text-muted">
          {resumenDeMetricas(metricas, esInquilino)
            .map((parte) => t(parte.clave, { cantidad: parte.cantidad }))
            .join(" · ")}
        </p>
      </div>

      {meses.length > 0 && (
        <div>
          <p className="t-etiqueta mb-3 text-muted">{tt("ultimos12")}</p>
          <div className="grid grid-cols-12 gap-[5px]">
            {meses.map((mes) => (
              <div
                key={mes.periodo}
                className="flex flex-col items-center gap-1.5 text-[11px] text-muted"
              >
                <i
                  className={`block h-[30px] w-full rounded-[6px] ${
                    mes.confirmado ? "bg-confirm" : "bg-surface-sunk"
                  }`}
                  title={`${nombrePeriodo(`${mes.periodo}-01`)}: ${mes.confirmado ? "confirmado" : "sin confirmar"}`}
                />
                <span className="max-[560px]:hidden">
                  {nombrePeriodo(`${mes.periodo}-01`, true).slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 mb-0 text-[15px] text-muted">
            {tt("mesesLlenos")}
          </p>
        </div>
      )}

      <div className="border-t border-line pt-6">
        <p className="t-etiqueta mb-3 text-muted">{tt("queEstaConfirmado")}</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {niveles.map((nivel) => (
            <li key={nivel.clave} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                  nivel.logrado ? "bg-confirm-soft text-confirm-ink" : "bg-surface-sunk text-muted"
                }`}
              >
                <CheckIcon size={14} />
              </span>
              <span>
                <b className="block text-[16px] font-medium">
                  {t(`dominio.nivel.${nivel.clave}.titulo`)}
                </b>
                <span className="text-[15px] text-muted">
                  {t(`dominio.nivel.${nivel.clave}.detalle`, { cantidad: nivel.cantidad })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {metricas.barrios?.length > 0 && (
        <div className="border-t border-line pt-6">
          <p className="t-etiqueta mb-2 text-muted">
            {esInquilino ? tt("alquiloEn") : tt("alquilaEn")}
          </p>
          <div className="flex flex-wrap gap-2">
            {metricas.barrios.map((barrio) => (
              <Pill key={barrio}>{barrio}</Pill>
            ))}
          </div>
        </div>
      )}

      {metricas.montos && (
        <div className="border-t border-line pt-6">
          <p className="t-etiqueta mb-2 text-muted">{tt("montos")}</p>
          {metricas.montos.mensual_actual && (
            <p className="m-0 text-[17px]">
              {tt("alquilerActual")}{" "}
              <span className="t-monto">
                {formatearMonto(
                  metricas.montos.mensual_actual.monto,
                  metricas.montos.mensual_actual.moneda as Moneda,
                )}
              </span>{" "}
              {tt("porMes")}
            </p>
          )}
          {Object.entries(metricas.montos.total_confirmado ?? {}).map(([moneda, total]) => (
            <p key={moneda} className="m-0 text-[15px] text-muted">
              {tt("totalConfirmado")} {formatearMonto(total, moneda as Moneda)}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
