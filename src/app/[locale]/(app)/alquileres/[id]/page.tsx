import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, Pill } from "@/components/ui";
import {
  ESTADOS_ALQUILER,
  formatearFecha,
  formatearMonto,
  claveDeRol,
  claveDeVencimiento,
  type EstadoAlquiler,
} from "@/lib/domain/alquiler";
import { nombreDeContraparte } from "@/lib/validation/profile";
import { periodosDelAlquiler, vencimientoDe } from "@/lib/domain/pagos";
import { aniosConResumen } from "@/lib/domain/resumen";
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
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
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
  const idioma = await getLocale();
  const t = await getTranslations();
  const ta = await getTranslations("alquiler");
  const tr = await getTranslations("resumen");
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

  const textosContraparte = {
    siNoHay: t(
      soyInquilino ? "dominio.contraparte.tuDuenoMinuscula" : "dominio.contraparte.tuInquilinoMinuscula",
    ),
    dadoDeBaja: t("dominio.contraparte.dadoDeBaja"),
  };
  const nombreContraparte = nombreDeContraparte(contraparte, textosContraparte);

  const sePublicaEl = alquiler.ended_at
    ? fechaDePublicacion(alquiler.ended_at).toISOString().slice(0, 10)
    : hoy;
  /* Sin alquiler confirmado no hay meses que resumir. */
  const anios =
    alquiler.status === "pending" || alquiler.status === "rejected"
      ? []
      : aniosConResumen(alquiler);

  const invitacionVencida = invitacion ? new Date(invitacion.expires_at) <= new Date() : false;
  const esCreador = alquiler.created_by === user.id;

  return (
    <div className="flex max-w-[720px] flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 t-titulo">
            {alquiler.neighborhood_label}
          </h1>
          <Pill tone={estado.tono}>{t(`dominio.estadoAlquiler.${alquiler.status}`)}</Pill>
        </div>
        <p className="m-0 text-body">{alquiler.full_address}</p>
        <p className="m-0 text-[15px] text-muted">
          {soyInquilino ? ta("alquilasAca") : ta("loTenesEnAlquiler")}
        </p>
      </header>

      <Card hero >
        <dl className="m-0 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Dato
            etiqueta={ta("alquilerMensual")}
            valor={formatearMonto(alquiler.monthly_amount, alquiler.currency as Moneda)}
          />
          <Dato etiqueta={ta("vencimiento")} valor={t(claveDeVencimiento(alquiler.due_day), { dia: alquiler.due_day })} />
          <Dato etiqueta={ta("desde")} valor={formatearFecha(alquiler.start_date, idioma)} />
          <Dato etiqueta={ta("hasta")} valor={formatearFecha(alquiler.end_date, idioma)} />
          <Dato
            etiqueta={ta("ajuste")}
            valor={
              alquiler.adjustment_index
                ? ta("ajusteCada", {
                    indice: alquiler.adjustment_index,
                    meses: alquiler.adjustment_every_months ?? 0,
                  })
                : ta("sinAjuste")
            }
          />
        </dl>
      </Card>

      <section aria-labelledby="titulo-parte" className="flex flex-col gap-3">
        <h2 id="titulo-parte" className="m-0 t-subtitulo">
          {soyInquilino ? ta("tuDueno") : ta("tuInquilino")}
        </h2>

        <Card className="flex flex-col gap-4">
          {contraparte ? (
            /*
              Un contrato terminado ya no confirma nada más: hablar en futuro
              ahí no tiene sentido. Cuando cerró, lo que corresponde es contar
              cuánto duró.
            */
            alquiler.status === "ended" ? (
              <p className="m-0 text-[17px]">
                {ta.rich("compartieron", {
                  desde: formatearFecha(alquiler.start_date, idioma),
                  // La fecha en que cerró de verdad, que puede no ser la pactada.
                  hasta: formatearFecha(
                    alquiler.ended_at ? String(alquiler.ended_at).slice(0, 10) : alquiler.end_date,
                    idioma,
                  ),
                  fuerte: (partes) => <strong>{partes}</strong>,
                })}
              </p>
            ) : (
              <p className="m-0 text-[17px]">
                {ta.rich("confirmoElAlquiler", {
                  quien: nombreContraparte,
                  fuerte: (partes) => <strong>{partes}</strong>,
                })}
              </p>
            )
          ) : alquiler.status === "rejected" ? (
            <p className="m-0 text-body">
              {ta("rechazado", { rol: t(claveDeRol(rolContraparte)) })}
            </p>
          ) : (
            <>
              <p className="m-0 text-body">
                {ta("todaviaNoConfirmo")}
                {invitacion && !invitacionVencida &&
                  ta("linkVence", { fecha: formatearFecha(invitacion.expires_at.slice(0, 10), idioma) })}
                {invitacionVencida && ta("linkVencido")}
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
            {ta("resenas")}
          </h2>

          {miResena ? (
            <Card className="flex flex-col gap-2">
              <h3 className="t-subtitulo mt-0 mb-0">{ta("yaDejasteLaTuya")}</h3>
              <p className="m-0 text-body">
                {miResena.published_at
                  ? ta("estaPublicada")
                  : ta("sePublicaCuando", {
                      quien: nombreContraparte,
                      fecha: formatearFecha(sePublicaEl, idioma),
                    })}
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
              <p className="t-etiqueta mb-2 text-muted">{ta("loQueDijo", { quien: nombreContraparte })}</p>
              <ListaResenas
                resenas={[
                  {
                    texto: resenaDelOtro.text,
                    // En el detalle alcanza con los códigos: el catálogo con
                    // los nombres se muestra en el perfil.
                    etiquetas: [],
                    fecha: resenaDelOtro.published_at ?? resenaDelOtro.created_at,
                    de: soyInquilino ? ta("tuDueno") : ta("tuInquilino"),
                  },
                ]}
              />
            </div>
          ) : (
            <p className="m-0 text-[15px] text-muted">
              {miResena ? ta("todaviaNoVemos", { quien: nombreContraparte }) : ""}
            </p>
          )}
        </section>
      )}

      {alquiler.status === "active" && (
        <section aria-labelledby="titulo-pagos" className="flex flex-col gap-3">
          <h2 id="titulo-pagos" className="m-0 t-subtitulo">
            {ta("pagos")}
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

      {/*
        El resumen anual. Lo ven las dos partes por igual: el año del alquiler
        es tan del inquilino como del dueño.
      */}
      {anios.length > 0 && (
        <section aria-labelledby="titulo-resumen" className="flex flex-col gap-3">
          <h2 id="titulo-resumen" className="m-0 t-subtitulo">
            {tr("enlace")}
          </h2>
          <Card className="flex flex-col gap-4">
            <p className="m-0 text-body">{tr("enlaceDetalle")}</p>
            <div className="flex flex-wrap gap-2">
              {anios.map((anio) => (
                <Link
                  key={anio}
                  href={`/alquileres/${alquiler.id}/resumen/${anio}`}
                  className="rounded-chip bg-surface-sunk px-4 py-2 text-[15px] font-medium text-ink no-underline hover:brightness-[0.97]"
                >
                  {anio}
                </Link>
              ))}
            </div>
          </Card>
        </section>
      )}

      <section aria-labelledby="titulo-documentos" className="flex flex-col gap-3">
        <h2 id="titulo-documentos" className="m-0 t-subtitulo">
          {t("contrato.documentos")}
        </h2>
        <Card className="flex flex-col gap-4">
          {alquiler.contract_path ? (
            <>
              <p className="m-0 text-body">
                {t("contrato.adjunto")}
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
