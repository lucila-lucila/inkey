"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { borrarCuenta, guardarDatos, type EstadoBaja, type EstadoDatos } from "./actions";
import { Button, Field, Input } from "@/components/ui";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary">
      {pending ? "Guardando…" : "Guardar los cambios"}
    </Button>
  );
}

/** Nombre, apellido y celular. El mail no se edita: con él se entra. */
export function MisDatos({
  nombre,
  apellido,
  celular,
}: {
  nombre: string;
  apellido: string;
  celular: string;
}) {
  const [estado, accion] = useActionState(guardarDatos, { estado: "inicial" } as EstadoDatos);
  const errorDe = (campo: string) =>
    estado.estado === "error" && estado.campo === campo ? estado.mensaje : undefined;

  return (
    <form action={accion} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="first_name" error={errorDe("first_name")}>
          <Input id="first_name" name="first_name" defaultValue={nombre} autoComplete="given-name" required />
        </Field>
        <Field label="Apellido" htmlFor="last_name" error={errorDe("last_name")}>
          <Input id="last_name" name="last_name" defaultValue={apellido} autoComplete="family-name" required />
        </Field>
      </div>

      <Field
        label="Celular"
        htmlFor="phone"
        hint="Para que tu dueño o tu inquilino puedan ubicarte. No se muestra en tu perfil público."
        error={errorDe("phone")}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={celular}
          autoComplete="tel"
          required
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <BotonGuardar />
        {estado.estado === "guardado" && (
          <p role="status" className="m-0 text-[15px] font-medium text-confirm-ink">
            Listo, guardado.
          </p>
        )}
        {estado.estado === "error" && !estado.campo && (
          <p role="alert" className="m-0 text-[15px] text-primary-ink">
            {estado.mensaje}
          </p>
        )}
      </div>
    </form>
  );
}

function BotonBaja() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary">
      {pending ? "Dando de baja…" : "Dar de baja mi cuenta"}
    </Button>
  );
}

/**
 * Darse de baja. Está detrás de dos puertas a propósito: abrir el panel y
 * escribir BORRAR. No se deshace.
 */
export function BorrarCuenta() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(borrarCuenta, { estado: "inicial" } as EstadoBaja);

  if (!abierto) {
    /*
      Una acción de texto y no un botón: darse de baja es algo que se ofrece,
      no algo que se invita a hacer. Un botón centrado en su propia tarjeta le
      daba el peso de una acción principal.
    */
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="cursor-pointer self-start border-0 bg-transparent p-0 text-left text-[16px] font-medium text-body underline underline-offset-4 hover:text-ink"
      >
        Quiero dar de baja mi cuenta
      </button>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="rounded-campo bg-surface-sunk p-4 text-[15px] text-body">
        <p className="mt-0 mb-2 font-medium text-ink">Qué pasa cuando te das de baja</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>Se borran tu nombre, tu apellido, tu celular y tu foto.</li>
          <li>Tus links compartidos dejan de funcionar en el momento.</li>
          <li>
            Los alquileres y los pagos confirmados siguen existiendo para la otra parte: ese
            historial también es suyo. Vas a figurar como “Usuario dado de baja”.
          </li>
          <li>Las reseñas que recibiste dejan de mostrarse. Las que escribiste quedan, ya anónimas.</li>
          <li>
            Los comprobantes y contratos que subiste se borran a los 30 días, y le avisamos a la
            otra parte para que pueda descargarlos si los necesita.
          </li>
          <li>Tu mail queda libre: podés volver a registrarte cuando quieras y empezás de cero.</li>
        </ul>
      </div>

      <p className="m-0 text-[15px] text-body">
        Antes de seguir, descargá tus datos: después de la baja ya no vas a poder.
      </p>

      <Field
        label="Escribí BORRAR para confirmar"
        htmlFor="confirmacion"
        error={estado.estado === "error" ? estado.mensaje : undefined}
      >
        <Input
          id="confirmacion"
          name="confirmacion"
          autoComplete="off"
          placeholder="BORRAR"
          required
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <BotonBaja />
        <Button type="button" variant="quiet" onClick={() => setAbierto(false)}>
          Mejor no
        </Button>
      </div>
    </form>
  );
}
