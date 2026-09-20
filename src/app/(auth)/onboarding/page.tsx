import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/validation/auth";
import type { Intencion } from "@/lib/validation/profile";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Tus datos · Inkey",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ volver_a?: string; intencion?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar?volver_a=/onboarding");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name, last_name, accepted_terms_at, accepted_privacy_at, initial_intent")
    .eq("id", user.id)
    .maybeSingle();

  // Si ya lo completó, no lo hacemos pasar dos veces por lo mismo.
  if (
    perfil?.first_name &&
    perfil?.last_name &&
    perfil?.accepted_terms_at &&
    perfil?.accepted_privacy_at
  ) {
    redirect("/panel");
  }

  const intencionInicial: Intencion =
    params.intencion === "propietario" || perfil?.initial_intent === "propietario"
      ? "propietario"
      : "inquilino";

  return (
    <Card hero >
      <h1 className="mt-0 mb-2 t-titulo">
        Contanos quién sos
      </h1>
      <p className="mt-0 mb-6 text-body">
        Son dos minutos. Tu nombre completo lo ve solo la persona con la que compartís un alquiler:
        en tu perfil público aparece tu nombre y la inicial del apellido.
      </p>
      <OnboardingForm
        volverA={rutaInternaSegura(params.volver_a, "/panel")}
        intencionInicial={intencionInicial}
      />
    </Card>
  );
}
