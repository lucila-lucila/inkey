"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  confirmarPago,
  marcarNoRecibido,
  type EstadoConfirmacion,
} from "@/app/(app)/pagos/[id]/actions";
import { Button } from "@/components/ui";

const ESTADO_INICIAL: EstadoConfirmacion = { estado: "inicial" };

function BotonRecibido() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Confirmando…" : "Recibido"}
    </Button>
  );
}

function BotonNoLlego() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="w-full">
      {pending ? "Guardando…" : "Todavía no me llegó"}
    </Button>
  );
}

/**
 * Los dos botones que ve el dueño. Grandes, uno al lado del otro, pensados
 * para resolverse en segundos desde el celular.
 */
export function BotonesDueño({ pagoId }: { pagoId: string }) {
  const [confirmacion, accionConfirmar] = useActionState(confirmarPago, ESTADO_INICIAL);
  const [rechazo, accionNoRecibido] = useActionState(marcarNoRecibido, ESTADO_INICIAL);
  const [explicando, setExplicando] = useState(false);

  const error =
    confirmacion.estado === "error"
      ? confirmacion.mensaje
      : rechazo.estado === "error"
        ? rechazo.mensaje
        : null;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="m-0 rounded-control bg-terra-tint p-3 text-[15px] text-terra-ink">
          {error}
        </p>
      )}

      {explicando ? (
        <form action={accionNoRecibido} className="flex flex-col gap-3">
          <input type="hidden" name="pago_id" value={pagoId} />
          <label htmlFor={`nota-${pagoId}`} className="text-[14px] font-semibold">
            ¿Querés contarle algo? (opcional)
          </label>
          <textarea
            id={`nota-${pagoId}`}
            name="nota"
            rows={3}
            maxLength={500}
            placeholder="Por ejemplo: no me figura en la cuenta al día de hoy."
            className="w-full rounded-control border-[1.5px] border-line bg-bg p-3 text-[16px] text-ink"
          />
          <p className="m-0 text-[14px] text-muted">
            Esto queda entre ustedes dos. No aparece en ningún perfil público ni deja ninguna marca:
            tu inquilino va a poder volver a reportarlo.
          </p>
          <div className="flex flex-wrap gap-3">
            <BotonNoLlego />
            <Button type="button" variant="quiet" onClick={() => setExplicando(false)}>
              Volver
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <form action={accionConfirmar}>
            <input type="hidden" name="pago_id" value={pagoId} />
            <BotonRecibido />
          </form>
          <Button type="button" variant="outline" onClick={() => setExplicando(true)}>
            Todavía no me llegó
          </Button>
        </div>
      )}
    </div>
  );
}
