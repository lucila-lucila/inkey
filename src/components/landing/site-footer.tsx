import { Logo } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap flex flex-wrap items-center justify-between gap-4 py-12 text-[15px] text-muted">
        <Logo href="#top" size="sm" />
        <span>Hecho en Buenos Aires · [MAIL DE CONTACTO]</span>
      </div>
    </footer>
  );
}
