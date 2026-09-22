"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { crearAlquiler, type EstadoNuevoAlquiler } from "./actions";
import { CompartirInvitacion } from "@/components/alquiler/compartir-invitacion";
import { useTranslations } from "next-intl";
import { traducirMensaje } from "@/i18n/texto";
import { Button, ButtonLink, CampoMonto, Card, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { claveDeRol } from "@/lib/domain/alquiler";
import {
  datosAlquilerSchema,
  pasoDelCampo,
  PASOS_ALQUILER,
  type RolAlquiler,
} from "@/lib/validation/rental";

const ESTADO_INICIAL: EstadoNuevoAlquiler = { estado: "inicial" };

function BotonGuardar() {
  const tn = useTranslations("alquilerNuevo");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? tn("guardando") : tn("guardarEInvitar")}
    </Button>
  );
}

export function NuevoAlquilerForm({ rol }: { rol: RolAlquiler }) {
  const [estado, accion] = useActionState(crearAlquiler, ESTADO_INICIAL);
  const t = useTranslations();
  const tn = useTranslations("alquilerNuevo");
  const [paso, setPaso] = useState(0);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const errorDelServidor = estado.estado === "error" ? estado : undefined;
  /* Lo que llega es una clave: el texto lo pone el archivo de idiomas. */
  const errorDe = (campo: string) => {
    const clave =
      errores[campo] ?? (errorDelServidor?.campo === campo ? errorDelServidor.mensaje : undefined);
    return clave ? traducirMensaje(t, clave) : undefined;
  };

  /** Valida solo los campos del paso actual antes de dejar avanzar. */
  function continuar() {
    const form = formRef.current;
    if (!form) return;

    const datos = Object.fromEntries(new FormData(form).entries());
    const resultado = datosAlquilerSchema.safeParse({ ...datos, rol });
    const campos: readonly string[] = PASOS_ALQUILER[paso].campos;

    const delPaso: Record<string, string> = {};
    if (!resultado.success) {
      for (const problema of resultado.error.issues) {
        const campo = String(problema.path[0] ?? "");
        if (campos.includes(campo) && !delPaso[campo]) delPaso[campo] = problema.message;
      }
    }

    setErrores(delPaso);
    if (Object.keys(delPaso).length === 0) setPaso((actual) => actual + 1);
  }

  if (estado.estado === "creado") {
    return (
      <div className="flex flex-col gap-6">
        <Card hero >
          <p className="t-etiqueta mt-0 mb-2 text-primary-ink">{tn("alquilerGuardado")}</p>
          <CompartirInvitacion
            url={estado.url}
            rentalId={estado.rentalId}
            barrio={estado.barrio}
            rolInvitado={estado.rolInvitado}
            nombre={estado.nombre}
          />
        </Card>

        {estado.avisoArchivo && (
          <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
            {estado.avisoArchivo}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/alquileres/${estado.rentalId}`} variant="secondary">
            Ver el alquiler
          </ButtonLink>
          <Link href="/panel" className="self-center text-[15px] font-medium text-confirm-ink">
            {tn("volverAlPanel")}
          </Link>
        </div>
      </div>
    );
  }

  const esUltimo = paso === PASOS_ALQUILER.length - 1;
  const pasoDelError = errorDelServidor?.campo ? pasoDelCampo(errorDelServidor.campo) : null;

  return (
    <form ref={formRef} action={accion} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="rol" value={rol} />

      {/*
        Todo error del servidor se muestra acá arriba, pase lo que pase: si el
        campo que falló está en otro paso, ofrecemos ir hasta él.
      */}
      {errorDelServidor && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-campo bg-primary-soft p-4 text-[15px] text-primary-ink"
        >
          <p className="m-0">{traducirMensaje(t, errorDelServidor.mensaje)}</p>
          {pasoDelError !== null && pasoDelError !== paso && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setErrores({ [errorDelServidor.campo!]: errorDelServidor.mensaje });
                setPaso(pasoDelError);
              }}
            >
              {tn("irAlPaso", { paso: pasoDelError + 1 })}
            </Button>
          )}
        </div>
      )}

      <div>
        <p className="t-etiqueta m-0 text-muted">
          {tn("pasoDe", { paso: paso + 1, total: PASOS_ALQUILER.length })}
        </p>
        <h1 className="mt-1 mb-0 t-titulo">
          {t(`dominio.pasoAlquiler.${PASOS_ALQUILER[paso].clave}`)}
        </h1>
      </div>

      {/* Los pasos quedan montados: así no se pierde lo ya cargado al volver. */}
      <div hidden={paso !== 0} className="flex flex-col gap-4">
        <Field
          label={tn("direccion")}
          htmlFor="full_address"
          hint={tn("pistaDireccion")}
          error={errorDe("full_address")}
        >
          <Input
            id="full_address"
            name="full_address"
            autoComplete="street-address"
            placeholder="Gurruchaga 1234, 3° B"
          />
        </Field>
        <Field
          label={tn("barrioCiudad")}
          htmlFor="neighborhood_label"
          hint={tn("pistaBarrio")}
          error={errorDe("neighborhood_label")}
        >
          <Input id="neighborhood_label" name="neighborhood_label" placeholder="Palermo, CABA" />
        </Field>
      </div>

      <div hidden={paso !== 1} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tn("empezoEl")} htmlFor="start_date" error={errorDe("start_date")}>
            <Input id="start_date" name="start_date" type="date" />
          </Field>
          <Field
            label={tn("terminaEl")}
            htmlFor="end_date"
            hint={tn("pistaTermina")}
            error={errorDe("end_date")}
          >
            <Input id="end_date" name="end_date" type="date" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label={tn("cuantoPagas")} htmlFor="monthly_amount" error={errorDe("monthly_amount")}>
            <CampoMonto id="monthly_amount" name="monthly_amount" placeholder="450.000" />
          </Field>
          <Field label={tn("moneda")} htmlFor="currency" error={errorDe("currency")}>
            <select
              id="currency"
              name="currency"
              defaultValue="ARS"
              className="min-h-[52px] w-full rounded-campo border border-line bg-surface-sunk px-4 text-[17px] text-ink"
            >
              <option value="ARS">{tn("pesos")}</option>
              <option value="USD">{tn("dolares")}</option>
            </select>
          </Field>
        </div>

        <Field
          label={tn("diaVencimiento")}
          htmlFor="due_day"
          hint={tn("pistaDia")}
          error={errorDe("due_day")}
        >
          <Input id="due_day" name="due_day" type="number" min={1} max={31} placeholder="10" />
        </Field>
      </div>

      <div hidden={paso !== 2} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={tn("indice")}
            htmlFor="adjustment_index"
            hint={tn("pistaIndice")}
            error={errorDe("adjustment_index")}
          >
            <Input id="adjustment_index" name="adjustment_index" placeholder="ICL" list="indices" />
          </Field>
          <Field
            label={tn("ajustaCada")}
            htmlFor="adjustment_every_months"
            hint={tn("pistaAjusta")}
            error={errorDe("adjustment_every_months")}
          >
            <Input
              id="adjustment_every_months"
              name="adjustment_every_months"
              type="number"
              min={1}
              max={60}
              placeholder="6"
            />
          </Field>
        </div>
        <datalist id="indices">
          <option value="ICL" />
          <option value="IPC" />
          <option value="Fijo" />
        </datalist>

        <Field
          label={tn("contrato")}
          htmlFor="contrato"
          hint={tn("pistaContrato")}
        >
          <input
            id="contrato"
            name="contrato"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="min-h-[52px] w-full rounded-campo border border-line bg-surface-sunk p-3 text-[15px] file:mr-3 file:min-h-[36px] file:rounded-lg file:border-0 file:bg-surface-sunk file:px-3 file:font-medium file:text-ink"
          />
        </Field>

        <p className="m-0 text-[15px] text-body">
          {t("alquilerNuevo.alGuardar", {
            rol: t(claveDeRol(rol === "inquilino" ? "owner" : "tenant")),
          })}
        </p>
      </div>

      <div className={cn("flex gap-3", paso > 0 ? "justify-between" : "justify-end")}>
        {paso > 0 && (
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              setErrores({});
              setPaso((actual) => actual - 1);
            }}
          >
            {tn("volver")}
          </Button>
        )}
        {esUltimo ? (
          <BotonGuardar />
        ) : (
          <Button type="button" onClick={continuar}>
            {tn("continuar")}
          </Button>
        )}
      </div>
    </form>
  );
}
