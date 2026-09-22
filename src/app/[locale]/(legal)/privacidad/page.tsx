import type { Metadata } from "next";
import { TextoLegal } from "@/components/legal/texto-legal";
import { leerLegal, LEGALES, ultimaActualizacion } from "@/lib/legales";

const CUAL = "privacidad" as const;

export const metadata: Metadata = {
  title: `${LEGALES[CUAL].titulo} · Inkey`,
  description: "Qué datos guarda Inkey, para qué, con quién los comparte y cómo podés controlarlos.",
  // Los textos legales se pueden leer sin entrar y se pueden buscar.
  robots: { index: true, follow: true },
  alternates: { canonical: LEGALES[CUAL].ruta },
};

export default function PaginaLegal() {
  const bloques = leerLegal(CUAL);
  const actualizado = ultimaActualizacion(bloques);

  return (
    <>
      <TextoLegal bloques={bloques} />
      {actualizado && (
        <p className="mt-10 mb-0 border-t-[1.5px] border-dashed border-line pt-6 text-[15px] text-muted">
          Si cambiamos algo importante de este texto, te avisamos antes de que entre en vigencia.
        </p>
      )}
    </>
  );
}
