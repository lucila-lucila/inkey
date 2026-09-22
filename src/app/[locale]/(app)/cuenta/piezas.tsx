"use client";

import { useTranslations } from "next-intl";
import { traducirMensaje } from "@/i18n/texto";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { borrarCuenta, guardarDatos, type EstadoBaja, type EstadoDatos } from "./actions";
import { Button, Field, Input } from "@/components/ui";

function BotonGuardar() {
  const t = useTranslations();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary">
      {pending ? t("cuenta.guardando") : t("cuenta.guardar")}
    </Button>
  );
}

/** Nombre, apellido y celular. El mail no se edita: con él se entra. */
export function MisDatos({
  nombre,
  apellido,
  celular,
}: {
  nombre: string;
  apellido: string;
  celular: string;
}) {
  const t = useTranslations();
  const [estado, accion] = useActionState(guardarDatos, { estado: "inicial" } as EstadoDatos);
  const errorDe = (campo: string) =>
    estado.estado === "error" && estado.campo === campo ? traducirMensaje(t, estado.mensaje) : undefined;

  return (
    <form action={accion} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("cuenta.nombre")} htmlFor="first_name" error={errorDe("first_name")}>
          <Input id="first_name" name="first_name" defaultValue={nombre} autoComplete="given-name" required />
        </Field>
        <Field label={t("cuenta.apellido")} htmlFor="last_name" error={errorDe("last_name")}>
          <Input id="last_name" name="last_name" defaultValue={apellido} autoComplete="family-name" required />
        </Field>
      </div>

      <Field
        label={t("cuenta.celular")}
        htmlFor="phone"
        hint={t("cuenta.pistaCelular")}
        error={errorDe("phone")}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={celular}
          autoComplete="tel"
          required
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <BotonGuardar />
        {estado.estado === "guardado" && (
          <p role="status" className="m-0 text-[15px] font-medium text-confirm-ink">
            {t("cuenta.guardado")}
          </p>
        )}
        {estado.estado === "error" && !estado.campo && (
          <p role="alert" className="m-0 text-[15px] text-primary-ink">
            {traducirMensaje(t, estado.mensaje)}
          </p>
        )}
      </div>
    </form>
  );
}

function BotonBaja() {
  const t = useTranslations();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary">
      {pending ? t("cuenta.dandoDeBaja") : t("cuenta.darDeBaja")}
    </Button>
  );
}

/**
 * Darse de baja. Está detrás de dos puertas a propósito: abrir el panel y
 * escribir BORRAR. No se deshace.
 */
export function BorrarCuenta() {
  const [abierto, setAbierto] = useState(false);
  const t = useTranslations();
  const [estado, accion] = useActionState(borrarCuenta, { estado: "inicial" } as EstadoBaja);

  if (!abierto) {
    /*
      Una acción de texto y no un botón: darse de baja es algo que se ofrece,
      no algo que se invita a hacer. Un botón centrado en su propia tarjeta le
      daba el peso de una acción principal.
    */
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="cursor-pointer self-start border-0 bg-transparent p-0 text-left text-[16px] font-medium text-body underline underline-offset-4 hover:text-ink"
      >
        {t("cuenta.quieroBaja")}
      </button>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="rounded-campo bg-surface-sunk p-4 text-[15px] text-body">
        <p className="mt-0 mb-2 font-medium text-ink">{t("cuenta.quePasa")}</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>{t("cuenta.baja1")}</li>
          <li>{t("cuenta.baja2")}</li>
          <li>
            {t("cuenta.baja3")}
          </li>
          <li>{t("cuenta.baja4")}</li>
          <li>
            {t("cuenta.baja5")}
          </li>
          <li>{t("cuenta.baja6")}</li>
        </ul>
      </div>

      <p className="m-0 text-[15px] text-body">
        {t("cuenta.antesDeSeguir")}
      </p>

      <Field
        label={t("cuenta.escribiBorrar")}
        htmlFor="confirmacion"
        error={estado.estado === "error" ? traducirMensaje(t, estado.mensaje) : undefined}
      >
        <Input
          id="confirmacion"
          name="confirmacion"
          autoComplete="off"
          placeholder="BORRAR"
          required
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <BotonBaja />
        <Button type="button" variant="quiet" onClick={() => setAbierto(false)}>
          {t("cuenta.mejorNo")}
        </Button>
      </div>
    </form>
  );
}
