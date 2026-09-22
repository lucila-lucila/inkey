"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  enviarInvitacionPorMail,
  type EstadoInvitacionMail,
} from "@/app/[locale]/(app)/alquileres/invitacion-actions";
import { Button, Field, Input } from "@/components/ui";
import {
  enlaceMail,
  enlaceWhatsApp,
  mensajeInvitacion,
  claveDeRol,
} from "@/lib/domain/alquiler";

/** El token vive solo en el link: de la base guardamos únicamente su hash. */
function tokenDelEnlace(url: string): string {
  return url.split("/").filter(Boolean).pop() ?? "";
}

function BotonMail() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Enviando…" : "Enviar"}
    </Button>
  );
}

/**
 * El link de invitación. Se muestra una sola vez: de la base guardamos solo el
 * hash del token, así que si se pierde hay que generar uno nuevo.
 */
export function CompartirInvitacion({
  url,
  rentalId,
  barrio,
  rolInvitado,
  nombre,
}: {
  /** El link completo, armado en el servidor. */
  url: string;
  rentalId: string;
  barrio: string;
  rolInvitado: "owner" | "tenant";
  nombre: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [porMail, setPorMail] = useState(false);
  const [estadoMail, enviarPorMail] = useActionState(enviarInvitacionPorMail, {
    estado: "inicial",
  } as EstadoInvitacionMail);

  const t = useTranslations();
  const mensaje = mensajeInvitacion({ t, rolInvitado, nombre, barrio, url });
  const rol = t(claveDeRol(rolInvitado));

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="mt-0 mb-1.5 t-subtitulo">
          Invitá a tu {rol}
        </h2>
        <p className="m-0 text-body">
          Mandale este link. Lo abre, ve el resumen y confirma con un toque: no necesita crear
          contraseña.
        </p>
      </div>

      <a
        href={enlaceWhatsApp(mensaje)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-primary px-6 text-[17px] font-medium text-on-primary no-underline hover:brightness-110"
      >
        Enviar por WhatsApp
      </a>

      <div className="flex flex-col gap-2">
        <label htmlFor="link-invitacion" className="text-[15px] font-medium">
          O copiá el link
        </label>
        <div className="flex gap-2.5 max-[560px]:flex-col">
          <input
            id="link-invitacion"
            readOnly
            value={url}
            onFocus={(evento) => evento.currentTarget.select()}
            className="min-h-[52px] w-full min-w-0 flex-1 rounded-campo border border-line bg-surface-sunk px-4 text-[15px] text-ink"
          />
          <Button type="button" variant="secondary" onClick={copiar}>
            {copiado ? "¡Copiado!" : "Copiar"}
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copiado ? "Link copiado" : ""}
        </p>
      </div>

      {/* Por mail, desde Inkey: le llega el link con el resumen del alquiler. */}
      {estadoMail.estado === "listo" ? (
        <p className="m-0 rounded-campo bg-confirm-soft p-3 text-[15px] text-confirm-ink">
          Le mandamos el link a {estadoMail.para}. Si no lo ve, que revise el correo no deseado.
        </p>
      ) : porMail ? (
        <form action={enviarPorMail} className="flex flex-col gap-3">
          <input type="hidden" name="rental_id" value={rentalId} />
          <input type="hidden" name="token" value={tokenDelEnlace(url)} />
          <Field
            label={`Mail de tu ${rol}`}
            htmlFor="mail-invitacion"
            error={estadoMail.estado === "error" ? estadoMail.mensaje : undefined}
          >
            <Input
              id="mail-invitacion"
              name="email"
              type="email"
              autoComplete="off"
              inputMode="email"
              placeholder="nombre@mail.com"
              required
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <BotonMail />
            <Button type="button" variant="quiet" onClick={() => setPorMail(false)}>
              Mejor no
            </Button>
          </div>
          <a
            href={enlaceMail({ asunto: `Confirmá el alquiler de ${barrio} en Inkey`, mensaje })}
            className="text-[15px] font-medium text-confirm-ink"
          >
            Prefiero mandarlo desde mi correo
          </a>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setPorMail(true)}
          className="self-start border-0 bg-transparent p-0 text-[15px] font-medium text-confirm-ink underline-offset-2 hover:underline"
        >
          Prefiero mandarlo por mail
        </button>
      )}

      <p className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
        Guardalo ahora: por seguridad, este link no se vuelve a mostrar. Si lo perdés, generá uno
        nuevo desde el alquiler. Vence en 7 días.
      </p>
    </div>
  );
}
