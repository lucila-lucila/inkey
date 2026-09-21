"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { INTENCIONES, type Intencion } from "@/lib/validation/profile";

/*
 * La puerta de entrada de la landing.
 *
 * Sin contraseñas, registrarse e ingresar son el mismo flujo: los dos botones
 * van a /ingresar. Lo único que cambia es qué espera la persona, y eso lo dice
 * el texto.
 *
 * El rol elegido viaja como `intencion` hasta el onboarding, para que
 * "¿Qué querés hacer primero?" llegue con la respuesta puesta. Es una
 * preselección, no una decisión cerrada: en Inkey el rol es de cada alquiler,
 * no de la cuenta.
 */
const OPCIONES: Array<{ valor: Intencion; texto: string }> = [
  { valor: "inquilino", texto: "Soy inquilino/a" },
  { valor: "propietario", texto: "Soy propietario/a" },
];

export function Acceso() {
  const [intencion, setIntencion] = useState<Intencion>(INTENCIONES[0]);

  return (
    <div id="empezar" className="max-w-[560px] rounded-tarjeta bg-surface p-6">
      <div
        role="group"
        aria-label="¿Quién sos?"
        className="mb-5 inline-grid grid-cols-2 gap-1.5 rounded-full bg-surface-sunk p-1.5 max-[560px]:grid max-[560px]:w-full"
      >
        {OPCIONES.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={intencion === opcion.valor}
            onClick={() => setIntencion(opcion.valor)}
            className={cn(
              "min-h-[44px] cursor-pointer rounded-full border-0 px-[18px] py-2.5 text-[15px] font-medium",
              "max-[560px]:px-2",
              intencion === opcion.valor
                ? "bg-primary text-on-primary"
                : "bg-transparent text-body",
            )}
          >
            {opcion.texto}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Link
          href={`/ingresar?intencion=${intencion}`}
          className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-primary px-7 text-[17px] font-medium text-on-primary no-underline hover:brightness-110"
        >
          Empezá gratis
        </Link>

        <p className="m-0 text-[15px] text-muted">
          <Link href="/ingresar" className="font-medium text-confirm-ink">
            Ya tengo cuenta · Ingresar
          </Link>
        </p>

        <p className="m-0 text-[15px] text-muted">
          Gratis. Sin contraseñas: entrás con tu mail. Sin datos crediticios.
        </p>
      </div>
    </div>
  );
}
