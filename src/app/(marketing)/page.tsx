import type { Metadata } from "next";
import { Suspense } from "react";
import { AvisoDeBaja } from "@/components/landing/aviso-de-baja";
import { Audiences } from "@/components/landing/audiences";
import { ExampleProfile } from "@/components/landing/example-profile";
import { FinalCta } from "@/components/landing/final-cta";
import { HouseRules } from "@/components/landing/house-rules";
import { SiteHeader } from "@/components/landing/site-header";
import { Steps } from "@/components/landing/steps";
import { Acceso } from "@/components/landing/acceso";
import { OutlineTag, Pie } from "@/components/ui";

/** La landing es la única pantalla indexable de todo el sitio. */
export const metadata: Metadata = {
  title: "Inkey · Tu historial de alquiler, confirmado",
  description:
    "Vos y tu dueño confirman cada pago, mes a mes. Tu historial de alquiler es tuyo y lo llevás a tu próximo alquiler.",
  robots: { index: true, follow: true },
  /*
   * El dominio bueno es uno solo. Sin esto, la URL del deploy de Vercel y el
   * dominio sin www quedan compitiendo con el definitivo en los buscadores.
   */
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Inkey",
    locale: "es_AR",
    url: "/",
    title: "Inkey · Tu historial de alquiler, confirmado",
    description:
      "Vos y tu dueño confirman cada pago, mes a mes. Tu historial de alquiler es tuyo y lo llevás a tu próximo alquiler.",
  },
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="top">
        {/* Vuelta de una baja de cuenta: que no quede en la nada. */}
        <Suspense fallback={null}>
          <AvisoDeBaja />
        </Suspense>
        <section className="wrap grid grid-cols-1 items-center gap-14 pt-6 pb-18 min-[960px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[960px]:gap-18 min-[960px]:pt-14 min-[960px]:pb-28">
          <div>
            <OutlineTag>Tu historial de alquiler, confirmado</OutlineTag>
            <h1 className="t-display mt-6 mb-5">
              Pagaste puntual durante años.{" "}
              <em className="text-primary-ink not-italic">Ahora demostralo.</em>
            </h1>
            <p className="t-cuerpo mt-0 mb-7 max-w-[34em] text-[19px] text-body">
              Vos y tu dueño confirman cada pago, mes a mes. Ese historial es tuyo y lo llevás a tu
              próximo alquiler para que hable por vos.
            </p>
            <Acceso />
          </div>
          <ExampleProfile />
        </section>

        <Steps />
        <Audiences />
        <HouseRules />
        <FinalCta />
      </main>
      <Pie conLogo />
    </>
  );
}
