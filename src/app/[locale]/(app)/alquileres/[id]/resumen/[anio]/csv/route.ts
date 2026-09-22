import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { csvDelResumen } from "@/lib/domain/resumen";
import { cargarResumen } from "../datos";

export const dynamic = "force-dynamic";

/**
 * El resumen anual en CSV. Los permisos los decide `cargarResumen`: pide el
 * alquiler con la sesión de quien descarga y RLS hace el resto.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; anio: string }> },
) {
  const { id, anio } = await params;
  const cargado = await cargarResumen(id, anio);
  const t = await getTranslations();

  if (!cargado.ok) {
    if (cargado.motivo === "sin_sesion") {
      return NextResponse.redirect(
        new URL(`/ingresar?volver_a=/alquileres/${id}/resumen/${anio}`, request.url),
      );
    }
    return new NextResponse(t("resumen.noEncontrado"), { status: 404 });
  }

  const { resumen, barrio, direccion, inquilino, duenio } = cargado.datos;

  return new NextResponse(
    csvDelResumen({ t, resumen, barrio, direccion, inquilino, duenio }),
    {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="inkey-resumen-${resumen.anio}.csv"`,
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex",
      },
    },
  );
}
