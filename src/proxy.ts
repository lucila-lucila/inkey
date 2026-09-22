import { NextResponse, type NextRequest } from "next/server";
import { estaActivo, idiomaDeRespaldo } from "@/i18n/activos";
import { COOKIE_IDIOMA, idiomaDelNavegador, partirRuta, prefijoDe } from "@/i18n/idioma";
import { esIdioma, IDIOMA_POR_DEFECTO } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/session";

/*
 * Corre antes de cada navegación. Hace dos cosas, en este orden:
 *
 *   1. manda a quien llega por primera vez al idioma de su navegador,
 *   2. refresca la sesión de Supabase y cierra las rutas privadas.
 *
 * El idioma va primero porque es un redirect: no tiene sentido verificar la
 * sesión de una request que no vamos a contestar.
 */

/** Rutas que no son pantallas y no llevan idioma. */
const SIN_IDIOMA = ["/api", "/auth", "/_next", "/robots.txt", "/sitemap.xml"];

function llevaIdioma(pathname: string): boolean {
  return !SIN_IDIOMA.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

/**
 * Un idioma apagado manda a su reemplazo, con la misma ruta.
 *
 * Los links ya están dando vueltas por mails y WhatsApp: apagar el inglés no
 * puede convertir `/en/invitacion/<token>` en un 404.
 */
function redirigirSiEstaApagado(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (!llevaIdioma(pathname)) return null;

  const { idioma, resto } = partirRuta(pathname);
  if (estaActivo(idioma)) return null;

  const destino = `${prefijoDe(idiomaDeRespaldo())}${resto === "/" ? "" : resto}` || "/";
  return NextResponse.redirect(new URL(`${destino}${search}`, request.nextUrl.origin));
}

/**
 * La primera visita cae en el idioma del navegador, si está prendido.
 *
 * Solo redirige cuando la persona todavía no eligió nada: apenas toca el
 * selector del pie queda la cookie, y a partir de ahí manda ella y no el
 * navegador.
 */
function redirigirPorIdioma(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (!llevaIdioma(pathname)) return null;

  const respaldo = idiomaDeRespaldo();

  // La URL ya dice otro idioma: es explícita y no se discute.
  const { idioma: enLaRuta } = partirRuta(pathname);
  if (enLaRuta !== respaldo) return null;

  const elegido = request.cookies.get(COOKIE_IDIOMA)?.value;
  if (esIdioma(elegido) && estaActivo(elegido)) return null;

  const delNavegador = idiomaDelNavegador(request.headers.get("accept-language"));
  // Un idioma apagado no existe para la detección automática.
  if (!delNavegador || delNavegador === respaldo || !estaActivo(delNavegador)) return null;

  const destino = `${prefijoDe(delNavegador)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(new URL(`${destino}${search}`, request.nextUrl.origin));
}

export default async function proxy(request: NextRequest) {
  const apagado = redirigirSiEstaApagado(request);
  if (apagado) return apagado;

  const porIdioma = redirigirPorIdioma(request);
  if (porIdioma) return porIdioma;

  /*
   * Las pantallas viven en `app/[locale]/`, pero el castellano no lleva
   * prefijo en la URL. Así que `/panel` se sirve por dentro como `/es/panel`,
   * sin que la barra de direcciones cambie: los links que ya están dando
   * vueltas por ahí tienen que seguir funcionando tal cual se mandaron.
   */
  /*
   * Solo se reescribe la ruta sin prefijo, que estructuralmente es la del
   * idioma por defecto. Si ese idioma está apagado, ya redirigimos más
   * arriba y acá no llega ninguna.
   */
  const { pathname } = request.nextUrl;
  const reescribirA =
    llevaIdioma(pathname) && partirRuta(pathname).idioma === IDIOMA_POR_DEFECTO
      ? new URL(
          `/${IDIOMA_POR_DEFECTO}${pathname === "/" ? "" : pathname}${request.nextUrl.search}`,
          request.nextUrl.origin,
        )
      : null;

  return updateSession(request, reescribirA);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
