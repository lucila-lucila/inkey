import { cn } from "@/lib/cn";

/**
 * Número grande + etiqueta chica: "36 meses confirmados".
 * `destacado` usa el amarillo de destaque, que siempre lleva texto tinta.
 */
export function Stat({
  value,
  label,
  destacado = false,
}: {
  value: string | number;
  label: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-campo p-4",
        destacado ? "bg-sun text-on-sun" : "bg-surface-sunk text-ink",
      )}
    >
      <b className="t-numero block">{value}</b>
      {/* Sobre la zona hundida va `body`: `muted` no llega a 4,5:1 ahí. */}
      <span className={cn("text-[13px]", destacado ? "text-on-sun/80" : "text-body")}>{label}</span>
    </div>
  );
}
