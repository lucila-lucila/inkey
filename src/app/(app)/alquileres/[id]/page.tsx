import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, Pill } from "@/components/ui";
import {
  ESTADOS_ALQUILER,
  formatearFecha,
  formatearMonto,
  textoRol,
  textoVencimiento,
  type EstadoAlquiler,
} from "@/lib/domain/alquiler";
import { nombreDeContraparte } from "@/lib/validation/profile";
import { periodosDelAlquiler, vencimientoDe } from "@/lib/domain/pagos";
import { SeccionPagos, type FilaPeriodo, type PagoDelPeriodo } from "@/components/pago/seccion-pagos";
import { ConfirmarFin, ProponerFin } from "@/components/resena/fin-de-contrato";
import { FormularioResena } from "@/components/resena/formulario-resena";
import { ListaResenas } from "@/components/resena/lista-resenas";
import {
  direccionDe,
  fechaDePublicacion,
  type EtiquetaResena,
  type ResenaPropia,
} from "@/lib/domain/resenas";
import type { Moneda } from "@/lib/validation/rental";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { BotonContrato, CancelarAlquiler, NuevoLink, SubirContrato } from "./piezas";

export const metadata: Metadata = {
  title: "Alquiler · Inkey",
  robots: { index: false, follow: false },
};

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="t-etiqueta text-muted">{etiqueta}</dt>
      <dd className="m-0 text-[17px] font-medium">{valor}</dd>
    </div>
  );
}

