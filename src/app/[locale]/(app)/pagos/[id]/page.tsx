import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, Card, Pill } from "@/components/ui";
import { BotonComprobante } from "@/components/pago/boton-comprobante";
import { BotonesDueño } from "@/components/pago/botones-dueno";
import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { ESTADOS_PAGO, nombrePeriodo, type EstadoPago } from "@/lib/domain/pagos";
import { nombreDeContraparte } from "@/lib/validation/profile";
import type { Moneda } from "@/lib/validation/rental";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pago · Inkey",
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

export default async function PagoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const idioma = await getLocale();
  const t = await getTranslations();
  const tp = await getTranslations("pagoDetalle");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/ingresar?volver_a=/pagos/${id}`);

  // RLS: si no sos parte del alquiler, este pago no existe para vos.
  const { data: pago } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (!pago) notFound();

  const { data: alquiler } = await supabase
    .from("rentals")
    .select("id, tenant_id, owner_id, neighborhood_label, currency")
    .eq("id", pago.rental_id)
    .maybeSingle();
  if (!alquiler) notFound();

  const soyDueño = alquiler.owner_id === user.id;
  const idContraparte = soyDueño ? alquiler.tenant_id : alquiler.owner_id;

  const { data: contraparte } = idContraparte
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, deleted_at")
        .eq("id", idContraparte)
        .maybeSingle()
    : { data: null };

  const estado = ESTADOS_PAGO[pago.status as EstadoPago];
  const nombreContraparte = nombreDeContraparte(
    contraparte,
    soyDueño ? "tu inquilino" : "tu dueño",
  );

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <div>
        <Link
          href={`/alquileres/${alquiler.id}`}
          className="text-[15px] font-medium text-confirm-ink no-underline"
        >
          ← {alquiler.neighborhood_label}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="m-0 t-titulo capitalize">
            {nombrePeriodo(String(pago.period).slice(0, 10))}
          </h1>
          <Pill tone={estado.tono}>{t(`dominio.estadoPago.${pago.status}`)}</Pill>
        </div>
      </div>

      <Card hero >
        <dl className="m-0 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Dato
            etiqueta={tp("monto")}
            valor={formatearMonto(pago.amount, pago.currency as Moneda)}
          />
          <Dato etiqueta={tp("fechaDePago")} valor={formatearFecha(String(pago.paid_on).slice(0, 10))} />
          {/*
            Las dos fechas alcanzan: quien mira saca su propia conclusión. Una
            etiqueta que diga "después del vencimiento" es un reproche, y acá
            no marcamos a nadie en falta.
          */}
          <Dato etiqueta={tp("venciaEl")} valor={formatearFecha(String(pago.due_date).slice(0, 10))} />
        </dl>

        {pago.receipt_path && (
          <div className="mt-5 border-t-[1.5px] border-dashed border-line pt-5">
            <BotonComprobante pagoId={pago.id} />
          </div>
        )}
      </Card>

      {pago.status === "reported" && soyDueño && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="mt-0 mb-1 t-subtitulo">
              {tp("teLlego")}
            </h2>
            <p className="m-0 text-body">
              {tp("reporto", {
                quien: nombreContraparte,
                monto: formatearMonto(pago.amount, pago.currency as Moneda),
                fecha: formatearFecha(String(pago.paid_on).slice(0, 10)),
              })}
            </p>
          </div>
          <BotonesDueño pagoId={pago.id} />
        </Card>
      )}

      {pago.status === "reported" && !soyDueño && (
        <Card >
          <p className="m-0 text-body">
            {tp("esperando", { quien: nombreContraparte })}
          </p>
        </Card>
      )}

      {pago.status === "not_received" && (
        <Card className="flex flex-col gap-3">
          <h2 className="mt-0 mb-0 t-subtitulo">
            {soyDueño ? tp("dijisteQueNo") : tp("tuDuenoNoRecibio")}
          </h2>
          {pago.owner_note && (
            <p className="m-0 text-body">
              <q className="quote">{pago.owner_note}</q>
            </p>
          )}
          <p className="m-0 text-[15px] text-muted">
            {tp("quedaEntreUstedes")}{" "}
            {soyDueño ? tp("siAparece") : tp("siYaPagaste")}
          </p>
          {!soyDueño && (
            <div>
              <ButtonLink href={`/alquileres/${alquiler.id}`} variant="secondary" size="md">
                {tp("volverAReportarlo")}
              </ButtonLink>
            </div>
          )}
        </Card>
      )}

      {pago.status === "confirmed" && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="mt-0 mb-1 t-subtitulo">{tp("mesConfirmado")}</h2>
            <p className="m-0 text-body">
              {soyDueño
                ? tp("confirmaste", {
                    fecha: formatearFecha(String(pago.confirmed_at).slice(0, 10)),
                  })
                : tp("confirmoElOtro", {
                    quien: nombreContraparte,
                    fecha: formatearFecha(String(pago.confirmed_at).slice(0, 10)),
                  })}{" "}
              {tp("losDosTienenRecibo")}
            </p>
          </div>
          <div>
            <ButtonLink href={`/pagos/${pago.id}/recibo`} target="_blank" size="md">
              {tp("descargarRecibo")}
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
