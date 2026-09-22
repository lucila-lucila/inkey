import { NextResponse, type NextRequest } from "next/server";
import { registrarAuditoria } from "@/lib/audit";
import { registrarFalla } from "@/lib/errores";
import { consumirIntento, identificadorCliente, MENSAJE_LIMITE } from "@/lib/ratelimit";
import { aCsv, nombreDeArchivo, type DatosExportados } from "@/lib/exportar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Descargar mis datos, en JSON o en CSV.
 *
 * Lo que devuelve sale de `account_export()`, que solo mira lo de quien pide:
 * no hay forma de pedir los datos de otra persona porque no se recibe ningún
 * id, se usa el de la sesión.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/ingresar?volver_a=/cuenta", request.nextUrl.origin));
  }

  /*
   * Es la consulta más pesada de la app: arma el historial completo en cada
   * llamada. Con límite, bajarse los datos sigue siendo un derecho y deja de
   * ser una forma barata de hacer trabajar al servidor.
   */
  const limite = await consumirIntento("export_datos", await identificadorCliente());
  if (!limite.permitido) {
    return NextResponse.json(
      { error: MENSAJE_LIMITE },
      {
        status: 429,
        headers: {
          "retry-after": String(limite.esperaSegundos),
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
        },
      },
    );
  }

  const formato = request.nextUrl.searchParams.get("formato") === "csv" ? "csv" : "json";

  const { data, error } = await supabase.rpc("account_export");

  if (error || !data) {
    const ref = registrarFalla("exportar: rpc account_export", error);
    return NextResponse.json(
      { error: `No se pudieron preparar tus datos. Código: ${ref}` },
      { status: 503, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } },
    );
  }

  await registrarAuditoria({
    actorId: user.id,
    action: "cuenta.exportada",
    entityType: "profile",
    entityId: user.id,
    metadata: { formato },
  });

  const cuerpo =
    formato === "csv" ? aCsv(data as DatosExportados) : JSON.stringify(data, null, 2);

  return new NextResponse(cuerpo, {
    headers: {
      "content-type":
        formato === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${nombreDeArchivo(formato)}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
