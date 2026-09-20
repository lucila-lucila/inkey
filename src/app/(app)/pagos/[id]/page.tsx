import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, Card, Pill } from "@/components/ui";
import { BotonComprobante } from "@/components/pago/boton-comprobante";
import { BotonesDueño } from "@/components/pago/botones-dueno";
import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { ESTADOS_PAGO, nombrePeriodo, type EstadoPago } from "@/lib/domain/pagos";
import { nombrePublico } from "@/lib/validation/profile";
import type { Moneda } from "@/lib/validation/rental";
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
        .select("first_name, last_name")
        .eq("id", idContraparte)
        .maybeSingle()
    : { data: null };

  const estado = ESTADOS_PAGO[pago.status as EstadoPago];
  const nombreContraparte = contraparte
    ? nombrePublico(contraparte.first_name ?? "", contraparte.last_name ?? "")
    : soyDueño
      ? "tu inquilino"
      : "tu dueño";

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
          <Pill tone={estado.tono}>{estado.texto}</Pill>
        </div>
      </div>

      <Card hero >
        <dl className="m-0 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Dato
            etiqueta="Monto"
            valor={formatearMonto(pago.amount, pago.currency as Moneda)}
          />
          <Dato etiqueta="Fecha de pago" valor={formatearFecha(String(pago.paid_on).slice(0, 10))} />
          <Dato etiqueta="Vencía el" valor={formatearFecha(String(pago.due_date).slice(0, 10))} />
          <Dato
            etiqueta="Puntualidad"
            valor={
              pago.on_time ? (
                <span className="text-confirm-ink">En fecha</span>
              ) : (
                <span className="text-muted">Después del vencimiento</span>
              )
            }
          />
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
              ¿Te llegó este pago?
            </h2>
            <p className="m-0 text-body">
              {nombreContraparte} reportó que pagó{" "}
              {formatearMonto(pago.amount, pago.currency as Moneda)} el{" "}
              {formatearFecha(String(pago.paid_on).slice(0, 10))}.
            </p>
          </div>
          <BotonesDueño pagoId={pago.id} />
        </Card>
      )}

      {pago.status === "reported" && !soyDueño && (
        <Card >
          <p className="m-0 text-body">
            Esperando que {nombreContraparte} lo confirme. Cuando lo haga, los dos van a tener el
            recibo y este mes suma a tu historial.
          </p>
        </Card>
      )}

      {pago.status === "not_received" && (
        <Card className="flex flex-col gap-3">
          <h2 className="mt-0 mb-0 t-subtitulo">
            {soyDueño ? "Dijiste que todavía no te llegó" : "Tu dueño todavía no lo recibió"}
          </h2>
          {pago.owner_note && (
            <p className="m-0 text-body">
              <q className="quote">{pago.owner_note}</q>
            </p>
          )}
          <p className="m-0 text-[15px] text-muted">
            Esto queda entre ustedes: no aparece en ningún perfil público ni cuenta como algo
            negativo.{" "}
            {soyDueño
              ? "Si aparece, tu inquilino puede volver a reportarlo y vos confirmarlo."
              : "Si ya lo pagaste, volvé a reportarlo desde el alquiler con el comprobante."}
          </p>
          {!soyDueño && (
            <div>
              <ButtonLink href={`/alquileres/${alquiler.id}`} variant="secondary" size="md">
                Volver a reportarlo
              </ButtonLink>
            </div>
          )}
        </Card>
      )}

      {pago.status === "confirmed" && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="mt-0 mb-1 t-subtitulo">Mes confirmado</h2>
            <p className="m-0 text-body">
              {soyDueño ? "Confirmaste" : `${nombreContraparte} confirmó`} este pago el{" "}
              {formatearFecha(String(pago.confirmed_at).slice(0, 10))}. Los dos tienen el recibo.
            </p>
          </div>
          <div>
            <ButtonLink href={`/pagos/${pago.id}/recibo`} target="_blank" size="md">
              Descargar el recibo
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
