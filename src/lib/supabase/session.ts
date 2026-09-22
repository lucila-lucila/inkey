import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { partirRuta, prefijoDe } from "@/i18n/idioma";
import { codigoDeRebote, esRebote } from "@/lib/auth/errores-link";

/** Rutas que exigen sesión iniciada. */
const RUTAS_PRIVADAS = ["/panel", "/onboarding", "/alquileres", "/pagos", "/perfil", "/cuenta"];

/**
 * Salvedades: el link que le llega al dueño por mail confirma un pago sin
 * sesión, así que esta ruta queda abierta aunque cuelgue de /pagos.
 */
const RUTAS_ABIERTAS = ["/pagos/confirmar"];

/*
 * Las rutas se comparan sin el prefijo de idioma: `/panel` y `/en/panel` son
 * la misma pantalla y las dos piden sesión.
 */
function esRutaPrivada(pathname: string): boolean {
  const { resto } = partirRuta(pathname);
  if (RUTAS_ABIERTAS.some((ruta) => resto === ruta || resto.startsWith(`${ruta}/`))) {
    return false;
  }
  return RUTAS_PRIVADAS.some((ruta) => resto === ruta || resto.startsWith(`${ruta}/`));
}

function aIngresar(request: NextRequest): NextResponse {
  // Guardamos a dónde iba, con sus parámetros, para volver exactamente ahí
  // después de entrar. Y lo mandamos a entrar en su mismo idioma.
  const destino = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const { idioma } = partirRuta(request.nextUrl.pathname);
  const url = new URL(`${prefijoDe(idioma)}/ingresar`, request.nextUrl.origin);
  url.searchParams.set("volver_a", destino);
  return NextResponse.redirect(url);
}

/**
 * Un link de ingreso muerto rebota al Site URL con el error en la query. Caiga
 * donde caiga, lo llevamos a /ingresar con un mensaje que se entienda, en vez
 * de dejar a la persona mirando la landing con una URL rara.
 */
function reboteDeIngreso(request: NextRequest): NextResponse | null {
  const { pathname, searchParams, origin } = request.nextUrl;
  const { idioma, resto } = partirRuta(pathname);
  if (resto === "/ingresar" || !esRebote(searchParams)) return null;

  const url = new URL(`${prefijoDe(idioma)}/ingresar`, origin);
  const codigo = codigoDeRebote({
    error: searchParams.get("error"),
    error_code: searchParams.get("error_code"),
  });
  url.searchParams.set("error", codigo ?? "link");

  // Si el rebote conserva a dónde iba, lo respetamos.
  const volverA = searchParams.get("volver_a");
  if (volverA) url.searchParams.set("volver_a", volverA);

  return NextResponse.redirect(url);
}

/**
 * Refresca la sesión en cada request y corta el paso a las rutas privadas.
 * Es la primera barrera, no la única: cada consulta pasa además por RLS.
 */
export async function updateSession(request: NextRequest, reescribirA: URL | null = null) {
  const rebote = reboteDeIngreso(request);
  if (rebote) return rebote;

  /*
   * Una sola respuesta para todo. La reescritura del idioma y las cookies que
   * refrescan la sesión tienen que viajar juntas: si se arman por separado,
   * una de las dos se pierde.
   */
  const seguir = () =>
    reescribirA
      ? NextResponse.rewrite(reescribirA, { request })
      : NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin Supabase configurado (por ejemplo, un clon recién bajado) la landing
  // tiene que seguir funcionando; lo privado queda cerrado.
  if (!url || !anonKey) {
    return esRutaPrivada(request.nextUrl.pathname) ? aIngresar(request) : seguir();
  }

  let response = seguir();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = seguir();
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
