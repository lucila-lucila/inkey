import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Corre antes de cada navegación: refresca la sesión de Supabase y manda a
 * /ingresar a quien no tenga sesión en una ruta privada.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
