import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "outline" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold no-underline " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  // Verde = acción primaria y confirmación.
  primary: "bg-green text-white rounded-control hover:brightness-110",
  // Tinta con forma de pastilla: el botón del header de la landing.
  dark: "bg-ink text-bg! rounded-full hover:brightness-125",
  outline:
    "border-[1.5px] border-ink text-ink rounded-control bg-transparent hover:bg-pill",
  quiet: "text-ink rounded-control bg-transparent hover:bg-pill",
};

// 44px es el objetivo táctil mínimo; 52px para los botones de formulario.
const sizes: Record<Size, string> = {
  md: "min-h-[44px] px-[22px] text-[16px]",
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
}: CommonProps &
  Omit<React.ComponentProps<typeof Link>, "children" | "className">) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}
