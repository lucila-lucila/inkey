import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { mensajeDeRebote } from "@/lib/auth/errores-link";
import { rutaInternaSegura } from "@/lib/validation/auth";
import { IngresoForm } from "./ingreso-form";

export const metadata: Metadata = {
  title: "Entrar · Inkey",
  robots: { index: false, follow: false },
};

/** Los errores nuestros; los rebotes de Supabase los traduce `mensajeDeRebote`. */
const ERRORES: Record<string, string> = {
  google: "No se pudo abrir Google. Probá con tu mail.",
};

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ volver_a?: string; error?: string }>;
}) {
  const params = await searchParams;
  const volverA = rutaInternaSegura(params.volver_a, "/panel");
  const error = params.error ? (ERRORES[params.error] ?? mensajeDeRebote(params.error)) : undefined;

  return (
    <Card hero >
      <h1 className="mt-0 mb-2 t-titulo">
        Entrá a Inkey
      </h1>
      <p className="mt-0 mb-6 text-body">
        Tu historial de alquiler, siempre a mano. Entrás con tu mail o con Google.
      </p>
      {error && (
        <p role="alert" className="mb-5 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
          {error}
        </p>
      )}
      <IngresoForm volverA={volverA} />
    </Card>
  );
}
