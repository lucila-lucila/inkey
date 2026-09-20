import { NextResponse } from "next/server";
import { generarPerfilPdf } from "@/lib/pdf/perfil";
import { registrarFalla } from "@/lib/errores";
import { perfilDelToken } from "../datos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El mismo perfil, en PDF: lo que no se muestra en la web, acá tampoco. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Bajarse el PDF no cuenta como una visita más.
  const perfil = await perfilDelToken(token, { contar: false });

  if (perfil.estado !== "valido") {
    return new NextResponse("Este link ya no está disponible.", {
      status: 404,
      headers: { "x-robots-tag": "noindex" },
    });
  }

  try {
    const pdf = await generarPerfilPdf({
      nombre: perfil.nombre,
      inicialApellido: perfil.inicial_apellido,
      rol: perfil.rol,
      metricas: perfil.metricas,
      generadoEl: new Date().toISOString().slice(0, 10),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="inkey-historial.pdf"',
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex",
      },
    });
  } catch (error) {
    const ref = registrarFalla("perfil pdf", error);
    return new NextResponse(
      `No se pudo generar el PDF. Probá de nuevo en un momento. Si sigue pasando, pasanos este código: ${ref}`,
      { status: 500 },
    );
  }
}
