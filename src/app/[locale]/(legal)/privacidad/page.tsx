import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { alternativasDeIdioma } from "@/i18n/alternativas";
import { TextoLegal } from "@/components/legal/texto-legal";
import { leerLegal, LEGALES, ultimaActualizacion } from "@/lib/legales";

const CUAL = "privacidad" as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  const idioma = await getLocale();

  return {
    title: `${t("privacidadTitulo")} · Inkey`,
    description: t("privacidadDescripcion"),
    // Los textos legales se pueden leer sin entrar y se pueden buscar.
    robots: { index: true, follow: true },
    alternates: alternativasDeIdioma(LEGALES[CUAL].ruta, idioma),
  };
}

export default async function PaginaLegal() {
  const t = await getTranslations("legal");
  const bloques = leerLegal(CUAL, await getLocale());
  const actualizado = ultimaActualizacion(bloques);

  return (
    <>
      <TextoLegal bloques={bloques} />
      {actualizado && (
        <p className="mt-10 mb-0 border-t-[1.5px] border-dashed border-line pt-6 text-[15px] text-muted">
          {t("avisoDeCambios")}
        </p>
      )}
    </>
  );
}
