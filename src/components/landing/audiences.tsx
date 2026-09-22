import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FlechaIcon } from "@/components/ui";

/*
 * Para quién: los dos lados del alquiler, uno al lado del otro en una sola
 * tarjeta. Van juntos a propósito —es el mismo trato visto desde cada
 * vereda— y cada columna termina en su propia puerta de entrada.
 */

const LADOS = [
  { clave: "inquilino", href: "/ingresar?intencion=inquilino" },
  { clave: "propietario", href: "/ingresar?intencion=propietario" },
] as const;

export function Audiences() {
  const t = useTranslations("landing.publicos");

  return (
    <section id="para-quien" className="wrap pb-14 min-[860px]:pb-24">
      <div className="grid grid-cols-1 rounded-tarjeta bg-surface min-[860px]:grid-cols-2">
        {LADOS.map((lado, i) => (
          <article
            key={lado.clave}
            /*
              La línea que los separa: al costado cuando van lado a lado,
              arriba cuando se apilan. Nunca las dos.
            */
            className={
              i === 0
                ? "p-7 min-[860px]:p-10"
                : "border-t border-line p-7 min-[860px]:border-t-0 min-[860px]:border-l min-[860px]:p-10"
            }
          >
            <p className="t-etiqueta m-0 text-primary-ink">{t(`${lado.clave}.etiqueta`)}</p>
            <h3 className="t-titulo mt-3 mb-5 max-w-[13em]">{t(`${lado.clave}.titulo`)}</h3>

            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {(["punto1", "punto2", "punto3"] as const).map((punto) => (
                <li key={punto} className="text-[16px] leading-[1.6] text-body">
                  {t(`${lado.clave}.${punto}`)}
                </li>
              ))}
            </ul>

            <Link
              href={lado.href}
              className="mt-5 inline-block text-[16px] font-bold text-ink no-underline hover:underline hover:underline-offset-4"
            >
              {t(`${lado.clave}.accion`)} <FlechaIcon className="text-primary-ink" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
