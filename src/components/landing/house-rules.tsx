import { useTranslations } from "next-intl";
import { CandadoIcon, CheckIcon, EscudoIcon } from "@/components/ui";

/*
 * Las reglas de la casa: la franja oscura, de borde a borde.
 *
 * Es lo único de la página que corta el crema, y está puesto acá a propósito:
 * son las promesas que sostienen todo lo demás, y merecen frenar la lectura.
 */

const REGLAS = [
  { clave: "una", Icono: CandadoIcon, tono: "text-invertido-primary" },
  // El verde solo donde significa confirmado: esta regla habla justo de eso.
  { clave: "dos", Icono: CheckIcon, tono: "text-invertido-confirm" },
  { clave: "tres", Icono: EscudoIcon, tono: "text-invertido-primary" },
] as const;

export function HouseRules() {
  const t = useTranslations("landing.reglas");

  return (
    <section className="bg-invertido py-16 text-invertido-ink min-[860px]:py-24">
      <div className="wrap">
        <p className="t-etiqueta m-0 text-invertido-primary">{t("eyebrow")}</p>
        <h2 className="t-titulo mt-3 mb-12 max-w-[16em]">{t("titulo")}</h2>

        <div className="grid grid-cols-1 gap-9 min-[860px]:grid-cols-3 min-[860px]:gap-8">
          {REGLAS.map(({ clave, Icono, tono }) => (
            <div key={clave}>
              <Icono size={24} className={tono} />
              <h3 className="mt-3.5 mb-2 text-[17px] font-bold">{t(`${clave}.titulo`)}</h3>
              <p className="m-0 text-[16px] leading-[1.6] text-invertido-ink/75">
                {t(`${clave}.texto`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
