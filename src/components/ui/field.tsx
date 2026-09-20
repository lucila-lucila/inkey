import { cn } from "@/lib/cn";

/*
 * Todos los inputs llevan label real (nada de placeholders como etiqueta) y,
 * si hay error, se anuncia con aria-describedby.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[15px] font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="t-etiqueta text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[15px] text-primary-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-[52px] w-full min-w-0 rounded-campo border border-line bg-surface-sunk",
        "px-4 py-3.5 text-[17px] text-ink placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({
  id,
  label,
  className,
  ...props
}: { id: string; label: React.ReactNode; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("flex min-h-[44px] items-start gap-3 py-2", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-[var(--green)]"
        {...props}
      />
      <label htmlFor={id} className="text-[15px] leading-relaxed text-body">
        {label}
      </label>
    </div>
  );
}
