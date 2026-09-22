import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternativasDeIdioma } from "@/i18n/alternativas";
import { AvisoDeBaja } from "@/components/landing/aviso-de-baja";
import { Audiences } from "@/components/landing/audiences";
import { ExampleProfile } from "@/components/landing/example-profile";
import { FinalCta } from "@/components/landing/final-cta";
import { HouseRules } from "@/components/landing/house-rules";
import { SiteHeader } from "@/components/landing/site-header";
import { Steps } from "@/components/landing/steps";
import { Acceso } from "@/components/landing/acceso";
import { Pie } from "@/components/ui";

/** La landing es la única pantalla indexable de todo el sitio. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sitio" });
  const titulo = t("titulo");
  const descripcion = t("descripcion");

  return {
    title: titulo,
    description: descripcion,
    robots: { index: true, follow: true },
    /*
     * El dominio bueno es uno solo, y cada idioma tiene el suyo. Sin esto, la
     * URL del deploy de Vercel y el dominio sin www quedan compitiendo con el
     * definitivo, y las dos versiones compiten entre sí.
     */
    alternates: alternativasDeIdioma("/", locale),
    openGraph: {
      type: "website",
      siteName: "Inkey",
      locale: locale === "en" ? "en_US" : "es_AR",
      url: locale === "en" ? "/en" : "/",
      title: titulo,
      description: descripcion,
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "landing" });

  return (
    <>
      <SiteHeader />
      <main id="top">
        {/* Vuelta de una baja de cuenta: que no quede en la nada. */}
        <Suspense fallback={null}>
          <AvisoDeBaja />
        </Suspense>
        {/*
          El hero ocupa la primera pantalla. `content-center` centra el bloque
          entero y `items-start` alinea las dos columnas por arriba: así el
          eyebrow empieza donde empieza la tarjeta, sin aire de más encima.
        */}
        <section className="wrap grid grid-cols-1 items-start content-center gap-10 pb-14 min-[960px]:min-h-[calc(100svh-104px)] min-[960px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[960px]:gap-18 min-[960px]:pb-20">
          <div>
            <p className="t-etiqueta m-0 text-primary-ink">{t("eyebrow")}</p>
            <h1 className="t-display mt-4 mb-5">
              {t("titulo")}{" "}
              {/* En renglón propio: es el giro de la frase, no una coda. */}
              <em className="block text-primary-ink not-italic">{t("tituloDestacado")}</em>
            </h1>
            <p className="t-cuerpo mt-0 mb-7 max-w-[34em] text-body min-[640px]:text-[19px]">
              {t("bajada")}
            </p>
            <Acceso />
          </div>
          <ExampleProfile />
        </section>

        <Steps />
        <Audiences />
        <HouseRules />
        <FinalCta />
      </main>
      <Pie conLogo />
    </>
  );
}
