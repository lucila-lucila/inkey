import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, Card, Pill } from "@/components/ui";
import {
  ESTADOS_ALQUILER,
  formatearMonto,
  type EstadoAlquiler,
} from "@/lib/domain/alquiler";
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
    <Card className="flex flex-col items-start gap-4 p-6">
      <div>
        <h3 className="mt-0 mb-1.5 font-serif text-[22px] font-semibold">{titulo}</h3>
        <p className="m-0 max-w-[46ch] text-body">{texto}</p>
      </div>
      <ButtonLink href={accion.href}>{accion.texto}</ButtonLink>
    </Card>
  );
}

function TarjetaAlquiler({ alquiler }: { alquiler: Alquiler }) {
  const estado = ESTADOS_ALQUILER[alquiler.status as EstadoAlquiler];

  return (
    <Card className="p-0">
      <Link
        href={`/alquileres/${alquiler.id}`}
        className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 p-5 text-ink no-underline"
      >
        <div>
          <p className="m-0 text-[19px] font-semibold">{alquiler.neighborhood_label}</p>
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
      .select("id, tenant_id, owner_id, created_by, neighborhood_label, monthly_amount, currency, status")
      .order("created_at", { ascending: false }),
  ]);

  const todos = (alquileres ?? []) as Alquiler[];
  const comoInquilino = todos.filter((a) => a.tenant_id === user.id);
  const comoPropietario = todos.filter((a) => a.owner_id === user.id);

  // Lo primero: lo que está esperando algo de la otra parte.
  const esperandoConfirmacion = todos.filter(
    (a) => a.status === "pending" && a.created_by === user.id,
  );
  const rechazados = todos.filter((a) => a.status === "rejected");

  const bloqueInquilino = (
    <section aria-labelledby="titulo-inquilino">
      <h2 id="titulo-inquilino" className="mt-0 mb-3 font-serif text-[26px] font-semibold">
        Donde alquilás
      </h2>
      {comoInquilino.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comoInquilino.map((alquiler) => (
            <TarjetaAlquiler key={alquiler.id} alquiler={alquiler} />
          ))}
          <div>
            <ButtonLink href="/alquileres/nuevo?rol=inquilino" variant="outline" size="md">
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
      <h2 id="titulo-propietario" className="mt-0 mb-3 font-serif text-[26px] font-semibold">
        Lo que alquilás
      </h2>
      {comoPropietario.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comoPropietario.map((alquiler) => (
            <TarjetaAlquiler key={alquiler.id} alquiler={alquiler} />
          ))}
          <div>
            <ButtonLink href="/alquileres/nuevo?rol=propietario" variant="outline" size="md">
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
        <h1 className="mt-0 mb-1 font-serif text-[clamp(30px,5vw,40px)] leading-[1.1] font-semibold">
          Hola{perfil?.first_name ? `, ${perfil.first_name}` : ""}
        </h1>
        <p className="m-0 text-body">Acá vas a ver lo que necesita tu atención primero.</p>
      </div>

      <section aria-labelledby="titulo-pendientes">
        <h2 id="titulo-pendientes" className="mt-0 mb-3 font-serif text-[26px] font-semibold">
          Tareas pendientes
        </h2>
        {esperandoConfirmacion.length === 0 && rechazados.length === 0 ? (
          <Card className="p-6">
            <p className="m-0 text-body">
              Nada pendiente por ahora. Cuando haya un pago para reportar o confirmar, te aparece acá
              arriba de todo.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {esperandoConfirmacion.map((alquiler) => (
              <Card key={alquiler.id} hero className="flex flex-col items-start gap-3 p-5">
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
              <Card key={alquiler.id} className="flex flex-col items-start gap-3 p-5">
                <p className="m-0 text-[17px]">
                  En <strong>{alquiler.neighborhood_label}</strong> te dijeron que esa propiedad no
                  es suya. Revisá a quién le mandaste el link.
                </p>
                <ButtonLink href={`/alquileres/${alquiler.id}`} variant="outline" size="md">
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
