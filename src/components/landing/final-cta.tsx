export function FinalCta() {
  return (
    <section className="wrap">
      <div className="flex flex-col items-stretch gap-10 rounded-[24px] bg-green px-7 py-10 text-white min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between min-[860px]:rounded-[32px] min-[860px]:p-20">
        <h2 className="m-0 max-w-[12em] font-serif text-[clamp(32px,4.4vw,56px)] leading-[1.06] font-semibold tracking-[-0.02em]">
          Lo que cumpliste, que quede escrito.
        </h2>
        <a
          href="#lista"
          className="rounded-full bg-[#F5EFE4] px-[30px] py-[18px] text-center text-[17px] font-semibold whitespace-nowrap text-[#1D1A15] no-underline min-[860px]:text-[19px]"
        >
          Sumarme a la lista
        </a>
      </div>
    </section>
  );
}
