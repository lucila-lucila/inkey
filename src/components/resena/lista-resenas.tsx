import { useLocale } from "next-intl";
import { Card, Pill } from "@/components/ui";
import { formatearFecha } from "@/lib/domain/alquiler";
import type { ResenaPublica } from "@/lib/domain/resenas";

/** Las reseñas publicadas, tal como se ven en el perfil y en el alquiler. */
export function ListaResenas({ resenas }: { resenas: ResenaPublica[] }) {
  const idioma = useLocale();
  if (resenas.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {resenas.map((resena, indice) => (
        <li key={`${resena.fecha}-${indice}`}>
          <Card className="flex flex-col gap-3">
            {resena.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {resena.etiquetas.map((etiqueta) => (
                  <Pill key={etiqueta} tone="confirm">
                    {etiqueta}
                  </Pill>
                ))}
              </div>
            )}

            {resena.texto && (
              <q className="quote t-cuerpo m-0 block text-body italic">{resena.texto}</q>
            )}

            <p className="m-0 text-[15px] text-muted">
              {resena.de}, {formatearFecha(resena.fecha.slice(0, 10), idioma)}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
