"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { BotonesDueño } from "./botones-dueno";
import { FormularioReporte } from "./formulario-reporte";
import { enlaceWhatsApp, formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import {
  ESTADOS_PAGO,
  mensajeInsistirPago,
  nombrePeriodo,
  sePuedeInsistir,
  type EstadoPago,
} from "@/lib/domain/pagos";
import type { Moneda } from "@/lib/validation/rental";

export type PagoDelPeriodo = {
  id: string;
  status: EstadoPago;
  amount: string;
  currency: string;
  paid_on: string;
  due_date: string;
  on_time: boolean | null;
  owner_note: string | null;
  receipt_path: string | null;
  reported_at: string | null;
};

export type FilaPeriodo = {
  periodo: string;
  vence: string;
  pago: PagoDelPeriodo | null;
};

/**
 * Los meses del alquiler. Arriba, el que necesita algo de quien está mirando;
 * abajo, el historial.
 */
export function SeccionPagos({
  rentalId,
  soyInquilino,
  montoSugerido,
  filas,
  hoy,
  barrio,
  siteUrl,
}: {
  rentalId: string;
  soyInquilino: boolean;
  montoSugerido: string;
  filas: FilaPeriodo[];
  hoy: string;
  barrio: string;
  /** Base de los links que se comparten por WhatsApp. */
  siteUrl: string;
}) {
  const t = useTranslations();
  const [reportando, setReportando] = useState<string | null>(null);

  if (filas.length === 0) {
    return (
      <Card >
        <p className="m-0 text-body">
          Todavía no arrancó el primer mes del contrato. Cuando empiece, vas a poder registrar el
          pago acá.
        </p>
      </Card>
    );
  }

  const [actual, ...anteriores] = filas;
  const pendientesDelDueño = filas.filter((fila) => fila.pago?.status === "reported");

  return (
    <div className="flex flex-col gap-5">
      {/* Lo que hay que hacer ahora */}
      {soyInquilino ? (
        <Card hero className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="t-etiqueta m-0 text-muted">Mes en curso</p>
              <p className="m-0 t-subtitulo capitalize">
                {nombrePeriodo(actual.periodo)}
              </p>
              <p className="m-0 text-[15px] text-muted">
                Vence el {formatearFecha(actual.vence)}
              </p>
            </div>
            {actual.pago && (
              <Pill tone={ESTADOS_PAGO[actual.pago.status].tono}>
                {t(`dominio.estadoPago.${actual.pago.status}`)}
              </Pill>
            )}
          </div>

          {actual.pago?.status === "confirmed" && (
            <p className="m-0 text-body">
              Tu dueño confirmó este mes.{" "}
              <Link href={`/pagos/${actual.pago.id}`} className="font-medium text-confirm-ink">
                Ver el recibo
              </Link>
            </p>
          )}

          {actual.pago?.status === "reported" && (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-body">
                Ya lo reportaste. Le avisamos a tu dueño para que lo confirme.{" "}
                <Link href={`/pagos/${actual.pago.id}`} className="font-medium text-confirm-ink">
                  Ver el detalle
                </Link>
              </p>

              {/*
               * A la semana sin respuesta, se lo puede recordar por WhatsApp. El
               * link va al pago dentro de la app: confirmarlo sigue siendo cosa
               * del dueño, entrando con su mail.
               */}
              {sePuedeInsistir(actual.pago, new Date(`${hoy}T12:00:00Z`)) && (
                <div className="flex flex-col gap-2">
                  <a
                    href={enlaceWhatsApp(
                      mensajeInsistirPago({
                        mes: nombrePeriodo(actual.periodo),
                        barrio,
                        url: `${siteUrl}/pagos/${actual.pago.id}`,
                      }),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-surface-sunk px-6 text-[17px] font-medium text-ink no-underline hover:brightness-[0.97]"
                  >
                    Recordárselo por WhatsApp
                  </a>
                  <p className="m-0 text-[15px] text-muted">
                    Pasó más de una semana y todavía no respondió. Ya le mandamos un mail; si
                    querés, escribile vos.
                  </p>
                </div>
              )}
            </div>
          )}

          {actual.pago?.status === "not_received" && (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-body">
                Tu dueño dice que todavía no le llegó
                {actual.pago.owner_note ? `: “${actual.pago.owner_note}”` : "."} Si ya lo pagaste,
                volvé a reportarlo con el comprobante.
              </p>
              {reportando === actual.periodo ? (
                <FormularioReporte
                  rentalId={rentalId}
                  periodo={actual.periodo}
                  montoSugerido={montoSugerido}
                  hoy={hoy}
                  onCancelar={() => setReportando(null)}
                />
              ) : (
                <Button type="button" onClick={() => setReportando(actual.periodo)}>
                  Volver a reportarlo
                </Button>
              )}
            </div>
          )}

          {!actual.pago &&
            (reportando === actual.periodo ? (
              <FormularioReporte
                rentalId={rentalId}
                periodo={actual.periodo}
                montoSugerido={montoSugerido}
                hoy={hoy}
                onCancelar={() => setReportando(null)}
              />
            ) : (
              <Button type="button" onClick={() => setReportando(actual.periodo)}>
                Ya pagué
              </Button>
            ))}
        </Card>
      ) : pendientesDelDueño.length > 0 ? (
        <div className="flex flex-col gap-3">
          {pendientesDelDueño.map((fila) => (
            <Card key={fila.periodo} hero className="flex flex-col gap-4">
              <div>
                <p className="t-etiqueta m-0 text-muted">Te reportaron un pago</p>
                <p className="m-0 t-subtitulo capitalize">
                  {nombrePeriodo(fila.periodo)}
                </p>
                <p className="m-0 text-[17px]">
                  {formatearMonto(fila.pago!.amount, fila.pago!.currency as Moneda)} · pagado el{" "}
                  {formatearFecha(fila.pago!.paid_on)}
                </p>
              </div>
              <BotonesDueño pagoId={fila.pago!.id} />
              <Link
                href={`/pagos/${fila.pago!.id}`}
                className="text-[15px] font-medium text-confirm-ink"
              >
                Ver el detalle y el comprobante
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card >
          <p className="m-0 text-body">
            No hay pagos esperando tu confirmación. Cuando tu inquilino reporte uno, te aparece acá.
          </p>
        </Card>
      )}

      {/* Historial */}
      {anteriores.length > 0 && (
        <div>
          <h3 className="t-etiqueta mt-0 mb-3 text-muted">Meses anteriores</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {anteriores.map((fila) => (
              <li key={fila.periodo}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[17px] font-medium capitalize">
                      {nombrePeriodo(fila.periodo)}
                    </p>
                    <p className="m-0 text-[15px] text-muted">
                      {fila.pago
                        ? `${formatearMonto(fila.pago.amount, fila.pago.currency as Moneda)} · pagado el ${formatearFecha(fila.pago.paid_on)}`
                        : `Vencía el ${formatearFecha(fila.vence)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {fila.pago ? (
                      <>
                        <Pill tone={ESTADOS_PAGO[fila.pago.status].tono}>
                          {t(`dominio.estadoPago.${fila.pago.status}`)}
                        </Pill>
                        <Link
                          href={`/pagos/${fila.pago.id}`}
                          className="text-[15px] font-medium text-confirm-ink"
                        >
                          Ver
                        </Link>
                      </>
                    ) : soyInquilino ? (
                      reportando === fila.periodo ? null : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          onClick={() => setReportando(fila.periodo)}
                        >
                          Ya pagué
                        </Button>
                      )
                    ) : (
                      <Pill>Sin reportar</Pill>
                    )}
                  </div>

                  {reportando === fila.periodo && !fila.pago && (
                    <div className="w-full border-t-[1.5px] border-dashed border-line pt-4">
                      <FormularioReporte
                        rentalId={rentalId}
                        periodo={fila.periodo}
                        montoSugerido={montoSugerido}
                        hoy={hoy}
                        onCancelar={() => setReportando(null)}
                      />
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-3 mb-0 text-[15px] text-muted">
            Un mes sin confirmar simplemente no suma. Nunca aparece como algo negativo.
          </p>
        </div>
      )}
    </div>
  );
}
