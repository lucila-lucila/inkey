import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReboteDeLink } from "@/components/auth/rebote-de-link";
import { routing } from "@/i18n/routing";
import { serverEnv } from "@/lib/env";
import "../globals.css";

/*
 * Por defecto nada se indexa. La landing es la única pantalla que pide
 * indexación explícita (ver [locale]/(marketing)/page.tsx).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sitio" });

  return {
    /*
     * De acá salen las URLs absolutas de los metadatos (Open Graph, canónicas,
     * imágenes de preview). Sin esto, Next las arma con la URL del deploy de
     * Vercel y los previews de WhatsApp terminan apuntando a *.vercel.app.
     */
    metadataBase: new URL(serverEnv.siteUrl),
    title: t("titulo"),
    description: t("descripcion"),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Las dos versiones se generan estáticas: son las mismas pantallas. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <head>
        {/*
          Bricolage Grotesque para display y DM Sans para texto (ver
          docs/identidad.md). Se cargan con <link> y no con next/font: Google
          sirve a next/font otros cortes de las variables, y ya nos costó una
          vez que los títulos rompieran en distinto lugar.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Está en el layout de todas las pantallas, no en una sola. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <NextIntlClientProvider>
          <ReboteDeLink />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
