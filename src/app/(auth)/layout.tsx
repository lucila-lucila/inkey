import { Logo } from "@/components/ui";

/** Pantallas de ingreso y onboarding: una sola columna, sin distracciones. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="wrap py-6">
        <Logo />
      </header>
      <main className="wrap flex w-full flex-1 flex-col items-center justify-center py-8">
        <div className="w-full max-w-[520px]">{children}</div>
      </main>
    </div>
  );
}
