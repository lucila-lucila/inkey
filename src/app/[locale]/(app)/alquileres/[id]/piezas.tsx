"use client";

import { useTranslations } from "next-intl";
import { traducirMensaje } from "@/i18n/texto";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  cancelarAlquiler,
  generarNuevoLink,
  subirContrato,
  verContrato,
  type EstadoContrato,
  type EstadoLink,
} from "./actions";
import { CompartirInvitacion } from "@/components/alquiler/compartir-invitacion";
import { Button } from "@/components/ui";

function BotonEnvio({ texto, enCurso }: { texto: string; enCurso: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary">
      {pending ? enCurso : texto}
    </Button>
  );
}

/** "Generar un link nuevo": revoca el anterior y muestra el nuevo una vez. */
export function NuevoLink({
  rentalId,
  hayInvitacionViva,
}: {
  rentalId: string;
  hayInvitacionViva: boolean;
}) {
  const t = useTranslations();
  const [estado, accion] = useActionState(generarNuevoLink, { estado: "inicial" } as EstadoLink);

  if (estado.estado === "listo") {
    return (
      <CompartirInvitacion
        url={estado.url}
        rentalId={rentalId}
        barrio={estado.barrio}
        rolInvitado={estado.rolInvitado}
        nombre={estado.nombre}
      />
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="rental_id" value={rentalId} />
      <BotonEnvio
        texto={hayInvitacionViva ? t("invitar.generarNuevo") : t("invitar.generarPrimero")}
        enCurso={t("invitar.generando")}
      />
      {hayInvitacionViva && (
        <p className="m-0 text-[15px] text-muted">
          El link anterior deja de funcionar apenas generás uno nuevo.
        </p>
      )}
      {estado.estado === "error" && (
        <p role="alert" className="m-0 text-[15px] text-primary-ink">
          {traducirMensaje(t, estado.mensaje)}
        </p>
      )}
    </form>
  );
}

/** El contrato se abre con una URL firmada que dura un minuto. */
export function BotonContrato({ rentalId }: { rentalId: string }) {
  const t = useTranslations();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir() {
    setCargando(true);
    setError(null);
    const resultado = await verContrato(rentalId);
    setCargando(false);

    if ("url" in resultado) {
      window.open(resultado.url, "_blank", "noopener,noreferrer");
    } else {
      setError(resultado.error);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={abrir} disabled={cargando}>
        {cargando ? t("contrato.abriendo") : t("contrato.ver")}
      </Button>
      {error && (
        <p role="alert" className="m-0 text-[15px] text-primary-ink">
          {traducirMensaje(t, error)}
        </p>
      )}
    </div>
  );
}

export function SubirContrato({ rentalId }: { rentalId: string }) {
  const t = useTranslations();
  const [estado, accion] = useActionState(subirContrato, { estado: "inicial" } as EstadoContrato);

  if (estado.estado === "listo") {
    return <p className="m-0 text-[15px] text-confirm-ink">{t("contrato.guardado")}</p>;
  }

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="rental_id" value={rentalId} />
      <label htmlFor="contrato" className="text-[15px] font-medium">
        Adjuntar el contrato
      </label>
      <input
        id="contrato"
        name="contrato"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="min-h-[52px] w-full rounded-campo border border-line bg-surface-sunk p-3 text-[15px] file:mr-3 file:min-h-[36px] file:rounded-lg file:border-0 file:bg-surface-sunk file:px-3 file:font-medium file:text-ink"
      />
      <p className="m-0 text-[15px] text-muted">
        PDF o foto, hasta 10 MB. Queda privado: solo lo ven vos y la otra parte.
      </p>
      <BotonEnvio texto="Subir" enCurso={t("contrato.subiendo")} />
      {estado.estado === "error" && (
        <p role="alert" className="m-0 text-[15px] text-primary-ink">
          {traducirMensaje(t, estado.mensaje)}
        </p>
      )}
    </form>
  );
}

export function CancelarAlquiler({ rentalId }: { rentalId: string }) {
  const t = useTranslations();
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="quiet" onClick={() => setConfirmando(true)}>
        Cancelar este alquiler
      </Button>
    );
  }

  return (
    <form action={cancelarAlquiler} className="flex flex-col gap-3">
      <input type="hidden" name="rental_id" value={rentalId} />
      <p className="m-0 text-[15px] text-body">
        Se borra el alquiler y el link deja de funcionar. Esto no se puede deshacer.
      </p>
      <div className="flex flex-wrap gap-3">
        <BotonEnvio texto={t("contrato.siCancelar")} enCurso={t("contrato.cancelando")} />
        <Button type="button" variant="quiet" onClick={() => setConfirmando(false)}>
          Mejor no
        </Button>
      </div>
    </form>
  );
}
