import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { rutaInternaSegura } from "@/lib/validation/auth";
import { IngresoForm } from "./ingreso-form";

export const metadata: Metadata = {
  title: "Entrar · Inkey",
  robots: { index: false, follow: false },
};

const ERRORES: Record<string, string> = {
  link: "Ese link ya no sirve: puede haber vencido o haberse usado. Pedí uno nuevo.",
  google: "No pudimos abrir Google. Probá con el mail.",
};

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ volver_a?: string; error?: string }>;
}) {
  const params = await searchParams;
  const volverA = rutaInternaSegura(params.volver_a, "/panel");
  const error = params.error ? ERRORES[params.error] : undefined;

  return (
    <Card hero className="p-6 sm:p-8">
      <h1 className="mt-0 mb-2 font-serif text-[clamp(30px,5vw,38px)] leading-[1.1] font-semibold">
        Entrá a Inkey
      </h1>
      <p className="mt-0 mb-6 text-body">
        Tu historial de alquiler, siempre a mano. Entrás con tu mail o con Google.
      </p>
      {error && (
        <p role="alert" className="mb-5 rounded-control bg-terra-tint p-3 text-[15px] text-terra-ink">
          {error}
        </p>
      )}
      <IngresoForm volverA={volverA} />
    </Card>
  );
}
