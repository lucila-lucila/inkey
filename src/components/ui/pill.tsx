import { cn } from "@/lib/cn";

type Tone = "confirm" | "primary" | "neutral" | "sun";

/*
 * Estados. "Sin confirmar" es deliberadamente neutro: nunca rojo, nunca
 * alarma. Un mes sin confirmar no suma, pero tampoco acusa a nadie.
 */
const tones: Record<Tone, string> = {
  confirm: "bg-confirm-soft text-confirm-ink",
  primary: "bg-primary-soft text-primary-ink",
  neutral: "bg-surface-sunk text-body",
  sun: "bg-sun text-on-sun",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-[13px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
