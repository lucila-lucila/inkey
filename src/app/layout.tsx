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
          Mismas fuentes y misma forma de cargarlas que reference/landing.html.
          Con next/font el archivo que sirve Google es otro corte óptico de
          Fraunces y los títulos rompen en distinto lugar: el diseño aprobado
          manda.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Está en el layout raíz: aplica a todas las pantallas, no a una sola. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
