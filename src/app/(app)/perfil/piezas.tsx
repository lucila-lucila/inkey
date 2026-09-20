"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cambiarMontos, crearLink, revocarLink, verLink, type EstadoLinkPerfil } from "./actions";
import { Button, Card, Checkbox, Field, Input, Pill } from "@/components/ui";
import { formatearFecha } from "@/lib/domain/alquiler";

const ESTADO_INICIAL: EstadoLinkPerfil = { estado: "inicial" };

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creando…" : "Crear el link"}
    </Button>
  );
}

/** Copiar al portapapeles, con aviso de que se copió. */
function BotonCopiar({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          setCopiado(false);
        }
      }}
    >
      {copiado ? "¡Copiado!" : "Copiar"}
    </Button>
  );
}

export function NuevoLink({ rol }: { rol: "tenant" | "owner" }) {
  const [estado, accion] = useActionState(crearLink, ESTADO_INICIAL);

  if (estado.estado === "listo") {
    return (
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="t-subtitulo mt-0 mb-1.5">Tu link está listo</h3>
          <p className="m-0 text-body">
            Mandáselo a quien quieras. Podés revocarlo cuando quieras y deja de funcionar en el
            acto.
          </p>
        </div>
        <div className="flex gap-2.5 max-[560px]:flex-col">
          <input
            readOnly
            value={estado.url}
            onFocus={(evento) => evento.currentTarget.select()}
            aria-label="Link de tu perfil"
            className="min-h-[52px] w-full min-w-0 flex-1 rounded-campo border border-line bg-surface-sunk px-4 text-[15px] text-ink"
          />
          <BotonCopiar url={estado.url} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="t-subtitulo mt-0 mb-1.5">Crear un link nuevo</h3>
        <p className="m-0 text-body">
          Podés tener varios y revocar el que quieras. Nadie ve esto sin tu permiso.
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <input type="hidden" name="rol" value={rol} />
        <Field
          label="¿Para quién es? (opcional)"
          htmlFor="etiqueta"
          hint="Solo para que lo reconozcas en tu lista."
        >
          <Input id="etiqueta" name="etiqueta" maxLength={60} placeholder="Inmobiliaria de Palermo" />
        </Field>

        <Checkbox
          id="montos"
          name="montos"
          label="Mostrar los montos de mis alquileres en este link"
        />

        {estado.estado === "error" && (
          <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
            {estado.mensaje}
          </p>
        )}

        <div>
          <BotonCrear />
        </div>
      </form>
    </Card>
  );
}

export type LinkGuardado = {
  id: string;
  label: string | null;
  show_amounts: boolean;
  view_count: number;
  created_at: string;
  revoked_at: string | null;
  subject_role: string;
};

export function ListaDeLinks({ links }: { links: LinkGuardado[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mostrar(id: string) {
    setError(null);
    setAbierto(id);
    setUrl(null);
    const resultado = await verLink(id);
    if ("url" in resultado) setUrl(resultado.url);
    else setError(resultado.error);
  }

  if (links.length === 0) {
    return (
      <Card>
        <p className="m-0 text-body">
          Todavía no compartiste tu historial con nadie. Cuando crees un link, va a aparecer acá con
          las veces que lo abrieron.
        </p>
      </Card>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {links.map((link) => {
        const revocado = Boolean(link.revoked_at);
        return (
          <li key={link.id}>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-[17px] font-medium">
                    {link.label ?? "Link sin nombre"}
                  </p>
                  <p className="m-0 text-[15px] text-muted">
                    Creado el {formatearFecha(link.created_at.slice(0, 10))} ·{" "}
                    {link.view_count === 0
                      ? "todavía no lo abrieron"
                      : link.view_count === 1
                        ? "lo abrieron 1 vez"
                        : `lo abrieron ${link.view_count} veces`}
                  </p>
                </div>
                <Pill tone={revocado ? "neutral" : "confirm"}>
                  {revocado ? "Revocado" : "Activo"}
                </Pill>
              </div>

              {!revocado && (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button type="button" variant="secondary" size="md" onClick={() => mostrar(link.id)}>
                      Ver el link
                    </Button>

                    <form action={cambiarMontos}>
                      <input type="hidden" name="link_id" value={link.id} />
                      <input type="hidden" name="mostrar" value={String(!link.show_amounts)} />
                      <Button type="submit" variant="quiet" size="md">
                        {link.show_amounts ? "Ocultar los montos" : "Mostrar los montos"}
                      </Button>
                    </form>

                    <form action={revocarLink}>
                      <input type="hidden" name="link_id" value={link.id} />
                      <Button type="submit" variant="quiet" size="md">
                        Revocar
                      </Button>
                    </form>
                  </div>

                  {abierto === link.id && (
                    <div className="flex gap-2.5 max-[560px]:flex-col">
                      <input
                        readOnly
                        value={url ?? "Buscando el link…"}
                        onFocus={(evento) => evento.currentTarget.select()}
                        aria-label="Link de tu perfil"
                        className="min-h-[52px] w-full min-w-0 flex-1 rounded-campo border border-line bg-surface-sunk px-4 text-[15px] text-ink"
                      />
                      {url && <BotonCopiar url={url} />}
                    </div>
                  )}

                  {abierto === link.id && error && (
                    <p role="alert" className="m-0 text-[15px] text-primary-ink">
                      {error}
                    </p>
                  )}
                </>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
