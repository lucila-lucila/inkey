import { cn } from "@/lib/cn";

type CardProps = {
  /** Las tarjetas protagonistas (perfil, pago pendiente) llevan sombra dura. */
  hero?: boolean;
  as?: "div" | "article" | "section";
  className?: string;
  children: React.ReactNode;
};

export function Card({ hero = false, as: Tag = "div", className, children }: CardProps) {
  return (
    <Tag
      className={cn(
        "bg-surface border-[1.5px] border-ink rounded-card",
        // 12px en desktop, 8px en mobile, tal cual la landing.
        hero && "shadow-[8px_8px_0_var(--ink)] sm:shadow-[12px_12px_0_var(--ink)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
