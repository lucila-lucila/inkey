"use client";

import { useState } from "react";
import { verComprobante } from "@/app/(app)/pagos/[id]/actions";
import { Button } from "@/components/ui";

/** El comprobante se abre con una URL firmada que dura un minuto. */
export function BotonComprobante({ pagoId }: { pagoId: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir() {
    setCargando(true);
    setError(null);
    const resultado = await verComprobante(pagoId);
    setCargando(false);

    if ("url" in resultado) {
      window.open(resultado.url, "_blank", "noopener,noreferrer");
    } else {
      setError(resultado.error);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" size="md" onClick={abrir} disabled={cargando}>
        {cargando ? "Abriendo…" : "Ver el comprobante"}
      </Button>
      {error && (
        <p role="alert" className="m-0 text-[15px] text-primary-ink">
          {error}
        </p>
      )}
    </div>
  );
}
