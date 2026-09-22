import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { texto } from "@/i18n/texto";
import { mensajeDeRebote } from "@/lib/auth/errores-link";
import { rutaInternaSegura } from "@/lib/validation/auth";
import { intencionSegura } from "@/lib/validation/profile";
import { IngresoForm } from "./ingreso-form";

export const metadata: Metadata = {
  title: "Entrar · Inkey",
  robots: { index: false, follow: false },
};

/** Los errores nuestros; los rebotes de Supabase los traduce `mensajeDeRebote`. */
const ERRORES: Record<string, string> = {
  google: "ingreso.errorGoogle",
};

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ volver_a?: string; error?: string; intencion?: string }>;
}) {
  const t = await getTranslations("ingreso");
  const tt = await getTranslations();
  const params = await searchParams;
  const volverA = rutaInternaSegura(params.volver_a, "/panel");
  const error = params.error ? (ERRORES[params.error] ?? mensajeDeRebote(params.error)) : undefined;
  // Viene de la landing: preselecciona "¿Qué querés hacer primero?".
  const intencion = intencionSegura(params.intencion);

  return (
    <Card hero >
      <h1 className="mt-0 mb-2 t-titulo">{t("titulo")}</h1>
      <p className="mt-0 mb-6 text-body">{t("bajada")}</p>
      {error && (
        <p role="alert" className="mb-5 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
          {texto(tt, error)}
        </p>
      )}
      <IngresoForm volverA={volverA} intencion={intencion} />
    </Card>
  );
}
