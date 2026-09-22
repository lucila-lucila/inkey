import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { registrarFalla } from "@/lib/errores";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { generarResumen } from "@/lib/pdf/resumen";
import { cargarResumen } from "../datos";

// El PDF se arma en el servidor, con Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El resumen anual en PDF. Los permisos los decide `cargarResumen`: pide el
 * alquiler con la sesión de quien descarga y RLS hace el resto.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; anio: string }> },
) {
  const { id, anio } = await params;
  const cargado = await cargarResumen(id, anio);
  const t = await getTranslations();
  const idioma = await getLocale();

  if (!cargado.ok) {
    if (cargado.motivo === "sin_sesion") {
      return NextResponse.redirect(
        new URL(`/ingresar?volver_a=/alquileres/${id}/resumen/${anio}`, request.url),
      );
    }
    return new NextResponse(t("resumen.noEncontrado"), { status: 404 });
  }

  const { resumen, barrio, direccion, inquilino, duenio } = cargado.datos;

  /* Armar el PDF es caro; pedirlo, no. */
  const limite = await consumirIntento("documento_pdf", await identificadorCliente());
  if (!limite.permitido) {
    return new NextResponse(t(MENSAJE_LIMITE), {
      status: 429,
      headers: { "retry-after": String(limite.esperaSegundos), "cache-control": "no-store" },
    });
  }

  try {
    const pdf = await generarResumen({
      t,
      idioma,
      resumen,
      barrio,
      direccion,
      inquilino,
      duenio,
      generadoEl: new Date().toISOString().slice(0, 10),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="inkey-resumen-${resumen.anio}.pdf"`,
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex",
      },
    });
  } catch (error) {
    const ref = registrarFalla(`resumen pdf ${id} ${anio}`, error);
    return new NextResponse(t("resumen.noSePudoGenerar", { ref }), { status: 500 });
  }
}
