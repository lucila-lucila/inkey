import { NextResponse } from "next/server";
import { generarRecibo } from "@/lib/pdf/recibo";
import { nombrePublico } from "@/lib/validation/profile";
import type { Moneda } from "@/lib/validation/rental";
import { registrarFalla } from "@/lib/errores";
import { createClient } from "@/lib/supabase/server";

// El PDF se arma en el servidor, con Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recibo en PDF de un pago confirmado.
 * Solo lo consiguen las dos partes: si no sos una de ellas, RLS no devuelve
 * el pago y esto responde 404.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/ingresar?volver_a=/pagos/${id}`, request.url));
  }

  const { data: pago } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (!pago) return new NextResponse("No encontramos ese pago.", { status: 404 });

  if (pago.status !== "confirmed") {
    return new NextResponse("El recibo se genera cuando el dueño confirma el pago.", {
      status: 409,
    });
  }

  const { data: alquiler } = await supabase
    .from("rentals")
    .select("tenant_id, owner_id, full_address, neighborhood_label")
    .eq("id", pago.rental_id)
    .maybeSingle();
  if (!alquiler) return new NextResponse("No encontramos el alquiler.", { status: 404 });

  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [alquiler.tenant_id, alquiler.owner_id].filter(Boolean) as string[]);

  const nombreDe = (idPersona: string | null) => {
    const perfil = perfiles?.find((fila) => fila.id === idPersona);
    return perfil ? nombrePublico(perfil.first_name ?? "", perfil.last_name ?? "") : "—";
  };

  const periodo = String(pago.period).slice(0, 10);

  try {
    const pdf = await generarRecibo({
      numero: `${String(pago.receipt_serial ?? 1).padStart(4, "0")}`,
      periodo,
      monto: String(pago.amount),
      moneda: pago.currency as Moneda,
      pagadoEl: String(pago.paid_on).slice(0, 10),
      vencia: String(pago.due_date).slice(0, 10),
      enFecha: Boolean(pago.on_time),
      confirmadoEl: String(pago.confirmed_at).slice(0, 10),
      inquilino: nombreDe(alquiler.tenant_id),
      duenio: nombreDe(alquiler.owner_id),
      direccion: alquiler.full_address,
      barrio: alquiler.neighborhood_label,
      conComprobante: Boolean(pago.receipt_path),
    });

    const nombreArchivo = `inkey-recibo-${periodo.slice(0, 7)}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${nombreArchivo}"`,
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex",
      },
    });
  } catch (error) {
    const ref = registrarFalla(`recibo pdf ${id}`, error);
    return new NextResponse(
      `No pudimos generar el recibo. Si sigue pasando, pasanos este código: ${ref}`,
      { status: 500 },
    );
  }
}
