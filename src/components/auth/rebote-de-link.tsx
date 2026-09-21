"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { codigoDeRebote } from "@/lib/auth/errores-link";

/**
 * El mismo rebote que ataja el proxy, pero cuando el error viene en el
 * fragmento (`#error_code=otp_expired&…`). El fragmento no viaja al servidor:
 * esto solo se puede mirar desde el navegador.
 *
 * Va en el layout raíz para que valga en cualquier pantalla, caiga donde caiga.
 */
export function ReboteDeLink() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || !hash.includes("error")) return;

    const parametros = new URLSearchParams(hash);
    if (!parametros.has("error_code") && !parametros.has("error_description")) return;

    const codigo =
      codigoDeRebote({
        error: parametros.get("error"),
        error_code: parametros.get("error_code"),
      }) ?? "link";

    // Que no quede el fragmento dando vueltas en el historial.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    router.replace(`/ingresar?error=${encodeURIComponent(codigo)}`);
  }, [router]);

  return null;
}
