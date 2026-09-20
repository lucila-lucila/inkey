"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { enviarMagicLink, ingresarConGoogle, type EstadoIngreso } from "./actions";
import { Button, Field, Input } from "@/components/ui";

const ESTADO_INICIAL: EstadoIngreso = { estado: "inicial" };

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Enviando…" : "Enviarme el link"}
    </Button>
  );
}

function BotonGoogle() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      {pending ? "Abriendo Google…" : "Continuar con Google"}
    </Button>
  );
}

export function IngresoForm({ volverA }: { volverA: string }) {
  const [estado, accion] = useActionState(enviarMagicLink, ESTADO_INICIAL);

  if (estado.estado === "enviado") {
    return (
      <div aria-live="polite">
        <h2 className="mt-0 mb-2 t-titulo text-primary-ink">
          Mirá tu casilla
        </h2>
        <p className="m-0 text-body">
          Te mandamos un link a <strong className="text-ink">{estado.email}</strong>. Abrilo desde
          este mismo dispositivo y entrás sin contraseña. Si no aparece, fijate en spam.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form action={accion} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="volver_a" value={volverA} />
        <Field
          label="Tu mail"
          htmlFor="email"
          hint="Te mandamos un link para entrar. Sin contraseñas."
          error={estado.estado === "error" ? estado.mensaje : undefined}
        >
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nombre@mail.com"
            required
            aria-describedby={estado.estado === "error" ? "email-error" : "email-hint"}
          />
        </Field>
        <BotonEnviar />
      </form>

      <div className="flex items-center gap-3 text-[15px] text-muted">
        <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
      </div>

      <form action={ingresarConGoogle}>
        <input type="hidden" name="volver_a" value={volverA} />
        <BotonGoogle />
      </form>
    </div>
  );
}
