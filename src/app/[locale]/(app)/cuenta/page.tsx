import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { prefijoDe } from "@/i18n/idioma";
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
  const idioma = await getLocale();
  const t = await getTranslations();
  const tc = await getTranslations("cuentaPagina");
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
        <h1 className="mt-0 mb-2 t-titulo">{tc("titulo")}</h1>
        <p className="m-0 text-body">{tc("bajada")}</p>
      </header>

      <Seccion titulo={tc("tusDatos")}>
        <MisDatos
          nombre={perfil?.first_name ?? ""}
          apellido={perfil?.last_name ?? ""}
          celular={perfil?.phone ?? ""}
        />
        <p className="m-0 border-t-[1.5px] border-dashed border-line pt-4 text-[15px] text-muted">
          {tc.rich("entrasCon", {
            mail: user.email ?? "",
            fuerte: (partes: React.ReactNode) => (
              <strong className="font-medium text-ink">{partes}</strong>
            ),
          })}
        </p>
      </Seccion>

      <Seccion
        titulo={tc("descargar")}
        bajada={tc("descargarBajada")}
      >
        <div className="flex flex-wrap gap-3">
          {/*
            Un `<a>` de verdad y no un `Link`: esto no navega a una pantalla,
            descarga un archivo. Lleva el idioma en la URL para que el archivo
            salga con los encabezados en el idioma de quien lo pide.
          */}
          <a
            href={`${prefijoDe(idioma)}/cuenta/exportar?formato=json`}
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-surface-sunk px-6 text-[17px] font-medium text-ink no-underline hover:brightness-[0.97]"
          >
            {tc("enJson")}
          </a>
          <a
            href={`${prefijoDe(idioma)}/cuenta/exportar?formato=csv`}
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-surface-sunk px-6 text-[17px] font-medium text-ink no-underline hover:brightness-[0.97]"
          >
            {tc("enCsv")}
          </a>
        </div>
        <p className="m-0 text-[15px] text-muted">
          {tc("notaFormatos")}
        </p>
      </Seccion>

      <Seccion
        titulo={tc("privacidad")}
        bajada={tc("privacidadBajada")}
      >
        <ul className="m-0 flex list-none flex-col gap-3 p-0 text-body">
          <li>
            <strong className="font-medium text-ink">{tc("priv1Titulo")}</strong> {tc("priv1")}
          </li>
          <li>
            <strong className="font-medium text-ink">{tc("priv2Titulo")}</strong> {tc("priv2")}
          </li>
          <li>
            <strong className="font-medium text-ink">{tc("priv3Titulo")}</strong> {tc("priv3")}
          </li>
          <li>
            <strong className="font-medium text-ink">{tc("priv4Titulo")}</strong> {tc("priv4")}
          </li>
        </ul>
        <p className="m-0 border-t-[1.5px] border-dashed border-line pt-4 text-[15px] text-muted">
          <Link href="/privacidad" className="font-medium text-confirm-ink">
            {t("pie.privacidad")}
          </Link>{" "}
          ·{" "}
          <Link href="/terminos" className="font-medium text-confirm-ink">
            {t("pie.terminos")}
          </Link>
        </p>
      </Seccion>

      <Seccion
        titulo={tc("baja")}
        bajada={tc("bajaBajada")}
        sinTarjeta
      >
        <BorrarCuenta />
      </Seccion>
    </div>
  );
}
