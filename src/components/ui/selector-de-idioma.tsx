"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { rutaEnIdioma } from "@/i18n/idioma";
import { recordarIdiomaEnElNavegador } from "@/i18n/idioma-cliente";
import { IDIOMAS, NOMBRE_DEL_IDIOMA, type Idioma } from "@/i18n/routing";
import { guardarIdioma } from "@/app/acciones-idioma";

/*
 * "Español · English", en el pie de todas las pantallas.
 *
 * Son links de verdad, no botones: cada idioma tiene su URL y así se puede
 * copiar, compartir e indexar. Al tocarlos guardamos la elección —cookie
 * siempre, y perfil si hay sesión— para que la próxima visita ya llegue en
 * el idioma correcto sin pasar por el navegador.
 */
export function SelectorDeIdioma() {
  const actual = useLocale() as Idioma;
  const pathname = usePathname();
  const t = useTranslations("pie");

  function recordar(idioma: Idioma) {
    recordarIdiomaEnElNavegador(idioma);
    // Y en el perfil, si hay sesión: así viaja a otros dispositivos.
    void guardarIdioma(idioma);
  }

  return (
    <nav aria-label={t("idioma")} className="flex items-center gap-2">
      {IDIOMAS.map((idioma, i) => (
        <span key={idioma} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          <a
            href={rutaEnIdioma(pathname, idioma)}
            hrefLang={idioma}
            aria-current={idioma === actual ? "true" : undefined}
            onClick={() => recordar(idioma)}
            title={t("cambiarA", { idioma: NOMBRE_DEL_IDIOMA[idioma] })}
            className={
              idioma === actual
                ? "font-medium text-ink no-underline"
                : "text-muted no-underline hover:text-ink"
            }
          >
            {NOMBRE_DEL_IDIOMA[idioma]}
          </a>
        </span>
      ))}
    </nav>
  );
}
