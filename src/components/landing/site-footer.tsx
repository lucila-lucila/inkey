import { Logo } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="mt-16">
      <div className="wrap flex flex-wrap items-center justify-between gap-4 border-t border-line py-10 text-[15px] text-muted">
        {/*
          El pie es de los pocos lugares donde va el símbolo a la izquierda, y
          de una sola tinta: el cruce se lee por el corte del aro de atrás.
        */}
        <Logo
          href="#top"
          size="sm"
          variante="simbolo-izquierda"
          unaTinta={{ color: "var(--muted)", fondo: "var(--bg)" }}
        />
        <span>Hecho en Buenos Aires · [MAIL DE CONTACTO]</span>
      </div>
    </footer>
  );
}
