import { useTranslations } from "next-intl";
import {
  MaquetaCompartir,
  MaquetaConfirmacion,
  MaquetaInvitacion,
} from "@/components/landing/maquetas";

/*
 * Cómo funciona: tres pasos, cada uno con un dibujo de lo que pasa en la
 * pantalla. La maqueta va arriba y el texto abajo, porque primero se mira y
 * después se lee.
 */

const PASOS = [
  { clave: "uno", maqueta: <MaquetaInvitacion /> },
  { clave: "dos", maqueta: <MaquetaConfirmacion /> },
  { clave: "tres", maqueta: <MaquetaCompartir /> },
] as const;

export function Steps() {
  const t = useTranslations("landing.pasos");

  return (
    <section id="como" className="wrap py-14 min-[860px]:py-24">
      <p className="t-etiqueta m-0 text-primary-ink">{t("eyebrow")}</p>
      <h2 className="t-titulo mt-3 mb-10 max-w-[14em]">{t("titulo")}</h2>

      <ol className="m-0 grid list-none grid-cols-1 gap-10 p-0 min-[860px]:grid-cols-3 min-[860px]:gap-8">
        {PASOS.map((paso, i) => (
          <li key={paso.clave} className="flex flex-col items-stretch gap-5">
            {paso.maqueta}
            <div className="flex gap-3">
              <span
                aria-hidden
                className="t-numero font-display text-[17px] leading-[1.5] font-bold text-primary-ink"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="m-0 text-[17px] font-bold">{t(`${paso.clave}.titulo`)}</h3>
                <p className="mt-1 mb-0 text-[16px] leading-[1.55] text-body">
                  {t(`${paso.clave}.texto`)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
