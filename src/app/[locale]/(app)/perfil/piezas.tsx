"use client";

import { useLocale, useTranslations } from "next-intl";
import { traducirMensaje } from "@/i18n/texto";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cambiarMontos, crearLink, revocarLink, verLink, type EstadoLinkPerfil } from "./actions";
import { Button, Card, Checkbox, Field, Input, Pill } from "@/components/ui";
import { formatearFecha } from "@/lib/domain/alquiler";

const ESTADO_INICIAL: EstadoLinkPerfil = { estado: "inicial" };

function BotonCrear() {
  const t = useTranslations();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("links.creando") : t("links.crear")}
    </Button>
  );
}

/** Copiar al portapapeles, con aviso de que se copió. */
function BotonCopiar({ url }: { url: string }) {
  const t = useTranslations();
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
      {copiado ? t("links.copiado") : t("links.copiar")}
    </Button>
  );
}

/*
 * El formulario de alta. No muestra el link recién creado: para eso está la
 * lista, que es una sola. Antes se veía el link acá arriba y otra vez abajo,
 * y parecían dos links distintos.
 */
function NuevoLink({
  rol,
  alCrear,
}: {
  rol: "tenant" | "owner";
  alCrear: (link: { id: string; url: string }) => void;
}) {
  const t = useTranslations();
  const [estado, accion] = useActionState(crearLink, ESTADO_INICIAL);
  const [avisado, setAvisado] = useState<string | null>(null);

  // El alta la resuelve el servidor; acá solo avisamos cuál es el nuevo.
  if (estado.estado === "listo" && avisado !== estado.id) {
    setAvisado(estado.id);
    alCrear({ id: estado.id, url: estado.url });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="t-subtitulo mt-0 mb-1.5">{t("links.crearNuevo")}</h3>
        <p className="m-0 text-body">
          {t("links.bajada")}
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <input type="hidden" name="rol" value={rol} />
        <Field
          label={t("links.paraQuien")}
          htmlFor="etiqueta"
          hint={t("links.pistaNombre")}
        >
          <Input id="etiqueta" name="etiqueta" maxLength={60} placeholder={t("links.ejemploNombre")} />
        </Field>

        <Checkbox
          id="montos"
          name="montos"
          label={t("links.mostrarMontos")}
        />

        {estado.estado === "error" && (
          <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
            {traducirMensaje(t, estado.mensaje)}
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

/*
 * La sección entera: el alta y la lista, juntas.
 *
 * Van en un solo componente porque comparten una cosa: cuál es el link que
 * se acaba de crear. Así aparece una sola vez, ya abierto y listo para
 * copiar, en la misma lista donde van a estar todos los demás.
 */
export function SeccionDeLinks({ rol, links }: { rol: "tenant" | "owner"; links: LinkGuardado[] }) {
  const t = useTranslations();
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

  return (
    <>
      <NuevoLink
        rol={rol}
        alCrear={({ id, url: recien }) => {
          setError(null);
          setAbierto(id);
          setUrl(recien);
        }}
      />
      <ListaDeLinks
        links={links}
        abierto={abierto}
        url={url}
        error={traducirMensaje(t, error)}
        mostrar={mostrar}
      />
    </>
  );
}

function ListaDeLinks({
  links,
  abierto,
  url,
  error,
  mostrar,
}: {
  links: LinkGuardado[];
  abierto: string | null;
  url: string | null;
  error: string | null;
  mostrar: (id: string) => void;
}) {
  const idioma = useLocale();
  const t = useTranslations();
  if (links.length === 0) {
    return (
      <Card>
        <p className="m-0 text-body">
          {t("links.vacio")}
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
                  {/*
                    Sin nombre no decimos "Link sin nombre", que no le sirve a
                    nadie: le proponemos ponerle uno, que es lo que hace falta
                    cuando hay más de un link dando vueltas.
                  */}
                  {link.label ? (
                    <p className="m-0 text-[17px] font-medium">{link.label}</p>
                  ) : (
                    <p className="m-0 text-[17px] font-medium text-body">
                      {t("links.sinNombre")}
                    </p>
                  )}
                  <p className="m-0 text-[15px] text-muted">
                    {t("links.creado", { fecha: formatearFecha(link.created_at.slice(0, 10), idioma) })} ·{" "}
                    {t("links.aperturas", { cantidad: link.view_count })}
                  </p>
                </div>
                <Pill tone={revocado ? "neutral" : "confirm"}>
                  {revocado ? t("links.revocado") : t("links.activo")}
                </Pill>
              </div>

              {!revocado && (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button type="button" variant="secondary" size="md" onClick={() => mostrar(link.id)}>
                      {t("links.verElLink")}
                    </Button>

                    <form action={cambiarMontos}>
                      <input type="hidden" name="link_id" value={link.id} />
                      <input type="hidden" name="mostrar" value={String(!link.show_amounts)} />
                      <Button type="submit" variant="quiet" size="md">
                        {link.show_amounts ? t("links.ocultarMontos") : t("links.mostrarLosMontos")}
                      </Button>
                    </form>

                    {/* Revocar no se ofrece como un botón más: es el final del link. */}
                    <form action={revocarLink} className="ml-auto">
                      <button
                        type="submit"
                        className="cursor-pointer border-0 bg-transparent p-0 text-[15px] text-muted underline underline-offset-4 hover:text-ink"
                      >
                        {t("links.revocar")}
                      </button>
                    </form>
                  </div>

                  {abierto === link.id && (
                    <div className="flex gap-2.5 max-[560px]:flex-col">
                      <input
                        readOnly
                        value={url ?? t("links.buscando")}
                        onFocus={(evento) => evento.currentTarget.select()}
                        aria-label={t("links.linkDeTuPerfil")}
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
