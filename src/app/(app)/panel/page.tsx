import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Panel · Inkey",
  robots: { index: false, follow: false },
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

export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar?volver_a=/panel");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name, initial_intent")
    .eq("id", user.id)
    .maybeSingle();

  const bloqueInquilino = (
    <section aria-labelledby="titulo-inquilino">
      <h2 id="titulo-inquilino" className="mt-0 mb-3 font-serif text-[26px] font-semibold">
        Donde alquilás
      </h2>
      <EstadoVacio
        titulo="Todavía no registraste tu alquiler"
        texto="Cargá los datos, invitá a tu dueño y desde el primer mes confirmado empezás a construir tu historial."
        accion={{ href: "/alquileres/nuevo?rol=inquilino", texto: "Registrar mi alquiler" }}
      />
    </section>
  );

  const bloquePropietario = (
    <section aria-labelledby="titulo-propietario">
      <h2 id="titulo-propietario" className="mt-0 mb-3 font-serif text-[26px] font-semibold">
        Lo que alquilás
      </h2>
      <EstadoVacio
        titulo="Todavía no cargaste ninguna propiedad"
        texto="Registrá la propiedad, invitá a tu inquilino y confirmá cada pago en dos toques desde el celular."
        accion={{ href: "/alquileres/nuevo?rol=propietario", texto: "Registrar una propiedad" }}
      />
    </section>
  );

  // Primero lo que la persona dijo que venía a hacer.
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
        <Card className="p-6">
          <p className="m-0 text-body">
            Nada pendiente por ahora. Cuando haya un pago para reportar o confirmar, te aparece acá
            arriba de todo.
          </p>
        </Card>
      </section>

      {primeroPropietario ? bloquePropietario : bloqueInquilino}
      {primeroPropietario ? bloqueInquilino : bloquePropietario}
    </div>
  );
}
