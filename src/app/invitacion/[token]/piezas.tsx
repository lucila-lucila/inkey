"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { aceptarInvitacion, rechazarInvitacion } from "./actions";
import { Button } from "@/components/ui";

function BotonAceptar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Confirmando…" : "Sí, lo confirmo"}
    </Button>
  );
}

function BotonRechazar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="w-full">
      {pending ? "Enviando…" : "No, no es mía"}
    </Button>
  );
}

export function Aceptar({ token }: { token: string }) {
  return (
    <form action={aceptarInvitacion}>
      <input type="hidden" name="token" value={token} />
      <BotonAceptar />
    </form>
  );
}

/** Rechazar es definitivo para este alquiler, así que se pregunta una vez más. */
export function Rechazar({ token, rol }: { token: string; rol: string }) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setConfirmando(true)}>
        No soy {rol === "owner" ? "el dueño" : "el inquilino"} de esta propiedad
      </Button>
    );
  }

  return (
    <form action={rechazarInvitacion} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <p className="m-0 text-[15px] text-body">
        Le vamos a avisar a quien te mandó el link que se equivocó de contacto. El alquiler queda
        cancelado.
      </p>
      <BotonRechazar />
      <Button type="button" variant="quiet" className="w-full" onClick={() => setConfirmando(false)}>
        Volver
      </Button>
    </form>
  );
}
