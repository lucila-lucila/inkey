import Link from "next/link";
import type { Bloque, Inline } from "@/lib/legales";

/*
 * Cómo se ve un texto legal en Inkey.
 *
 * Lo importante acá es que se pueda leer: una sola columna angosta, jerarquía
 * clara y aire entre secciones. Un texto legal que nadie lee no protege a
 * nadie.
 */

function Partes({ partes }: { partes: Inline[] }) {
  return (
    <>
      {partes.map((parte, i) => {
        if (parte.tipo === "fuerte") {
          return (
            <strong key={i} className="font-medium text-ink">
              {parte.texto}
            </strong>
          );
        }
        if (parte.tipo === "link") {
          return (
            <Link key={i} href={parte.url} className="font-medium text-confirm-ink">
              {parte.texto}
            </Link>
          );
        }
        return <span key={i}>{parte.texto}</span>;
      })}
    </>
  );
}

export function TextoLegal({ bloques }: { bloques: Bloque[] }) {
  return (
    <article className="flex flex-col gap-4">
      {bloques.map((bloque, i) => {
        if (bloque.tipo === "titulo") {
          return (
            <h1 key={i} className="t-titulo m-0">
              {bloque.texto}
            </h1>
          );
        }

        if (bloque.tipo === "seccion") {
          return (
            <h2 key={i} className="t-subtitulo mt-6 mb-0 border-t-[1.5px] border-line pt-8">
              {bloque.texto}
            </h2>
          );
        }

        if (bloque.tipo === "aviso") {
          return (
            <p
              key={i}
              className="m-0 rounded-campo bg-primary-soft p-4 text-[16px] leading-[1.6] text-primary-ink"
            >
              <Partes partes={bloque.partes} />
            </p>
          );
        }

        if (bloque.tipo === "lista") {
          return (
            <ul key={i} className="m-0 flex list-none flex-col gap-3 p-0">
              {bloque.items.map((item, j) => (
                <li key={j} className="relative pl-5 text-[17px] leading-[1.7] text-body">
                  {/* La viñeta, en el color de la marca. */}
                  <span
                    aria-hidden
                    className="absolute top-[0.7em] left-0 size-[6px] rounded-full bg-primary"
                  />
                  <Partes partes={item.partes} />
                  {item.sub.length > 0 && (
                    <ul className="mt-2 mb-0 flex list-none flex-col gap-2 p-0">
                      {item.sub.map((sub, k) => (
                        <li
                          key={k}
                          className="relative pl-5 text-[16px] leading-[1.7] text-body"
                        >
                          <span
                            aria-hidden
                            className="absolute top-[0.85em] left-0 h-px w-[10px] bg-line"
                          />
                          <Partes partes={sub} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="m-0 text-[17px] leading-[1.7] text-body">
            <Partes partes={bloque.partes} />
          </p>
        );
      })}
    </article>
  );
}
