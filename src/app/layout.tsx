import type { Metadata, Viewport } from "next";
import "./globals.css";

/*
 * Por defecto nada se indexa. La landing es la única pantalla que pide
 * indexación explícita (ver src/app/(marketing)/page.tsx).
 */
export const metadata: Metadata = {
  title: "Inkey · Tu historial de alquiler, confirmado",
  description:
    "Vos y tu dueño confirman cada pago, mes a mes. Tu historial de alquiler es tuyo y lo llevás a tu próximo alquiler.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        {/*
          Bricolage Grotesque para display y DM Sans para texto (ver
          docs/identidad.md). Se cargan con <link> y no con next/font: Google
          sirve a next/font otros cortes de las variables, y ya nos costó una
          vez que los títulos rompieran en distinto lugar.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Está en el layout raíz: aplica a todas las pantallas, no a una sola. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:wght@400;500;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
