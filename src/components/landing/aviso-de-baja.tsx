"use client";

import { useSearchParams } from "next/navigation";

/**
 * "Listo, tu cuenta quedó dada de baja", al volver de la baja a la landing.
 *
 * Es un componente de cliente a propósito: leer el parámetro en el servidor
 * volvería dinámica la landing entera, que es la página más visitada y la
 * única que conviene servir estática.
 */
export function AvisoDeBaja() {
  const parametros = useSearchParams();
  if (parametros.get("baja") !== "lista") return null;

  return (
    <div className="wrap pt-6">
      <p
        role="status"
        className="m-0 rounded-campo bg-confirm-soft p-4 text-[15px] text-confirm-ink"
      >
        Listo, tu cuenta quedó dada de baja y borramos tus datos personales. Gracias por haber
        usado Inkey. Si algún día querés volver, tu mail está libre.
      </p>
    </div>
  );
}
