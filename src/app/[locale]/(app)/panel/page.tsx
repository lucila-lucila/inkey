import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, Card, Pill } from "@/components/ui";
import {
  ESTADOS_ALQUILER,
  formatearMonto,
  type EstadoAlquiler,
} from "@/lib/domain/alquiler";
import { nombrePeriodo, periodoActual } from "@/lib/domain/pagos";
import type { Moneda } from "@/lib/validation/rental";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Panel · Inkey",
  robots: { index: false, follow: false },
};

type Alquiler = {
  id: string;
  tenant_id: string | null;
  owner_id: string | null;
  created_by: string;
  neighborhood_label: string;
  monthly_amount: string;
  currency: string;
  status: string;
  start_date: string;
  end_requested_by: string | null;
  ended_at: string | null;
};

type Pago = {
  id: string;
  rental_id: string;
  period: string;
  status: string;
};

function EstadoVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion: { href: string; texto: string };
}) {
  return (
    <Card className="flex flex-col items-start gap-4">
      <div>
        <h3 className="mt-0 mb-1.5 t-subtitulo">{titulo}</h3>
        <p className="m-0 max-w-[46ch] text-body">{texto}</p>
      </div>
      <ButtonLink href={accion.href}>{accion.texto}</ButtonLink>
    </Card>
  );
}

function TarjetaAlquiler({ alquiler }: { alquiler: Alquiler }) {
  const estado = ESTADOS_ALQUILER[alquiler.status as EstadoAlquiler];

  return (
    <Card >
      <Link
        href={`/alquileres/${alquiler.id}`}
        className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 p-5 text-ink no-underline"
      >
        <div>
          <p className="m-0 text-[19px] font-medium">{alquiler.neighborhood_label}</p>
          <p className="m-0 text-[15px] text-muted">
            {formatearMonto(alquiler.monthly_amount, alquiler.currency as Moneda)} por mes
          </p>
        </div>
        <Pill tone={estado.tono}>{estado.texto}</Pill>
      </Link>
    </Card>
  );
}

