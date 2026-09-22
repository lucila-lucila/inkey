"use client";

import { useState } from "react";
import { Input } from "./field";
import { conSeparadores, montoParaCampo } from "@/lib/domain/alquiler";

/*
 * El campo donde se escribe plata.
 *
 * Los montos de un alquiler tienen seis dígitos: "450000" no se lee, hay que
 * contar los ceros. Así que separamos los miles mientras se escribe, como en
 * cualquier resumen bancario de acá.
 *
 * Va como texto y no como `type="number"`: el campo numérico no deja poner
 * puntos, y encima suma esas flechitas que nadie usa para un precio. El
 * servidor recibe "450.000" y lo entiende igual, porque `parsearMonto` ya
 * acepta cómo escribe la gente.
 */

export function CampoMonto({
  id,
  name,
  defaultValue,
  ...props
}: {
  id: string;
  name: string;
  defaultValue?: number | string | null;
} & Omit<React.ComponentProps<typeof Input>, "defaultValue" | "value" | "onChange" | "type">) {
  const [valor, setValor] = useState(() => montoParaCampo(defaultValue));

  return (
    <Input
      {...props}
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={valor}
      onChange={(evento) => setValor(conSeparadores(evento.target.value))}
    />
  );
}
