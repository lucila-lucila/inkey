import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rutas que exigen sesión iniciada. */
const RUTAS_PRIVADAS = ["/panel", "/onboarding", "/alquileres", "/pagos", "/perfil", "/cuenta"];

function esRutaPrivada(pathname: string): boolean {
  return RUTAS_PRIVADAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

function aIngresar(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/ingresar";
  url.searchParams.set("volver_a", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Refresca la sesión en cada request y corta el paso a las rutas privadas.
 * Es la primera barrera, no la única: cada consulta pasa además por RLS.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin Supabase configurado (por ejemplo, un clon recién bajado) la landing
  // tiene que seguir funcionando; lo privado queda cerrado.
  if (!url || !anonKey) {
    return esRutaPrivada(request.nextUrl.pathname)
      ? aIngresar(request)
      : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Si Supabase no responde, tratamos a la persona como no autenticada: las
  // rutas privadas se cierran en vez de quedar abiertas.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("No se pudo verificar la sesión", error);
  }

  if (!user && esRutaPrivada(request.nextUrl.pathname)) {
    return aIngresar(request);
  }

  return response;
}
