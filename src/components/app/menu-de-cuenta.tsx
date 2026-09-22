"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Avatar, Button } from "@/components/ui";

/*
 * El menú que cuelga del avatar.
 *
 * En el celular no entra una barra de navegación: el nombre de cada pantalla
 * se partía en dos renglones y "Salir" quedaba fuera de la pantalla. Así que
 * ahí arriba queda solo el logo y el avatar, y todo lo demás vive acá adentro.
 *
 * En pantallas grandes la barra sigue estando, así que el menú muestra nada
 * más que "Salir": no repetimos los links que ya se ven.
 */

const LINKS = [
  { href: "/panel", clave: "panel" },
  { href: "/perfil", clave: "miPerfil" },
  { href: "/cuenta", clave: "miCuenta" },
] as const;

export function MenuDeCuenta({
  iniciales,
  cerrarSesion,
}: {
  iniciales: string;
  cerrarSesion: () => Promise<void>;
}) {
  const t = useTranslations("header");
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Se cierra al tocar afuera o con Escape, como cualquier menú.
  useEffect(() => {
    if (!abierto) return;

    function alTocar(evento: MouseEvent) {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }

    document.addEventListener("mousedown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((estaba) => !estaba)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={t("tuCuenta")}
        className="grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0"
      >
        <Avatar initials={iniciales} className="size-10 text-[16px]" />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-10 flex min-w-[190px] flex-col rounded-campo border-[1.5px] border-line bg-surface p-1.5 shadow-[0_18px_44px_-24px_rgba(35,32,28,0.45)]"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setAbierto(false)}
              className="rounded-[10px] px-3 py-2.5 text-[16px] font-medium text-ink no-underline hover:bg-surface-sunk min-[760px]:hidden"
            >
              {t(link.clave)}
            </Link>
          ))}

          <form action={cerrarSesion}>
            <button
              type="submit"
              role="menuitem"
              className="w-full cursor-pointer rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-left text-[16px] font-medium text-ink hover:bg-surface-sunk"
            >
              {t("salir")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Sin nombre todavía no hay iniciales: el menú igual tiene que existir. */
export function BotonSalir({ cerrarSesion }: { cerrarSesion: () => Promise<void> }) {
  const t = useTranslations("header");
  return (
    <form action={cerrarSesion}>
      <Button type="submit" variant="quiet" size="md">
        {t("salir")}
      </Button>
    </form>
  );
}
