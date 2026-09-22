import Link from "next/link";
import { Logo } from "./logo";

/** Una sola dirección de contacto en todo el producto. */
export const MAIL_DE_CONTACTO = "contacto@inkeyapp.com";

/**
 * El pie, igual en todas las pantallas.
 *
 * Lleva el contacto y los textos legales, que tienen que estar a un toque
 * desde cualquier lado: es lo que pide la Ley 25.326 y lo que espera
 * cualquiera que quiera saber qué hacemos con sus datos.
 */
export function Pie({ conLogo = false }: { conLogo?: boolean }) {
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
            href="#top"
            size="sm"
            variante="simbolo-izquierda"
            unaTinta={{ color: "var(--muted)", id: "pie" }}
          />
        )}

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 max-[560px]:justify-center max-[560px]:text-center">
          <Link href="/terminos" className="text-muted hover:text-ink">
            Términos
          </Link>
          <Link href="/privacidad" className="text-muted hover:text-ink">
            Privacidad
          </Link>
          <a href={`mailto:${MAIL_DE_CONTACTO}`} className="text-muted hover:text-ink">
            {MAIL_DE_CONTACTO}
          </a>
          <span>Hecho en Buenos Aires</span>
        </nav>
      </div>
    </footer>
  );
}
