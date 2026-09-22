import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ButtonLink, Card, Pill } from "@/components/ui";
import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { nombrePeriodo, ESTADOS_PAGO, type EstadoPago } from "@/lib/domain/pagos";
import type { MesDelResumen } from "@/lib/domain/resumen";
import { cargarResumen } from "./datos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("resumen");
  return { title: t("tituloMeta"), robots: { index: false, follow: false } };
}

function Cifra({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div>
      <p className="t-etiqueta m-0 text-muted">{etiqueta}</p>
      <p className="m-0 text-[28px] leading-tight font-semibold tracking-tight">{valor}</p>
      {detalle && <p className="m-0 text-[15px] text-muted">{detalle}</p>}
    </div>
  );
}

export default async function ResumenAnualPage({
  params,
}: {
  params: Promise<{ id: string; anio: string }>;
}) {
  const { id, anio } = await params;
  const cargado = await cargarResumen(id, anio);

  if (!cargado.ok) {
    if (cargado.motivo === "sin_sesion") {
      redirect(`/ingresar?volver_a=/alquileres/${id}/resumen/${anio}`);
    }
    notFound();
  }

  const { resumen, barrio, anios } = cargado.datos;
  const idioma = await getLocale();
  const t = await getTranslations();
  const tr = await getTranslations("resumen");

  const mover = resumen.movimiento;

  return (
    <div className="flex max-w-[720px] flex-col gap-7">
      <header className="flex flex-col gap-2">
        <Link href={`/alquileres/${id}`} className="text-[15px] text-muted hover:text-ink">
          ← {tr("volver")}
        </Link>
        <h1 className="m-0 t-titulo">{tr("titulo", { anio: resumen.anio })}</h1>
        <p className="m-0 text-body">{barrio}</p>
      </header>

      {resumen.cantidadDeMeses === 0 ? (
        <Card>
          <p className="m-0 text-body">{tr("sinMeses", { anio: resumen.anio })}</p>
        </Card>
      ) : (
        <>
          <Card hero className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Cifra
                etiqueta={tr("mesesConfirmados")}
                valor={String(resumen.confirmados)}
                detalle={tr("deCuantos", { total: resumen.cantidadDeMeses })}
              />
              {resumen.puntualidad !== null && (
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
                  etiqueta={tr("totalConfirmado")}
                  valor={formatearMonto(total.total, total.moneda)}
                  detalle={tr("enMeses", { meses: total.meses })}
                />
              ))}
            </div>

            {mover && (
              <p className="m-0 border-t border-line pt-5 text-body">
                {tr(mover.porcentaje > 0 ? "movimientoSubio" : "movimientoBajo", {
                  porcentaje: Math.abs(mover.porcentaje),
                  desde: formatearMonto(mover.desde, mover.moneda),
                  hasta: formatearMonto(mover.hasta, mover.moneda),
                  primerMes: nombrePeriodo(mover.primerMes, idioma, true),
                  ultimoMes: nombrePeriodo(mover.ultimoMes, idioma, true),
                })}
              </p>
            )}

            {resumen.confirmados === 0 && (
              <p className="m-0 text-[15px] text-muted">
                {tr("sinConfirmados", { anio: resumen.anio })}
              </p>
            )}
          </Card>

          <section aria-labelledby="titulo-mes-a-mes" className="flex flex-col gap-3">
            <h2 id="titulo-mes-a-mes" className="m-0 t-subtitulo">
              {tr("mesAMes")}
            </h2>
            <Card className="flex flex-col">
              {resumen.meses.map((mes, indice) => (
                <Mes
                  key={mes.periodo}
                  mes={mes}
                  idioma={idioma}
                  primero={indice === 0}
                  estado={(clave: EstadoPago) => t(`dominio.estadoPago.${clave}`)}
                  sinReportar={tr("sinReportar")}
                  vencia={tr("columnaVence")}
                  pagado={tr("columnaPagado")}
                  recibo={(numero: number) => tr("numeroRecibo", { numero })}
                />
              ))}
            </Card>
          </section>

          <section className="flex flex-wrap gap-3">
            <ButtonLink
              href={`/alquileres/${id}/resumen/${resumen.anio}/pdf`}
              variant="secondary"
              size="md"
            >
              {tr("descargarPdf")}
            </ButtonLink>
            <ButtonLink
              href={`/alquileres/${id}/resumen/${resumen.anio}/csv`}
              variant="secondary"
              size="md"
            >
              {tr("descargarCsv")}
            </ButtonLink>
          </section>
        </>
      )}

      {anios.length > 1 && (
        <section aria-labelledby="titulo-otros-anios" className="flex flex-col gap-3">
          <h2 id="titulo-otros-anios" className="m-0 t-subtitulo">
            {tr("otrosAnios")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {anios
              .filter((otro) => otro !== resumen.anio)
              .map((otro) => (
                <Link
                  key={otro}
                  href={`/alquileres/${id}/resumen/${otro}`}
                  className="rounded-chip bg-surface-sunk px-4 py-2 text-[15px] text-ink no-underline hover:brightness-[0.97]"
                >
                  {otro}
                </Link>
              ))}
          </div>
        </section>
      )}

      <p className="m-0 text-[14px] text-muted">{tr("nota")}</p>
    </div>
  );
}

/** Un renglón por mes. En el celular se apila; no hay tabla que se desborde. */
function Mes({
  mes,
  idioma,
  primero,
  estado,
  sinReportar,
  vencia,
  pagado,
  recibo,
}: {
  mes: MesDelResumen;
  idioma: string;
  primero: boolean;
  estado: (clave: EstadoPago) => string;
  sinReportar: string;
  vencia: string;
  pagado: string;
  recibo: (numero: number) => string;
}) {
  const pago = mes.pago;

  return (
    <div
      className={
        primero
          ? "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
          : "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line py-3"
      }
    >
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-medium">{nombrePeriodo(mes.periodo, idioma)}</span>
        <span className="text-[14px] text-muted">
          {pago?.paid_on
            ? `${pagado} ${formatearFecha(String(pago.paid_on).slice(0, 10), idioma)}`
            : `${vencia} ${formatearFecha(mes.vence, idioma)}`}
          {pago?.status === "confirmed" && pago.receipt_serial
            ? ` · ${recibo(pago.receipt_serial)}`
            : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-3">
        {pago && (
          <span className="text-[17px] font-medium tabular-nums">
            {formatearMonto(pago.amount, pago.currency)}
          </span>
        )}
        <Pill tone={pago ? ESTADOS_PAGO[pago.status].tono : "neutral"}>
          {pago ? estado(pago.status) : sinReportar}
        </Pill>
      </div>
    </div>
  );
}
