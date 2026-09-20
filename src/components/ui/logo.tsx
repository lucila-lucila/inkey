import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  href = "/",
  className,
  size = "lg",
}: {
  href?: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <Link
      href={href}
      aria-label="Inkey, inicio"
      className={cn(
        "font-serif font-bold tracking-[-0.5px] text-ink no-underline",
        size === "lg" ? "text-[26px] md:text-[30px]" : "text-[22px]",
        className,
      )}
    >
      inkey<span className="text-terra">.</span>
    </Link>
  );
}
