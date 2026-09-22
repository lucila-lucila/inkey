"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelarFin, confirmarFin, proponerFin, type EstadoFin } from "@/app/[locale]/(app)/alquileres/[id]/fin-actions";
import { Button, Card } from "@/components/ui";

const ESTADO_INICIAL: EstadoFin = { estado: "inicial" };

function BotonEnvio({ texto, enCurso, variante = "primary" }: {
  texto: string;
  enCurso: string;
  variante?: "primary" | "confirm" | "secondary" | "quiet";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variante} disabled={pending}>
      {pending ? enCurso : texto}
    </Button>
  );
}

function Error({ estado }: { estado: EstadoFin }) {
  if (estado.estado !== "error") return null;
  return (
    <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
      {estado.mensaje}
    </p>
  );
}

/** "Terminó el contrato": lo marca uno y lo confirma el otro. */
export function ProponerFin({ rentalId }: { rentalId: string }) {
  const [estado, accion] = useActionState(proponerFin, ESTADO_INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="quiet" onClick={() => setConfirmando(true)}>
        Terminó el contrato
      </Button>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="rental_id" value={rentalId} />
      <p className="m-0 text-body">
        Le vamos a avisar a la otra parte para que lo confirme. Cuando confirme, los dos van a poder
        dejarse una reseña.
      </p>
      <Error estado={estado} />
      <div className="flex flex-wrap gap-3">
        <BotonEnvio texto="Sí, terminó" enCurso="Avisando…" />
        <Button type="button" variant="quiet" onClick={() => setConfirmando(false)}>
          Mejor no
        </Button>
      </div>
    </form>
  );
}

/** La otra parte confirma, o quien lo propuso da marcha atrás. */
export function ConfirmarFin({
  rentalId,
  loPropuseYo,
  quien,
}: {
  rentalId: string;
  loPropuseYo: boolean;
  quien: string;
}) {
  const [confirmacion, accionConfirmar] = useActionState(confirmarFin, ESTADO_INICIAL);
  const [cancelacion, accionCancelar] = useActionState(cancelarFin, ESTADO_INICIAL);

  return (
    <Card hero className="flex flex-col gap-4">
      <div>
        <h3 className="t-subtitulo mt-0 mb-1.5">
          {loPropuseYo ? "Marcaste que terminó el contrato" : `${quien} marcó que terminó el contrato`}
        </h3>
        <p className="m-0 text-body">
          {loPropuseYo
            ? "Cuando lo confirme la otra parte, el alquiler queda terminado y los dos pueden dejarse una reseña."
            : "Si es así, confirmalo: el alquiler queda terminado y los dos van a poder dejarse una reseña."}
        </p>
      </div>

      <Error estado={loPropuseYo ? cancelacion : confirmacion} />

      {loPropuseYo ? (
        <form action={accionCancelar}>
          <input type="hidden" name="rental_id" value={rentalId} />
          <BotonEnvio texto="Me equivoqué, sigue activo" enCurso="Volviendo…" variante="secondary" />
        </form>
      ) : (
        <form action={accionConfirmar} className="flex flex-wrap gap-3">
          <input type="hidden" name="rental_id" value={rentalId} />
          <BotonEnvio texto="Sí, terminó" enCurso="Confirmando…" variante="confirm" />
        </form>
      )}
    </Card>
  );
}
