import type { Metadata } from "next";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Registrar un alquiler · Inkey",
  robots: { index: false, follow: false },
};

/*
 * Placeholder de la Fase 1: el alta de alquiler con sus pasos e invitaciones
 * se construye en la Fase 2 y reemplaza por completo esta pantalla.
 */
export default function NuevoAlquilerPage() {
  return (
    <Card className="max-w-[560px] p-6">
      <h1 className="mt-0 mb-2 font-serif text-[28px] font-semibold">Ya casi</h1>
      <p className="mt-0 mb-5 text-body">
        El alta de alquileres con la invitación por WhatsApp llega en la próxima entrega. Mientras
        tanto ya podés entrar con tu mail y tenés tu perfil creado.
      </p>
      <ButtonLink href="/panel" variant="outline">
        Volver al panel
      </ButtonLink>
    </Card>
  );
}
