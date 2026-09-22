import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { BorrarCuenta, MisDatos } from "./piezas";

export const metadata: Metadata = {
  title: "Mi cuenta · Inkey",
  robots: { index: false, follow: false },
};

function Seccion({
  titulo,
  bajada,
  sinTarjeta = false,
  children,
}: {
  titulo: string;
  bajada?: string;
  /** Para lo que no es un bloque de datos, como la baja de cuenta. */
  sinTarjeta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 t-subtitulo">{titulo}</h2>
        {bajada && <p className="mt-1.5 mb-0 text-body">{bajada}</p>}
      </div>
      {sinTarjeta ? (
        <div className="flex flex-col gap-4">{children}</div>
      ) : (
        <Card className="flex flex-col gap-4">{children}</Card>
      )}
    </section>
  );
}

export default async function CuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar?volver_a=/cuenta");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex max-w-[720px] flex-col gap-9">
      <header>
        <h1 className="mt-0 mb-2 t-titulo">Mi cuenta</h1>
        <p className="m-0 text-body">Tus datos, tu privacidad y qué hacemos con tu información.</p>
      </header>

      <Seccion titulo="Tus datos">
        <MisDatos
          nombre={perfil?.first_name ?? ""}
          apellido={perfil?.last_name ?? ""}
          celular={perfil?.phone ?? ""}
        />
        <p className="m-0 border-t-[1.5px] border-dashed border-line pt-4 text-[15px] text-muted">
          Entrás con <strong className="font-medium text-ink">{user.email}</strong>. Si querés
          cambiar de mail, escribinos y lo hacemos.
        </p>
      </Seccion>

      <Seccion
        titulo="Descargar mis datos"
        bajada="Todo lo que guardamos de vos, en un archivo. Es tuyo y te lo llevás cuando quieras."
      >
        <div className="flex flex-wrap gap-3">
          <a
            href="/cuenta/exportar?formato=json"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-surface-sunk px-6 text-[17px] font-medium text-ink no-underline hover:brightness-[0.97]"
          >
            Descargar en JSON
          </a>
          <a
            href="/cuenta/exportar?formato=csv"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-surface-sunk px-6 text-[17px] font-medium text-ink no-underline hover:brightness-[0.97]"
          >
            Descargar en CSV
          </a>
        </div>
        <p className="m-0 text-[15px] text-muted">
          El JSON es la copia completa. El CSV se abre en una planilla. Ninguno de los dos incluye
          datos personales de la otra parte: esos no son tuyos.
        </p>
      </Seccion>

      <Seccion
        titulo="Privacidad"
        bajada="Qué hacemos y qué no hacemos con lo que nos contás."
      >
        <ul className="m-0 flex list-none flex-col gap-3 p-0 text-body">
          <li>
            <strong className="font-medium text-ink">Nada es público por defecto.</strong> Tu
            historial solo se ve si vos creás un link, y lo podés revocar cuando quieras.
          </li>
          <li>
            <strong className="font-medium text-ink">No consultamos bancos ni Veraz.</strong> No
            hacemos scoring crediticio de ningún tipo.
          </li>
          <li>
            <strong className="font-medium text-ink">Solo se muestra lo confirmado.</strong> Un mes
            sin confirmar no suma y no aparece en ningún lado. No existen listas de morosos.
          </li>
          <li>
            <strong className="font-medium text-ink">Tus comprobantes son privados.</strong> Los ven
            solo vos y la otra parte de ese alquiler, con links que vencen en un minuto.
          </li>
        </ul>
        <p className="m-0 border-t-[1.5px] border-dashed border-line pt-4 text-[15px] text-muted">
          <Link href="/privacidad" className="font-medium text-confirm-ink">
            Política de privacidad
          </Link>{" "}
          ·{" "}
          <Link href="/terminos" className="font-medium text-confirm-ink">
            Términos y condiciones
          </Link>
        </p>
      </Seccion>

      <Seccion
        titulo="Dar de baja mi cuenta"
        bajada="Se borran tus datos personales. El historial confirmado sigue existiendo para la otra parte, porque también es suyo."
        sinTarjeta
      >
        <BorrarCuenta />
      </Seccion>
    </div>
  );
}
