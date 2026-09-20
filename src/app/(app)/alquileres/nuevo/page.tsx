import type { Metadata } from "next";
import { Card } from "@/components/ui";
import type { RolAlquiler } from "@/lib/validation/rental";
import { NuevoAlquilerForm } from "./nuevo-form";

export const metadata: Metadata = {
  title: "Registrar un alquiler · Inkey",
  robots: { index: false, follow: false },
};

export default async function NuevoAlquilerPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const params = await searchParams;
  const rol: RolAlquiler = params.rol === "propietario" ? "propietario" : "inquilino";

  return (
    <Card hero className="max-w-[640px]">
      <NuevoAlquilerForm rol={rol} />
    </Card>
  );
}
