/*
 * El layout raíz no dibuja nada: el `<html>` lo arma `[locale]/layout.tsx`,
 * que es el que sabe en qué idioma está la página. Next igual exige que este
 * archivo exista.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
