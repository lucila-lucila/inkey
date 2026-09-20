/** Número grande + etiqueta chica: "36 meses confirmados". */
export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[14px] bg-bg p-3.5">
      <b className="block font-serif text-[24px] leading-[1.1] font-semibold sm:text-[32px]">
        {value}
      </b>
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}
