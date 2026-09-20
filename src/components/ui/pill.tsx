import { cn } from "@/lib/cn";

type Tone = "green" | "terra" | "neutral";

const tones: Record<Tone, string> = {
  green: "text-green-ink bg-green-tint",
  terra: "text-terra-ink bg-terra-tint",
  neutral: "text-muted bg-pill",
};

/** Pastilla de estado: "Confirmado", "Pendiente", "Con comprobante". */
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[13px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Etiqueta con borde, como el "Tu historial de alquiler, confirmado" del hero. */
export function OutlineTag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-[1.5px] border-current px-3.5 py-[7px] text-[15px] font-semibold text-green-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
