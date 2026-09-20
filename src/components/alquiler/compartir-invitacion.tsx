"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  enlaceMail,
  enlaceWhatsApp,
  mensajeInvitacion,
  textoRol,
} from "@/lib/domain/alquiler";

/**
 * El link de invitación. Se muestra una sola vez: de la base guardamos solo el
 * hash del token, así que si se pierde hay que generar uno nuevo.
 */
export function CompartirInvitacion({
  url,
  barrio,
  rolInvitado,
  nombre,
}: {
  /** El link completo, armado en el servidor. */
  url: string;
  barrio: string;
  rolInvitado: "owner" | "tenant";
  nombre: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const mensaje = mensajeInvitacion({ rolInvitado, nombre, barrio, url });
  const rol = textoRol(rolInvitado);

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
        <h2 className="mt-0 mb-1.5 font-serif text-[24px] font-semibold">
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
        className="inline-flex min-h-[52px] items-center justify-center rounded-control bg-green px-6 text-[17px] font-semibold text-white no-underline hover:brightness-110"
      >
        Enviar por WhatsApp
      </a>

      <div className="flex flex-col gap-2">
        <label htmlFor="link-invitacion" className="text-[14px] font-semibold">
          O copiá el link
        </label>
        <div className="flex gap-2.5 max-[560px]:flex-col">
          <input
            id="link-invitacion"
            readOnly
            value={url}
            onFocus={(evento) => evento.currentTarget.select()}
            className="min-h-[52px] w-full min-w-0 flex-1 rounded-control border-[1.5px] border-line bg-bg px-4 text-[15px] text-ink"
          />
          <Button type="button" variant="outline" onClick={copiar}>
            {copiado ? "¡Copiado!" : "Copiar"}
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copiado ? "Link copiado" : ""}
        </p>
      </div>

      <a
        href={enlaceMail({ asunto: `Confirmá el alquiler de ${barrio} en Inkey`, mensaje })}
        className="text-[15px] font-medium text-green-ink"
      >
        Prefiero mandarlo por mail
      </a>

      <p className="m-0 rounded-control bg-terra-tint p-3 text-[14px] text-terra-ink">
        Guardalo ahora: por seguridad, este link no se vuelve a mostrar. Si lo perdés, generá uno
        nuevo desde el alquiler. Vence en 7 días.
      </p>
    </div>
  );
}
