"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { aceptarInvitacion, rechazarInvitacion } from "./actions";
import { Button } from "@/components/ui";
import { claveDeRol } from "@/lib/domain/alquiler";

function BotonAceptar() {
  const t = useTranslations("invitacion");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="confirm" disabled={pending} className="w-full">
      {pending ? t("confirmando") : t("siConfirmo")}
    </Button>
  );
}

function BotonRechazar() {
  const t = useTranslations("invitacion");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      {pending ? t("enviando") : t("noEsMia")}
    </Button>
  );
}

export function Aceptar({ token }: { token: string }) {
  return (
    <form action={aceptarInvitacion}>
      <input type="hidden" name="token" value={token} />
      <BotonAceptar />
    </form>
  );
}

/** Rechazar es definitivo para este alquiler, así que se pregunta una vez más. */
export function Rechazar({ token, rol }: { token: string; rol: "owner" | "tenant" }) {
  const t = useTranslations("invitacion");
  const tt = useTranslations();
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="secondary" className="w-full" onClick={() => setConfirmando(true)}>
        {t("noSoy", { rol: tt(claveDeRol(rol)) })}
      </Button>
    );
  }

  return (
    <form action={rechazarInvitacion} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <p className="m-0 text-[15px] text-body">
        {t("leAvisaremos")}
      </p>
      <BotonRechazar />
      <Button type="button" variant="quiet" className="w-full" onClick={() => setConfirmando(false)}>
        {t("volver")}
      </Button>
    </form>
  );
}
