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
import { nombrePublico } from "@/lib/validation/profile";
import { periodosDelAlquiler, vencimientoDe } from "@/lib/domain/pagos";
import { SeccionPagos, type FilaPeriodo, type PagoDelPeriodo } from "@/components/pago/seccion-pagos";
import type { Moneda } from "@/lib/validation/rental";
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
        .select("first_name, last_name")
        .eq("id", idContraparte)
        .maybeSingle()
    : { data: null };

  const { data: pagos } = await supabase
    .from("payments")
    .select(
      "id, period, status, amount, currency, paid_on, due_date, on_time, owner_note, receipt_path",
    )
    .eq("rental_id", id)
    .order("period", { ascending: false });

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
              <strong>{nombrePublico(contraparte.first_name ?? "", contraparte.last_name ?? "")}</strong>{" "}
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
        <section className="border-t-[1.5px] border-dashed border-line pt-5">
          <CancelarAlquiler rentalId={alquiler.id} />
        </section>
      )}
    </div>
  );
}
