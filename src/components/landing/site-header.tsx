import { ButtonLink, Logo } from "@/components/ui";

export function SiteHeader() {
  return (
    <header>
      <div className="wrap flex items-center justify-between py-6">
        {/* En el header, el wordmark manda y el símbolo hace de punto final. */}
        <Logo href="#top" size="lg" className="max-[560px]:hidden" />
        <Logo href="#top" size="sm" className="min-[561px]:hidden" />
        <nav className="flex items-center gap-7 text-[15px] font-medium">
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
          <ButtonLink href="#lista" size="md" className="whitespace-nowrap">
            Sumarme a la lista
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
