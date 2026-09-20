"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { completarOnboarding, type EstadoOnboarding } from "./actions";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Intencion } from "@/lib/validation/profile";

const ESTADO_INICIAL: EstadoOnboarding = { estado: "inicial" };

const OPCIONES: Array<{ valor: Intencion; titulo: string; detalle: string }> = [
  {
    valor: "inquilino",
    titulo: "Registrar mi alquiler",
    detalle: "Alquilo y quiero armar mi historial.",
  },
  {
    valor: "propietario",
    titulo: "Registrar una propiedad",
    detalle: "Tengo una propiedad en alquiler.",
  },
];

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Guardando…" : "Listo, empezar"}
    </Button>
  );
}

export function OnboardingForm({
  volverA,
  intencionInicial,
}: {
  volverA: string;
  intencionInicial: Intencion;
}) {
  const [estado, accion] = useActionState(completarOnboarding, ESTADO_INICIAL);
  const [intencion, setIntencion] = useState<Intencion>(intencionInicial);
  const error = estado.estado === "error" ? estado : undefined;
  const errorDe = (campo: string) => (error?.campo === campo ? error.mensaje : undefined);

  return (
    <form action={accion} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="volver_a" value={volverA} />
      <input type="hidden" name="intencion" value={intencion} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="first_name" error={errorDe("first_name")}>
          <Input id="first_name" name="first_name" autoComplete="given-name" required />
        </Field>
        <Field label="Apellido" htmlFor="last_name" error={errorDe("last_name")}>
          <Input id="last_name" name="last_name" autoComplete="family-name" required />
        </Field>
      </div>

      <Field
        label="Celular"
        htmlFor="phone"
        hint="Lo usamos para avisarte por WhatsApp. Nunca aparece en tu perfil público."
        error={errorDe("phone")}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+54 9 11 5555 5555"
          required
        />
      </Field>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-[15px] font-medium">¿Qué querés hacer primero?</legend>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {OPCIONES.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={intencion === opcion.valor}
              onClick={() => setIntencion(opcion.valor)}
              className={cn(
                "min-h-[44px] cursor-pointer rounded-campo border p-3.5 text-left",
                intencion === opcion.valor
                  ? "border-confirm bg-confirm-soft"
                  : "border-line bg-transparent",
              )}
            >
              <span className="block text-[16px] font-medium text-ink">{opcion.titulo}</span>
              <span className="block text-[15px] text-muted">{opcion.detalle}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[15px] text-muted">
          Es solo para saber por dónde empezar: después podés hacer las dos cosas.
        </p>
      </fieldset>

      <div className="flex flex-col gap-1 border-t-[1.5px] border-dashed border-line pt-4">
        <Checkbox
          id="acepta_terminos"
          name="acepta_terminos"
          label={<>Acepto los <strong>[TÉRMINOS Y CONDICIONES]</strong>.</>}
        />
        <Checkbox
          id="acepta_privacidad"
          name="acepta_privacidad"
          label={
            <>
              Leí la <strong>[POLÍTICA DE PRIVACIDAD]</strong> y acepto el tratamiento de mis datos.
            </>
          }
        />
      </div>

      {error && !error.campo && (
        <p role="alert" className="text-[15px] text-primary-ink">
          {error.mensaje}
        </p>
      )}
      {error?.campo?.startsWith("acepta") && (
        <p role="alert" className="text-[15px] text-primary-ink">
          {error.mensaje}
        </p>
      )}

      <BotonGuardar />
    </form>
  );
}
