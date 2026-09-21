import { Cabecera, Pie } from "@/components/ui";

/** Los textos legales: una columna angosta, pensada para leerse. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera />
      <main className="wrap w-full flex-1 py-6">
        {/* ~70 caracteres por renglón: el ancho en el que se lee cómodo. */}
        <div className="max-w-[680px]">{children}</div>
      </main>
      <Pie />
    </div>
  );
}
