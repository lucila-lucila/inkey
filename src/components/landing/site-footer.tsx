import { Logo } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="mt-16">
      <div className="wrap flex flex-wrap items-center justify-between gap-4 border-t border-line py-10 text-[15px] text-muted">
        {/*
          El pie es de los pocos lugares donde va el símbolo a la izquierda, y
          el único que queda de una sola tinta: es un remate discreto, no la
          marca en su versión plena. El cruce se lee por el recorte del aro de
          atrás, así que funciona sobre cualquier fondo.
        */}
        <Logo
          href="#top"
          size="sm"
          variante="simbolo-izquierda"
          unaTinta={{ color: "var(--muted)", id: "pie" }}
        />
        <span>Hecho en Buenos Aires · [MAIL DE CONTACTO]</span>
      </div>
    </footer>
  );
}
