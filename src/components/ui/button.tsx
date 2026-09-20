import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "confirm" | "secondary" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium no-underline " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  // La marca: registrar, invitar, compartir.
  primary: "bg-primary text-on-primary hover:brightness-110",
  // El verde es solo confirmación: nunca decorativo.
  confirm: "bg-confirm text-on-confirm hover:brightness-110",
  secondary: "bg-surface-sunk text-ink hover:brightness-[0.97]",
  quiet: "bg-transparent text-body hover:bg-surface-sunk",
};

// 44px es el objetivo táctil mínimo; 52px para los botones de formulario.
const sizes: Record<Size, string> = {
  md: "min-h-[44px] px-5 text-[15px]",
  lg: "min-h-[52px] px-6 text-[17px]",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "primary",
  size = "lg",
  className,
  children,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], "cursor-pointer border-0", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "lg",
  className,
  href,
  children,
  ...props
}: CommonProps & Omit<React.ComponentProps<typeof Link>, "children" | "className">) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}
