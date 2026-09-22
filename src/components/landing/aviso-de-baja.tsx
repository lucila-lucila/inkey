"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * "Listo, tu cuenta quedó dada de baja", al volver de la baja a la landing.
 *
 * Es un componente de cliente a propósito: leer el parámetro en el servidor
 * volvería dinámica la landing entera, que es la página más visitada y la
 * única que conviene servir estática.
 */
export function AvisoDeBaja() {
  const t = useTranslations("landing");
  const parametros = useSearchParams();
  if (parametros.get("baja") !== "lista") return null;

  return (
    <div className="wrap pt-6">
      <p
        role="status"
        className="m-0 rounded-campo bg-confirm-soft p-4 text-[15px] text-confirm-ink"
      >
        {t("avisoDeBaja")}
      </p>
    </div>
  );
}
