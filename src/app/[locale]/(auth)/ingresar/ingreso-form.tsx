"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  entrarConCodigo,
  enviarMagicLink,
  ingresarConGoogle,
  type EstadoCodigo,
  type EstadoIngreso,
} from "./actions";
import { useTranslations } from "next-intl";
import { texto } from "@/i18n/texto";
import { Link } from "@/i18n/navigation";
import { Button, Field, Input } from "@/components/ui";
import type { Intencion } from "@/lib/validation/profile";
import { LARGO_CODIGO } from "@/lib/validation/codigo";

const ESTADO_INICIAL: EstadoIngreso = { estado: "inicial" };

function BotonEnviar() {
  const t = useTranslations("ingreso");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t("enviando") : t("enviarme")}
    </Button>
  );
}

function BotonCodigo() {
  const t = useTranslations("ingreso");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t("entrando") : t("entrarConCodigo")}
    </Button>
  );
}

function BotonGoogle() {
  const t = useTranslations("ingreso");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      {pending ? t("abriendoGoogle") : t("conGoogle")}
    </Button>
  );
}

/**
 * Después de pedir el mail: el link y, abajo, el código.
 *
 * Los dos caminos llevan al mismo lado. El código está porque algunos
 * servicios de correo abren los links solos para revisarlos y los gastan.
 */
function Revisa({
  email,
  volverA,
  intencion,
}: {
  email: string;
  volverA: string;
  intencion?: Intencion | null;
}) {
  const t = useTranslations("ingreso");
  const tt = useTranslations();
  const [estado, accion] = useActionState(entrarConCodigo, { estado: "inicial" } as EstadoCodigo);

  return (
    <div aria-live="polite" className="flex flex-col gap-5">
      <div>
        <h2 className="mt-0 mb-2 t-titulo text-primary-ink">{t("miraTuCasilla")}</h2>
        <p className="m-0 text-body">
          {t.rich("teMandamos", {
            email: () => <strong className="text-ink">{email}</strong>,
          })}
        </p>
      </div>

      <form action={accion} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="volver_a" value={volverA} />
        {intencion && <input type="hidden" name="intencion" value={intencion} />}
        <Field
          label={t("campoCodigo")}
          htmlFor="codigo"
          hint={t("pistaCodigo")}
          error={estado.estado === "error" ? texto(tt, estado.mensaje) : undefined}
        >
          <Input
            id="codigo"
            name="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={LARGO_CODIGO.maximo + 2}
            minLength={LARGO_CODIGO.minimo}
            placeholder="123456"
            required
            className="text-center text-[24px] tracking-[0.4em]"
            aria-describedby={estado.estado === "error" ? "codigo-error" : "codigo-hint"}
          />
        </Field>
        <BotonCodigo />
      </form>

      <p className="m-0 text-[15px] text-muted">
        {t("noTeLlego")}{" "}
        <Link href="/ingresar" className="font-medium text-confirm-ink">
          {t("pedirOtro")}
        </Link>
        .
      </p>
    </div>
  );
}

export function IngresoForm({
  volverA,
  intencion,
}: {
  volverA: string;
  /** Lo que eligió en la landing, para que el onboarding llegue con la respuesta puesta. */
  intencion?: Intencion | null;
}) {
  const t = useTranslations("ingreso");
  const tt = useTranslations();
  const [estado, accion] = useActionState(enviarMagicLink, ESTADO_INICIAL);

  if (estado.estado === "enviado") {
    return <Revisa email={estado.email} volverA={volverA} intencion={intencion} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <form action={accion} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="volver_a" value={volverA} />
        {intencion && <input type="hidden" name="intencion" value={intencion} />}
        <Field
          label={t("tuMail")}
          htmlFor="email"
          hint={t("pistaMail")}
          error={estado.estado === "error" ? texto(tt, estado.mensaje) : undefined}
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
        <span className="h-px flex-1 bg-line" />
        {t("o")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={ingresarConGoogle}>
        <input type="hidden" name="volver_a" value={volverA} />
        {intencion && <input type="hidden" name="intencion" value={intencion} />}
        <BotonGoogle />
      </form>
    </div>
  );
}
