import { Logo, ButtonLink } from "@/components/ui";

export function SiteHeader() {
  return (
    <header>
      <div className="wrap flex items-center justify-between py-6">
        <Logo href="#top" />
        <nav className="flex items-center gap-8 text-[16px] font-medium">
          <a
            href="#como"
            className="text-ink no-underline hover:underline hover:underline-offset-4 max-[760px]:hidden"
          >
            Cómo funciona
          </a>
          <a
            href="#para-quien"
            className="text-ink no-underline hover:underline hover:underline-offset-4 max-[760px]:hidden"
          >
            Para quién
          </a>
          <ButtonLink href="#lista" variant="dark" size="md">
            Sumarme a la lista
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
