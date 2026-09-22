"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { confirmarDesdeMail, noRecibidoDesdeMail, type EstadoDesdeMail } from "./actions";
import { Button } from "@/components/ui";

const ESTADO_INICIAL: EstadoDesdeMail = { estado: "inicial" };

function BotonRecibido() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="confirm" disabled={pending} className="w-full">
      {pending ? "Confirmando…" : "Recibido"}
    </Button>
  );
}

/*
 * En este paso ya no compite con "Recibido": es LA acción que se está por
 * hacer, así que va con el peso de la marca y no apagado.
 */
function BotonNoLlego() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Guardando…" : "Todavía no me llegó"}
    </Button>
  );
}

/** Los mismos dos botones de la app, pero sin necesidad de entrar. */
export function Responder({ token, abrirNota }: { token: string; abrirNota: boolean }) {
  const [confirmacion, accionConfirmar] = useActionState(confirmarDesdeMail, ESTADO_INICIAL);
  const [rechazo, accionNoRecibido] = useActionState(noRecibidoDesdeMail, ESTADO_INICIAL);
  const [explicando, setExplicando] = useState(abrirNota);

  const error =
    confirmacion.estado === "error"
      ? confirmacion.mensaje
      : rechazo.estado === "error"
        ? rechazo.mensaje
        : null;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
          {error}
        </p>
      )}

      {explicando ? (
        <form action={accionNoRecibido} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="nota" className="text-[15px] font-medium">
            ¿Querés contarle algo? (opcional)
          </label>
          <textarea
            id="nota"
            name="nota"
            rows={3}
            maxLength={500}
            placeholder="Por ejemplo: no me figura en la cuenta al día de hoy."
            className="w-full rounded-campo border border-line bg-surface-sunk p-3 text-[16px] text-ink"
          />
          <p className="m-0 text-[15px] text-muted">
            Queda entre ustedes dos y no deja ninguna marca: tu inquilino va a poder volver a
            reportarlo.
          </p>
          <BotonNoLlego />
          <Button type="button" variant="quiet" onClick={() => setExplicando(false)}>
            Volver
          </Button>
        </form>
      ) : (
        <>
          <form action={accionConfirmar}>
            <input type="hidden" name="token" value={token} />
            <BotonRecibido />
          </form>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => setExplicando(true)}
          >
            Todavía no me llegó
          </Button>
        </>
      )}
    </div>
  );
}
