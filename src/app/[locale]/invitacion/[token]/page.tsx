import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ButtonLink, Cabecera, Card, Pie } from "@/components/ui";
import { formatearFecha, formatearMonto, claveDeRol, claveDeVencimiento } from "@/lib/domain/alquiler";
import type { Moneda } from "@/lib/validation/rental";
import { hashearToken, pareceToken } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";
import { Aceptar, Rechazar } from "./piezas";

export const metadata: Metadata = {
  title: "Confirmá el alquiler · Inkey",
  robots: { index: false, follow: false },
};

type Resumen = {
  estado: "valida" | "vencida" | "usada" | "revocada" | "inexistente";
  rol_invitado?: "owner" | "tenant";
  vence?: string;
  invita?: { nombre: string; inicial_apellido: string };
  alquiler?: {
    barrio: string;
    direccion: string;
    desde: string;
    hasta: string | null;
    monto: string;
    moneda: Moneda;
    dia_vencimiento: number;
    indice_ajuste: string | null;
    ajuste_cada_meses: number | null;
  };
};

const MENSAJES_ERROR: Record<string, string> = {
  usada: "invitacionError.usada",
  vencida: "invitacionError.vencida",
  revocada: "invitacionError.revocada",
  ya_no_disponible: "invitacionError.ya_no_disponible",
  sos_vos: "invitacionError.sos_vos",
  inexistente: "invitacionError.inexistente",
  demasiados_intentos: "invitacionError.demasiados_intentos",
  servidor: "invitacionError.servidor",
};

const MENSAJES_ESTADO: Record<string, string> = {
  vencida: "invitacionEstado.vencida",
  usada: "invitacionEstado.usada",
  revocada: "invitacionEstado.revocada",
  inexistente: "invitacionEstado.inexistente",
};

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera />
      <main className="wrap flex w-full flex-1 flex-col items-center justify-center py-8">
        <div className="w-full max-w-[560px]">{children}</div>
      </main>
      <Pie />
    </div>
  );
}

export default async function InvitacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; resultado?: string }>;
}) {
  const t = await getTranslations();
  const ti = await getTranslations("invitacion");
  const { token } = await params;
  const { error, resultado } = await searchParams;

  if (resultado === "rechazada") {
    return (
      <Marco>
        <Card hero >
          <h1 className="mt-0 mb-2 t-titulo">{ti("listoGracias")}</h1>
          <p className="mt-0 mb-0 text-body">
            {ti("avisamosAlOtro")}
          </p>
        </Card>
      </Marco>
    );
  }

  if (!pareceToken(token)) {
    return (
      <Marco>
        <Card hero >
          <h1 className="mt-0 mb-2 t-titulo">
            {ti("linkInvalido")}
          </h1>
          <p className="mt-0 mb-5 text-body">
            {ti("revisaCompleto")}
          </p>
          <ButtonLink href="/" variant="secondary">
            {ti("irAInkey")}
          </ButtonLink>
        </Card>
      </Marco>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error: errorRpc } = await supabase.rpc("invitation_preview", {
    p_token_hash: hashearToken(token),
  });

  if (errorRpc) console.error("invitation_preview falló", errorRpc);
  const resumen = (data ?? { estado: "inexistente" }) as Resumen;

  if (resumen.estado !== "valida" || !resumen.alquiler) {
    return (
      <Marco>
        <Card hero >
          <h1 className="mt-0 mb-2 t-titulo">
            {ti("yaNoDisponible")}
          </h1>
          <p className="mt-0 mb-5 text-body">
            {t(MENSAJES_ESTADO[resumen.estado] ?? MENSAJES_ESTADO.inexistente)}
          </p>
          <ButtonLink href="/" variant="secondary">
            {ti("conocerInkey")}
          </ButtonLink>
        </Card>
      </Marco>
    );
  }

  const { alquiler } = resumen;
  const quien = resumen.invita?.nombre
    ? `${resumen.invita.nombre} ${resumen.invita.inicial_apellido}.`
    : "Alguien";
  const rol = resumen.rol_invitado ?? "owner";

  return (
    <Marco>
      <div className="flex flex-col gap-5">
        <div>
          <p className="t-etiqueta m-0 text-primary-ink">{ti("eyebrow")}</p>
          <h1 className="mt-1.5 mb-2 t-titulo">
            {ti("teInvita", { quien })}
          </h1>
          <p className="m-0 text-body">
            {ti("comoFunciona")}
          </p>
        </div>

        <Card hero className="flex flex-col gap-5">
          <div>
            <p className="t-etiqueta m-0 text-muted">{ti("laPropiedad")}</p>
            <p className="m-0 text-[19px] font-medium">{alquiler.direccion}</p>
            <p className="m-0 text-[15px] text-muted">{alquiler.barrio}</p>
          </div>

          <dl className="m-0 grid grid-cols-1 gap-4 border-t-[1.5px] border-dashed border-line pt-5 sm:grid-cols-2">
            <div>
              <dt className="t-etiqueta text-muted">{ti("alquilerMensual")}</dt>
              <dd className="m-0 text-[17px] font-medium">
                {formatearMonto(alquiler.monto, alquiler.moneda)}
              </dd>
            </div>
            <div>
              <dt className="t-etiqueta text-muted">{ti("vencimiento")}</dt>
              <dd className="m-0 text-[17px] font-medium">
                {t(claveDeVencimiento(alquiler.dia_vencimiento), { dia: alquiler.dia_vencimiento })}
              </dd>
            </div>
            <div>
              <dt className="t-etiqueta text-muted">{ti("desde")}</dt>
              <dd className="m-0 text-[17px] font-medium">{formatearFecha(alquiler.desde)}</dd>
            </div>
            <div>
              <dt className="t-etiqueta text-muted">{ti("hasta")}</dt>
              <dd className="m-0 text-[17px] font-medium">{formatearFecha(alquiler.hasta)}</dd>
            </div>
            {alquiler.indice_ajuste && (
              <div>
                <dt className="t-etiqueta text-muted">{ti("ajuste")}</dt>
                <dd className="m-0 text-[17px] font-medium">
                  {alquiler.indice_ajuste}, cada {alquiler.ajuste_cada_meses}{" "}
                  {alquiler.ajuste_cada_meses === 1 ? "mes" : "meses"}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {error && (
          <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
            {t(MENSAJES_ERROR[error] ?? MENSAJES_ERROR.servidor)}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {user ? (
            <Aceptar token={token} />
          ) : (
            <>
              <ButtonLink href={`/ingresar?volver_a=/invitacion/${token}`} className="w-full">
                {ti("entrarParaConfirmar")}
              </ButtonLink>
              <p className="m-0 text-center text-[15px] text-muted">
                {ti("entrasConTuMail")}
              </p>
            </>
          )}
          <Rechazar token={token} rol={rol} />
        </div>

        <p className="m-0 text-[15px] text-muted">
          {ti("alConfirmar", { rol: t(claveDeRol(rol)) })}{" "}
          <Link href="/" className="font-medium text-primary-ink">
            {ti("comoFuncionaInkey")}
          </Link>
        </p>
      </div>
    </Marco>
  );
}
