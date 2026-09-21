export function FinalCta() {
  return (
    <section className="wrap">
      <div className="flex flex-col items-stretch gap-8 rounded-tarjeta bg-primary px-7 py-10 text-on-primary min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between min-[860px]:p-16">
        <h2 className="t-titulo m-0 max-w-[12em]">Lo que cumpliste, que quede escrito.</h2>
        <a
          href="#empezar"
          className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-bg px-7 text-[17px] font-medium whitespace-nowrap text-ink no-underline"
        >
          Empezá gratis
        </a>
      </div>
    </section>
  );
}
