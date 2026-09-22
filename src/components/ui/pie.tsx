import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { haySeleccionDeIdioma, idiomasActivos } from "@/i18n/activos";
import { IDIOMA_POR_DEFECTO } from "@/i18n/routing";
import { Logo } from "./logo";
import { SelectorDeIdioma } from "./selector-de-idioma";

/** Una sola dirección de contacto en todo el producto. */
export const MAIL_DE_CONTACTO = "contacto@inkeyapp.com";

/*
 * Dónde se apoya el proyecto. Va en el pie y en ningún otro lado.
 *
 * Sin el prefijo `es.`: Liberapay muestra la página en el idioma de quien la
 * abre, y forzarla al castellano dejaría en castellano a quien vino leyendo
 * Inkey en inglés.
 */
export const LINK_DE_APOYO = "https://liberapay.com/inkeyapp/";

/**
 * El pie, igual en todas las pantallas.
 *
 * Lleva el contacto y los textos legales, que tienen que estar a un toque
 * desde cualquier lado: es lo que pide la Ley 25.326 y lo que espera
 * cualquiera que quiera saber qué hacemos con sus datos. Y el selector de
 * idioma, que vive acá y no en el header porque se toca una vez y listo.
 */
export async function Pie({ conLogo = false }: { conLogo?: boolean }) {
  const t = await getTranslations("pie");
  const idioma = await getLocale();

  return (
    <footer className="mt-16">
      {/* En el celular no hay dos costados: se apila y se centra. */}
      <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line py-10 text-[15px] text-muted max-[560px]:flex-col max-[560px]:justify-center">
        {/*
          El pie es de los pocos lugares donde va el símbolo a la izquierda, y
          el único que queda de una sola tinta: es un remate discreto, no la
          marca en su versión plena. El cruce se lee por el recorte del aro de
          atrás, así que funciona sobre cualquier fondo.
        */}
        {conLogo && (
          <Logo
            href="/"
            size="sm"
            variante="simbolo-izquierda"
            unaTinta={{ color: "var(--muted)", id: "pie" }}
          />
        )}

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 max-[560px]:justify-center max-[560px]:text-center">
          <Link href="/terminos" className="text-muted hover:text-ink">
            {t("terminos")}
          </Link>
          <Link href="/privacidad" className="text-muted hover:text-ink">
            {t("privacidad")}
          </Link>
          <a href={`mailto:${MAIL_DE_CONTACTO}`} className="text-muted hover:text-ink">
            {MAIL_DE_CONTACTO}
          </a>
          {/*
            Discreto y sin insistir: un link en el pie, nada de banners ni
            ventanitas. Se abre afuera, así que va con rel de seguridad.
          */}
          <a
            href={LINK_DE_APOYO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-ink"
          >
            {t("apoyo")}
          </a>
          <span>{t("hechoEn")}</span>
          {/* Con un solo idioma prendido no hay nada que elegir. */}
          {haySeleccionDeIdioma() && <SelectorDeIdioma idiomas={idiomasActivos()} />}
        </nav>
      </div>

      {/*
        Quien no lee en castellano rioplatense puede no saber que esto es una
        app argentina: los montos van en pesos y los ajustes siguen el ICL.
        Mejor decirlo antes de que cargue un alquiler.
      */}
      {idioma !== IDIOMA_POR_DEFECTO && (
        <div className="wrap pb-10 text-[14px] text-muted max-[560px]:text-center">
          {t("paraArgentina")}
        </div>
      )}
    </footer>
  );
}
