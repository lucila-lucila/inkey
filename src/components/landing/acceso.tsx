import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ButtonLink, FlechaIcon } from "@/components/ui";

/*
 * La puerta de entrada de la landing.
 *
 * Dos caminos, uno por cada lado del alquiler, y cada uno lleva su intención
 * para que el onboarding llegue con la respuesta puesta. No hay selector ni
 * formulario: sin contraseñas, entrar es tocar un botón y mirar el mail.
 *
 * El inquilino es la acción principal porque el historial es suyo; el dueño
 * entra por un link de texto, que pesa menos sin esconderse.
 */
export function Acceso() {
  const t = useTranslations("landing");

  return (
    <div id="empezar" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-4 max-[560px]:flex-col max-[560px]:items-stretch">
        {/* Ancho según su contenido: un botón a lo ancho de la columna grita. */}
        <ButtonLink
          href="/ingresar?intencion=inquilino"
          className="self-start whitespace-nowrap max-[560px]:self-stretch"
        >
          {t("crearHistorial")}
        </ButtonLink>

        <Link
          href="/ingresar?intencion=propietario"
          className="text-[17px] font-medium text-ink no-underline hover:underline hover:underline-offset-4 max-[560px]:text-center"
        >
          {t("tengoPropiedad")} <FlechaIcon className="text-primary-ink" />
        </Link>
      </div>

      <p className="m-0 text-[15px] text-muted">{t("letraChica")}</p>
    </div>
  );
}
