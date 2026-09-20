import { cn } from "@/lib/cn";

type CardProps = {
  /** La tarjeta protagonista de la pantalla: más aire, nada más. */
  hero?: boolean;
  as?: "div" | "article" | "section";
  className?: string;
  children: React.ReactNode;
};

/**
 * Las tarjetas se separan del fondo por color, no por sombra ni por borde
 * (ver docs/identidad.md): superficie blanca sobre crema.
 */
export function Card({ hero = false, as: Tag = "div", className, children }: CardProps) {
  return (
    <Tag className={cn("rounded-tarjeta bg-surface", hero ? "p-6 sm:p-7" : "p-5", className)}>
      {children}
    </Tag>
  );
}
