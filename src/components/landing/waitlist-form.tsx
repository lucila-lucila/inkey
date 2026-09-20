"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sumarseALista, type EstadoLista } from "@/app/(marketing)/actions";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { RolLista } from "@/lib/validation/waitlist";

const ESTADO_INICIAL: EstadoLista = { estado: "inicial" };

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={pending ? "cursor-progress" : undefined}>
      {pending ? "Anotando…" : "Quiero entrar primero"}
    </Button>
  );
}

export function WaitlistForm() {
  const [rol, setRol] = useState<RolLista>("inquilino");
  const [estado, accion] = useActionState(sumarseALista, ESTADO_INICIAL);
  const listoRef = useRef<HTMLDivElement>(null);

  // Al confirmar, llevamos el foco al mensaje de éxito.
  useEffect(() => {
    if (estado.estado === "ok") listoRef.current?.focus();
  }, [estado]);

  if (estado.estado === "ok") {
    return (
      <div
        id="lista"
        className="max-w-[560px] rounded-panel border-[1.5px] border-ink bg-surface p-[22px]"
      >
        <div ref={listoRef} tabIndex={-1} className="outline-none">
          <h3 className="mt-1 mb-1.5 font-serif text-[30px] font-semibold text-terra-ink">
            ¡Listo, estás adentro!
          </h3>
          <p className="m-0 text-body">
            Te anotamos como {estado.rol === "inquilino" ? "inquilino/a" : "propietario/a"}. Te
            escribimos apenas abramos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id="lista"
      className="max-w-[560px] rounded-panel border-[1.5px] border-ink bg-surface p-[22px]"
    >
      <form action={accion} noValidate>
        <input type="hidden" name="rol" value={rol} />
        {/* Trampa para bots: invisible y fuera del alcance del teclado. */}
        <p className="absolute -left-[9999px]">
          <label>
            No completar
            <input name="bot-field" tabIndex={-1} autoComplete="off" />
          </label>
        </p>

        <div
          role="group"
          aria-label="¿Quién sos?"
          className="mb-4 inline-grid grid-cols-2 gap-1.5 rounded-full bg-pill p-[5px] max-[560px]:grid max-[560px]:w-full"
        >
          {(
            [
              ["inquilino", "Soy inquilino/a"],
              ["propietario", "Soy propietario/a"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={rol === valor}
              onClick={() => setRol(valor)}
              className={cn(
                "min-h-[44px] cursor-pointer rounded-full border-0 px-[18px] py-2.5 text-[15px] font-semibold",
                "max-[560px]:px-2 max-[560px]:text-[14px]",
                rol === valor ? "bg-green text-white" : "bg-transparent text-ink",
              )}
            >
              {texto}
            </button>
          ))}
        </div>

        <Field label="Tu mail" htmlFor="email">
          <div className="flex gap-2.5 max-[560px]:flex-col">
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nombre@mail.com"
              required
              aria-describedby={estado.estado === "error" ? "lista-error" : undefined}
              className="flex-1"
            />
            <BotonEnviar />
          </div>
        </Field>

        {estado.estado === "error" && (
          <p id="lista-error" role="alert" className="mt-3 text-[15px] text-terra-ink">
            {estado.mensaje}
          </p>
        )}

        <p className="mt-3 text-[14px] text-muted">
          Gratis. Sin datos crediticios. Te avisamos cuando abramos.
        </p>
      </form>
    </div>
  );
}
