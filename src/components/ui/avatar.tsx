import { cn } from "@/lib/cn";

/** Iniciales sobre el amarillo de destaque. Nunca mostramos el apellido entero. */
export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid size-12 place-items-center rounded-full bg-sun font-display text-[18px] font-bold text-on-sun",
        className,
      )}
    >
      {initials}
    </div>
  );
}
