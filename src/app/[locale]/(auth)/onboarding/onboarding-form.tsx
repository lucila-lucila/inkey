"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { traducirAviso } from "@/i18n/texto";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { completarOnboarding, type EstadoOnboarding } from "./actions";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Intencion } from "@/lib/validation/profile";

const ESTADO_INICIAL: EstadoOnboarding = { estado: "inicial" };

const OPCIONES: Array<{ valor: Intencion; clave: "Inquilino" | "Propietario" }> = [
  { valor: "inquilino", clave: "Inquilino" },
  { valor: "propietario", clave: "Propietario" },
];

function BotonGuardar() {
  const t = useTranslations("onboarding");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t("guardando") : t("guardar")}
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
  const t = useTranslations("onboarding");
  const tt = useTranslations();
  const [estado, accion] = useActionState(completarOnboarding, ESTADO_INICIAL);
  const [intencion, setIntencion] = useState<Intencion>(intencionInicial);
  const error = estado.estado === "error" ? estado : undefined;
  const errorDe = (campo: string) =>
    error?.campo === campo ? traducirAviso(tt, error) : undefined;

  return (
    <form action={accion} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="volver_a" value={volverA} />
      <input type="hidden" name="intencion" value={intencion} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("nombre")} htmlFor="first_name" error={errorDe("first_name")}>
          <Input id="first_name" name="first_name" autoComplete="given-name" required />
        </Field>
        <Field label={t("apellido")} htmlFor="last_name" error={errorDe("last_name")}>
          <Input id="last_name" name="last_name" autoComplete="family-name" required />
        </Field>
      </div>

      <Field
        label={t("celular")}
        htmlFor="phone"
        hint={t("pistaCelular")}
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
        <legend className="mb-2 text-[15px] font-medium">{t("quePrimero")}</legend>
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
              <span className="block text-[16px] font-medium text-ink">
                {t(`opcion${opcion.clave}Titulo`)}
              </span>
              <span className="block text-[15px] text-muted">{t(`opcion${opcion.clave}Detalle`)}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[15px] text-muted">
          {t("soloParaEmpezar")}
        </p>
      </fieldset>

      <div className="flex flex-col gap-1 border-t-[1.5px] border-dashed border-line pt-4">
        <Checkbox
          id="acepta_terminos"
          name="acepta_terminos"
          label={
            t.rich("aceptoTerminos", {
              link: (partes) => (
                <Link href="/terminos" target="_blank" className="font-medium text-confirm-ink">
                  {partes}
                </Link>
              ),
            })
          }
        />
        <Checkbox
          id="acepta_privacidad"
          name="acepta_privacidad"
          label={
            t.rich("leiPrivacidad", {
              link: (partes) => (
                <Link href="/privacidad" target="_blank" className="font-medium text-confirm-ink">
                  {partes}
                </Link>
              ),
            })
          }
        />
      </div>

      {error && !error.campo && (
        <p role="alert" className="text-[15px] text-primary-ink">
          {traducirAviso(tt, error)}
        </p>
      )}
      {error?.campo?.startsWith("acepta") && (
        <p role="alert" className="text-[15px] text-primary-ink">
          {traducirAviso(tt, error)}
        </p>
      )}

      <BotonGuardar />
    </form>
  );
}
