"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { dejarResena, type EstadoResena } from "@/app/[locale]/(app)/alquileres/[id]/fin-actions";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatearFecha } from "@/lib/domain/alquiler";
import { TOPE_TEXTO_RESENA, type EtiquetaResena } from "@/lib/domain/resenas";

const ESTADO_INICIAL: EstadoResena = { estado: "inicial" };

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Dejar mi reseña"}
    </Button>
  );
}

/**
 * La reseña: etiquetas rápidas y un texto opcional.
 * Nadie ve la del otro hasta que estén las dos, así nadie escribe condicionado.
 */
export function FormularioResena({
  rentalId,
  etiquetas,
  quien,
  sePublicaEl,
}: {
  rentalId: string;
  etiquetas: EtiquetaResena[];
  quien: string;
  sePublicaEl: string;
}) {
  const [estado, accion] = useActionState(dejarResena, ESTADO_INICIAL);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [texto, setTexto] = useState("");

  if (estado.estado === "guardada") {
    return (
      <Card className="flex flex-col gap-2">
        <h3 className="t-subtitulo mt-0 mb-0">Listo, quedó guardada</h3>
        <p className="m-0 text-body">
          {estado.publicada
            ? "Como los dos ya dejaron la suya, se publicaron las dos al mismo tiempo."
            : `Se publica cuando ${quien} deje la suya, o el ${formatearFecha(sePublicaEl)}, lo que pase primero. Hasta entonces nadie la ve.`}
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="t-subtitulo mt-0 mb-1.5">Contá cómo fue</h3>
        <p className="m-0 text-body">
          Nadie ve tu reseña hasta que {quien} deje la suya, o hasta el{" "}
          {formatearFecha(sePublicaEl)}. Así nadie escribe mirando lo que dijo el otro.
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <input type="hidden" name="rental_id" value={rentalId} />
        {elegidas.map((codigo) => (
          <input key={codigo} type="hidden" name="etiquetas" value={codigo} />
        ))}

        <fieldset className="m-0 border-0 p-0">
          <legend className="t-etiqueta mb-3 text-muted">Lo que mejor lo describe</legend>
          <div className="flex flex-wrap gap-2">
            {etiquetas.map((etiqueta) => {
              const activa = elegidas.includes(etiqueta.code);
              return (
                <button
                  key={etiqueta.code}
                  type="button"
                  aria-pressed={activa}
                  onClick={() =>
                    setElegidas((actuales) =>
                      activa
                        ? actuales.filter((codigo) => codigo !== etiqueta.code)
                        : [...actuales, etiqueta.code],
                    )
                  }
                  className={cn(
                    "min-h-[44px] cursor-pointer rounded-chip border px-4 text-[15px] font-medium",
                    activa
                      ? "border-confirm bg-confirm-soft text-confirm-ink"
                      : "border-line bg-surface-sunk text-body",
                  )}
                >
                  {etiqueta.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="texto" className="text-[15px] font-medium">
            ¿Querés agregar algo? (opcional)
          </label>
          <textarea
            id="texto"
            name="texto"
            rows={4}
            maxLength={TOPE_TEXTO_RESENA}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Por ejemplo: cuando se rompió el calefón lo resolvió en dos días."
            className="w-full rounded-campo border border-line bg-surface-sunk p-3 text-[16px] text-ink"
          />
          <p className="m-0 text-[15px] text-muted">
            {TOPE_TEXTO_RESENA - texto.length} caracteres disponibles.
          </p>
        </div>

        {estado.estado === "error" && (
          <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
            {estado.mensaje}
          </p>
        )}

        <div>
          <BotonGuardar />
        </div>
      </form>
    </Card>
  );
}