export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar?volver_a=/panel");

  const [{ data: perfil }, { data: alquileres }] = await Promise.all([
    supabase.from("profiles").select("first_name, initial_intent").eq("id", user.id).maybeSingle(),
    supabase
      .from("rentals")
      .select(
        "id, tenant_id, owner_id, created_by, neighborhood_label, monthly_amount, currency, status, start_date, end_requested_by, ended_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const todos = (alquileres ?? []) as Alquiler[];

  // Los pagos de todos mis alquileres, para armar las tareas pendientes.
  const { data: pagosCrudos } = todos.length
    ? await supabase
        .from("payments")
        .select("id, rental_id, period, status")
        .in(
          "rental_id",
          todos.map((alquiler) => alquiler.id),
        )
    : { data: [] };

  const pagos = ((pagosCrudos ?? []) as Pago[]).map((pago) => ({
    ...pago,
    period: String(pago.period).slice(0, 10),
  }));
  const mesActual = periodoActual();
  const nombreDelAlquiler = new Map(todos.map((alquiler) => [alquiler.id, alquiler.neighborhood_label]));

  // Lo que espera algo del dueño: confirmar un pago que le reportaron.
  const porConfirmar = pagos.filter((pago) => {
    const alquiler = todos.find((fila) => fila.id === pago.rental_id);
    return pago.status === "reported" && alquiler?.owner_id === user.id;
  });

  // Lo que espera algo del inquilino: reportar el mes en curso, o volver a
  // reportar lo que el dueño no recibió.
  const porReportar = todos.filter(
    (alquiler) =>
      alquiler.status === "active" &&
      alquiler.tenant_id === user.id &&
      alquiler.start_date.slice(0, 7) <= mesActual.slice(0, 7) &&
      !pagos.some((pago) => pago.rental_id === alquiler.id && pago.period === mesActual),
  );

  // Fin de contrato: lo que espera que yo confirme.
  const finPorConfirmar = todos.filter(
    (alquiler) => alquiler.status === "pending_end" && alquiler.end_requested_by !== user.id,
  );

  // Y los alquileres terminados donde todavía no dejé mi reseña.
  const terminados = todos.filter((alquiler) => alquiler.status === "ended");
  const { data: misResenas } = terminados.length
    ? await supabase
        .from("reviews")
        .select("rental_id, author_id")
        .in(
          "rental_id",
          terminados.map((alquiler) => alquiler.id),
        )
        .eq("author_id", user.id)
    : { data: [] };

  const resenaPendiente = terminados.filter(
    (alquiler) =>
      !(misResenas ?? []).some(
        (resena) => (resena as { rental_id: string }).rental_id === alquiler.id,
      ),
  );

  const rebotados = pagos.filter((pago) => {
    const alquiler = todos.find((fila) => fila.id === pago.rental_id);
    return pago.status === "not_received" && alquiler?.tenant_id === user.id;
  });
  const comoInquilino = todos.filter((a) => a.tenant_id === user.id);
  const comoPropietario = todos.filter((a) => a.owner_id === user.id);

  // Lo primero: lo que está esperando algo de la otra parte.
  const esperandoConfirmacion = todos.filter(
    (a) => a.status === "pending" && a.created_by === user.id,
  );
  const rechazados = todos.filter((a) => a.status === "rejected");

  const bloqueInquilino = (
    <section aria-labelledby="titulo-inquilino">
      <h2 id="titulo-inquilino" className="mt-0 mb-3 t-subtitulo">
        Donde alquilás
      </h2>
      {comoInquilino.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comoInquilino.map((alquiler) => (
            <TarjetaAlquiler key={alquiler.id} alquiler={alquiler} />
          ))}
          <div>
            <ButtonLink href="/alquileres/nuevo?rol=inquilino" variant="secondary" size="md">
              Registrar otro alquiler
            </ButtonLink>
          </div>
        </div>
      ) : (
        <EstadoVacio
          titulo="Todavía no registraste tu alquiler"
          texto="Cargá los datos, invitá a tu dueño y desde el primer mes confirmado empezás a construir tu historial."
          accion={{ href: "/alquileres/nuevo?rol=inquilino", texto: "Registrar mi alquiler" }}
        />
      )}
    </section>
  );

  const bloquePropietario = (
    <section aria-labelledby="titulo-propietario">
      <h2 id="titulo-propietario" className="mt-0 mb-3 t-subtitulo">
        Lo que alquilás
      </h2>
      {comoPropietario.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comoPropietario.map((alquiler) => (
            <TarjetaAlquiler key={alquiler.id} alquiler={alquiler} />
          ))}
          <div>
            <ButtonLink href="/alquileres/nuevo?rol=propietario" variant="secondary" size="md">
              Registrar otra propiedad
            </ButtonLink>
          </div>
        </div>
      ) : (
        <EstadoVacio
          titulo="Todavía no cargaste ninguna propiedad"
          texto="Registrá la propiedad, invitá a tu inquilino y confirmá cada pago en dos toques desde el celular."
          accion={{ href: "/alquileres/nuevo?rol=propietario", texto: "Registrar una propiedad" }}
        />
      )}
    </section>
  );

  const primeroPropietario = perfil?.initial_intent === "propietario";

  return (
    <div className="flex flex-col gap-9">
      <div>
        <h1 className="mt-0 mb-1 t-titulo">
          Hola{perfil?.first_name ? `, ${perfil.first_name}` : ""}
        </h1>
        <p className="m-0 text-body">Acá vas a ver lo que necesita tu atención primero.</p>
      </div>

      <section aria-labelledby="titulo-pendientes">
        <h2 id="titulo-pendientes" className="mt-0 mb-3 t-subtitulo">
          Tareas pendientes
        </h2>
        {esperandoConfirmacion.length === 0 &&
        rechazados.length === 0 &&
        porConfirmar.length === 0 &&
        porReportar.length === 0 &&
        rebotados.length === 0 &&
        finPorConfirmar.length === 0 &&
        resenaPendiente.length === 0 ? (
          <Card >
            <p className="m-0 text-body">
              Nada pendiente por ahora. Cuando haya un pago para reportar o confirmar, te aparece acá
              arriba de todo.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Primero lo que traba a otra persona: confirmar un pago. */}
            {porConfirmar.map((pago) => (
              <Card key={pago.id} hero className="flex flex-col items-start gap-3">
                <p className="m-0 text-[17px]">
                  Confirmá el pago de <strong className="capitalize">{nombrePeriodo(pago.period)}</strong> en{" "}
                  <strong>{nombreDelAlquiler.get(pago.rental_id)}</strong>.
                </p>
                <ButtonLink href={`/pagos/${pago.id}`} size="md">
                  Ver y confirmar
                </ButtonLink>
              </Card>
            ))}

            {porReportar.map((alquiler) => (
              <Card key={`reportar-${alquiler.id}`} hero className="flex flex-col items-start gap-3">
                <p className="m-0 text-[17px]">
                  ¿Ya pagaste <strong className="capitalize">{nombrePeriodo(mesActual)}</strong> en{" "}
                  <strong>{alquiler.neighborhood_label}</strong>? Reportalo para que tu dueño lo
                  confirme.
                </p>
                <ButtonLink href={`/alquileres/${alquiler.id}`} size="md">
                  Reportar el pago
                </ButtonLink>
              </Card>
            ))}

            {rebotados.map((pago) => (
              <Card key={`rebotado-${pago.id}`} className="flex flex-col items-start gap-3">
                <p className="m-0 text-[17px]">
                  Tu dueño todavía no recibió el pago de{" "}
                  <strong className="capitalize">{nombrePeriodo(pago.period)}</strong> en{" "}
                  <strong>{nombreDelAlquiler.get(pago.rental_id)}</strong>.
                </p>
                <ButtonLink href={`/pagos/${pago.id}`} variant="secondary" size="md">
                  Ver qué pasó
                </ButtonLink>
              </Card>
            ))}

            {finPorConfirmar.map((alquiler) => (
              <Card key={`fin-${alquiler.id}`} hero className="flex flex-col items-start gap-3 p-5">
                <p className="m-0 text-[17px]">
                  Te marcaron que terminó el contrato en{" "}
                  <strong>{alquiler.neighborhood_label}</strong>. Confirmalo si es así.
                </p>
                <ButtonLink href={`/alquileres/${alquiler.id}`} size="md">
                  Ver y confirmar
                </ButtonLink>
              </Card>
            ))}

            {resenaPendiente.map((alquiler) => (
              <Card key={`resena-${alquiler.id}`} className="flex flex-col items-start gap-3 p-5">
                <p className="m-0 text-[17px]">
                  Terminó tu alquiler en <strong>{alquiler.neighborhood_label}</strong>. Contá cómo
                  fue: la otra parte no ve tu reseña hasta que deje la suya.
                </p>
                <ButtonLink href={`/alquileres/${alquiler.id}`} variant="secondary" size="md">
                  Dejar mi reseña
                </ButtonLink>
              </Card>
            ))}

            {esperandoConfirmacion.map((alquiler) => (
              <Card key={alquiler.id} hero className="flex flex-col items-start gap-3">
                <p className="m-0 text-[17px]">
                  <strong>{alquiler.neighborhood_label}</strong> está esperando que{" "}
                  {alquiler.tenant_id === user.id ? "tu dueño" : "tu inquilino"} confirme.
                </p>
                <ButtonLink href={`/alquileres/${alquiler.id}`} size="md">
                  Reenviar el link
                </ButtonLink>
              </Card>
            ))}
            {rechazados.map((alquiler) => (
              <Card key={alquiler.id} className="flex flex-col items-start gap-3">
                <p className="m-0 text-[17px]">
                  En <strong>{alquiler.neighborhood_label}</strong> te dijeron que esa propiedad no
                  es suya. Revisá a quién le mandaste el link.
                </p>
                <ButtonLink href={`/alquileres/${alquiler.id}`} variant="secondary" size="md">
                  Ver el alquiler
                </ButtonLink>
              </Card>
            ))}
          </div>
        )}
      </section>

      {primeroPropietario ? bloquePropietario : bloqueInquilino}
      {primeroPropietario ? bloqueInquilino : bloquePropietario}
    </div>
  );
}
