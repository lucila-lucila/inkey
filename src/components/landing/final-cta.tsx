import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ButtonLink, FlechaIcon } from "@/components/ui";

/*
 * El cierre: la frase sola, centrada, y las dos puertas de siempre. Después
 * de las reglas de la casa no hace falta argumentar más.
 */
export function FinalCta() {
  const t = useTranslations("landing");

  return (
    <section className="wrap py-16 text-center min-[860px]:py-24">
      <h2 className="t-display mx-auto mb-9 max-w-[11em]">
        {t("cierre.titulo")}{" "}
        <em className="text-primary-ink not-italic">{t("cierre.tituloDestacado")}</em>
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-4 max-[560px]:flex-col max-[560px]:items-stretch">
        <ButtonLink href="/ingresar?intencion=inquilino" className="whitespace-nowrap">
          {t("crearHistorial")}
        </ButtonLink>

        <Link
          href="/ingresar?intencion=propietario"
          className="text-[17px] font-medium text-ink no-underline hover:underline hover:underline-offset-4"
        >
          {t("tengoPropiedad")} <FlechaIcon className="text-primary-ink" />
        </Link>
      </div>
    </section>
  );
}
