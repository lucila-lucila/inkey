import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/validation/auth";
import { intencionSegura } from "@/lib/validation/profile";
import { destinoPostIngreso } from "@/lib/auth/destino";

/**
 * Vuelta del magic link y de Google. Cambia el código por una sesión y decide
 * a dónde mandar: al onboarding si falta completarlo, o a donde iba.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const volverA = rutaInternaSegura(searchParams.get("volver_a"), "/panel");
  const intencion = intencionSegura(searchParams.get("intencion"));

  if (!code) {
    return NextResponse.redirect(new URL("/ingresar?error=link", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession falló", error);
    return NextResponse.redirect(new URL("/ingresar?error=link", origin));
  }

  const destino = await destinoPostIngreso(volverA, intencion);
  return NextResponse.redirect(new URL(destino, origin));
}
