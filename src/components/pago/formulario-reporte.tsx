"use client";

import { useLocale, useTranslations } from "next-intl";
import { traducirAviso } from "@/i18n/texto";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reportarPago, type EstadoReporte } from "@/app/[locale]/(app)/alquileres/[id]/actions";
import { Button, CampoMonto, Field, Input } from "@/components/ui";
import { nombrePeriodo } from "@/lib/domain/pagos";

const ESTADO_INICIAL: EstadoReporte = { estado: "inicial" };

function BotonGuardar() {
  const t = useTranslations();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? t("pago.guardando") : t("pago.listoYaPague")}
    </Button>
  );
}

/** "Ya pagué": monto prellenado, fecha y comprobante opcional. */
export function FormularioReporte({
  rentalId,
  periodo,
  montoSugerido,
  hoy,
  onCancelar,
}: {
  rentalId: string;
  periodo: string;
  montoSugerido: string;
  hoy: string;
  onCancelar?: () => void;
}) {
  const t = useTranslations();
  const idioma = useLocale();
  const [estado, accion] = useActionState(reportarPago, ESTADO_INICIAL);
  const error = estado.estado === "error" ? estado : undefined;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="rental_id" value={rentalId} />
      <input type="hidden" name="period" value={periodo} />

      <p className="m-0 text-[15px] text-muted">
        Estás reportando el pago de <strong className="text-ink">{nombrePeriodo(periodo, idioma)}</strong>.
      </p>

      {error && (
        <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
          {traducirAviso(t, error)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("pago.cuantoPagaste")} htmlFor={`amount-${periodo}`}>
          <CampoMonto
            id={`amount-${periodo}`}
            name="amount"
            defaultValue={montoSugerido}
          />
        </Field>
        <Field label={t("pago.cuandoPagaste")} htmlFor={`paid_on-${periodo}`}>
          <Input id={`paid_on-${periodo}`} name="paid_on" type="date" defaultValue={hoy} max={hoy} />
        </Field>
      </div>

      <Field
        label={t("pago.comprobante")}
        htmlFor={`comprobante-${periodo}`}
        hint={t("pago.pistaComprobante")}
      >
        <input
          id={`comprobante-${periodo}`}
          name="comprobante"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="min-h-[52px] w-full rounded-campo border border-line bg-surface-sunk p-3 text-[15px] file:mr-3 file:min-h-[36px] file:rounded-lg file:border-0 file:bg-surface-sunk file:px-3 file:font-medium file:text-ink"
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <BotonGuardar />
        {onCancelar && (
          <Button type="button" variant="quiet" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