export default async function AlquilerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/ingresar?volver_a=/alquileres/${id}`);

  // RLS: si no sos parte de este alquiler, simplemente no existe.
  const { data: alquiler } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!alquiler) notFound();

  const soyInquilino = alquiler.tenant_id === user.id;
  const idContraparte = soyInquilino ? alquiler.owner_id : alquiler.tenant_id;
  const rolContraparte = soyInquilino ? "owner" : "tenant";

  const { data: contraparte } = idContraparte
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, deleted_at")
        .eq("id", idContraparte)
        .maybeSingle()
    : { data: null };

  const { data: pagos } = await supabase
    .from("payments")
    .select(
      "id, period, status, amount, currency, paid_on, due_date, on_time, owner_note, receipt_path, reported_at",
    )
    .eq("rental_id", id)
    .order("period", { ascending: false });

  // Reseñas de este alquiler: la propia siempre, la ajena cuando se puede
  // mostrar. De eso se encarga RLS.
  const { data: resenas } = await supabase
    .from("reviews")
    .select("id, text, tags, created_at, published_at, direction, author_id")
    .eq("rental_id", id);

  const { data: invitacion } = await supabase
    .from("invitations")
    .select("id, created_at, expires_at")
    .eq("rental_id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  const estado = ESTADOS_ALQUILER[alquiler.status as EstadoAlquiler];

  // Un renglón por mes del contrato, con su pago si ya existe.
  const porPeriodo = new Map<string, PagoDelPeriodo>(
    (pagos ?? []).map((pago) => [String(pago.period).slice(0, 10), pago as PagoDelPeriodo]),
  );
  const filas: FilaPeriodo[] = periodosDelAlquiler(alquiler).map((periodo) => ({
    periodo,
    vence: vencimientoDe(periodo, alquiler.due_day),
    pago: porPeriodo.get(periodo) ?? null,
  }));
  const hoy = new Date().toISOString().slice(0, 10);

  const miDireccion = direccionDe(soyInquilino);
  const misResenas = (resenas ?? []) as Array<ResenaPropia & { author_id: string }>;
  const miResena = misResenas.find((resena) => resena.author_id === user.id) ?? null;
  const resenaDelOtro = misResenas.find((resena) => resena.author_id !== user.id) ?? null;

  // El catálogo de etiquetas depende de hacia dónde va la reseña.
  const { data: etiquetas } = alquiler.status === "ended" && !miResena
    ? await supabase
        .from("review_tag_defs")
        .select("code, direction, label")
        .eq("direction", miDireccion)
        .eq("active", true)
        .order("orden")
    : { data: [] };

  const nombreContraparte = nombreDeContraparte(
    contraparte,
    soyInquilino ? "tu dueño" : "tu inquilino",
  );

  const sePublicaEl = alquiler.ended_at
    ? fechaDePublicacion(alquiler.ended_at).toISOString().slice(0, 10)
    : hoy;
  const invitacionVencida = invitacion ? new Date(invitacion.expires_at) <= new Date() : false;
  const esCreador = alquiler.created_by === user.id;

  return (
    <div className="flex max-w-[720px] flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 t-titulo">
            {alquiler.neighborhood_label}
          </h1>
          <Pill tone={estado.tono}>{estado.texto}</Pill>
        </div>
        <p className="m-0 text-body">{alquiler.full_address}</p>
        <p className="m-0 text-[15px] text-muted">
          {soyInquilino ? "Alquilás acá" : "Lo tenés en alquiler"}
        </p>
      </header>

      <Card hero >
        <dl className="m-0 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Dato
            etiqueta="Alquiler mensual"
            valor={formatearMonto(alquiler.monthly_amount, alquiler.currency as Moneda)}
          />
          <Dato etiqueta="Vencimiento" valor={textoVencimiento(alquiler.due_day)} />
          <Dato etiqueta="Desde" valor={formatearFecha(alquiler.start_date)} />
          <Dato etiqueta="Hasta" valor={formatearFecha(alquiler.end_date)} />
          <Dato
            etiqueta="Ajuste"
            valor={
              alquiler.adjustment_index
                ? `${alquiler.adjustment_index}, cada ${alquiler.adjustment_every_months} ${
                    alquiler.adjustment_every_months === 1 ? "mes" : "meses"
                  }`
                : "Sin ajuste cargado"
            }
          />
        </dl>
      </Card>

      <section aria-labelledby="titulo-parte" className="flex flex-col gap-3">
        <h2 id="titulo-parte" className="m-0 t-subtitulo">
          {soyInquilino ? "Tu dueño" : "Tu inquilino"}
        </h2>

        <Card className="flex flex-col gap-4">
          {contraparte ? (
            <p className="m-0 text-[17px]">
              <strong>{nombreDeContraparte(contraparte)}</strong>{" "}
              confirmó el alquiler. Desde acá van a ir confirmando los pagos mes a mes.
            </p>
          ) : alquiler.status === "rejected" ? (
            <p className="m-0 text-body">
              La persona que recibió el link dijo que no es {textoRol(rolContraparte)} de esta
              propiedad. Si te equivocaste de contacto, cargá el alquiler de nuevo con los datos
              correctos.
            </p>
          ) : (
            <>
              <p className="m-0 text-body">
                Todavía no confirmó. El alquiler queda pendiente hasta que abra el link y diga que
                sí.
                {invitacion && !invitacionVencida && (
                  <> El link que mandaste vence el {formatearFecha(invitacion.expires_at.slice(0, 10))}.</>
                )}
                {invitacionVencida && <> El último link que mandaste ya venció.</>}
              </p>
              {esCreador && (
                <NuevoLink rentalId={alquiler.id} hayInvitacionViva={Boolean(invitacion)} />
              )}
            </>
          )}
        </Card>
      </section>

      {alquiler.status === "pending_end" && (
        <ConfirmarFin
          rentalId={alquiler.id}
          loPropuseYo={alquiler.end_requested_by === user.id}
          quien={nombreContraparte}
        />
      )}

      {alquiler.status === "ended" && (
        <section aria-labelledby="titulo-resenas" className="flex flex-col gap-3">
          <h2 id="titulo-resenas" className="t-subtitulo m-0">
            Reseñas
          </h2>

          {miResena ? (
            <Card className="flex flex-col gap-2">
              <h3 className="t-subtitulo mt-0 mb-0">Ya dejaste la tuya</h3>
              <p className="m-0 text-body">
                {miResena.published_at
                  ? "Está publicada."
                  : `Se publica cuando ${nombreContraparte} deje la suya, o el ${formatearFecha(sePublicaEl)}. Hasta entonces nadie la ve.`}
              </p>
            </Card>
          ) : (
            <FormularioResena
              rentalId={alquiler.id}
              etiquetas={(etiquetas ?? []) as EtiquetaResena[]}
              quien={nombreContraparte}
              sePublicaEl={sePublicaEl}
            />
          )}

          {resenaDelOtro ? (
            <div>
              <p className="t-etiqueta mb-2 text-muted">Lo que dijo {nombreContraparte}</p>
              <ListaResenas
                resenas={[
                  {
                    texto: resenaDelOtro.text,
                    // En el detalle alcanza con los códigos: el catálogo con
                    // los nombres se muestra en el perfil.
                    etiquetas: [],
                    fecha: resenaDelOtro.published_at ?? resenaDelOtro.created_at,
                    de: soyInquilino ? "Tu dueño" : "Tu inquilino",
                  },
                ]}
              />
            </div>
          ) : (
            <p className="m-0 text-[15px] text-muted">
              {miResena
                ? `Todavía no vemos la de ${nombreContraparte}.`
                : ""}
            </p>
          )}
        </section>
      )}

      {alquiler.status === "active" && (
        <section aria-labelledby="titulo-pagos" className="flex flex-col gap-3">
          <h2 id="titulo-pagos" className="m-0 t-subtitulo">
            Pagos
          </h2>
          <SeccionPagos
            rentalId={alquiler.id}
            soyInquilino={soyInquilino}
            montoSugerido={String(alquiler.monthly_amount)}
            filas={filas}
            hoy={hoy}
            barrio={alquiler.neighborhood_label}
            siteUrl={serverEnv.siteUrl}
          />
        </section>
      )}

      <section aria-labelledby="titulo-documentos" className="flex flex-col gap-3">
        <h2 id="titulo-documentos" className="m-0 t-subtitulo">
          Documentos
        </h2>
        <Card className="flex flex-col gap-4">
          {alquiler.contract_path ? (
            <>
              <p className="m-0 text-body">
                El contrato está adjunto. Se abre con un link que dura un minuto y solo funciona
                para vos y la otra parte.
              </p>
              <BotonContrato rentalId={alquiler.id} />
            </>
          ) : (
            <SubirContrato rentalId={alquiler.id} />
          )}
        </Card>
      </section>

      {esCreador && (alquiler.status === "pending" || alquiler.status === "rejected") && (
        <section className="border-t border-line pt-5">
          <CancelarAlquiler rentalId={alquiler.id} />
        </section>
      )}

      {alquiler.status === "active" && (
        <section className="border-t border-line pt-5">
          <ProponerFin rentalId={alquiler.id} />
        </section>
      )}
    </div>
  );
}
