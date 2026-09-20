import { cn } from "@/lib/cn";

/** Iniciales sobre fondo cálido. Nunca mostramos el apellido completo. */
export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid size-14 place-items-center rounded-full bg-avatar font-serif text-[22px] font-semibold",
        className,
      )}
    >
      {initials}
    </div>
  );
}
