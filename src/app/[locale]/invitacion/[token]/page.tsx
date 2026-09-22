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
  usada: "Este link ya se usó.",
  vencida: "Este link venció. Pedile a quien te invitó que te mande uno nuevo.",
  revocada: "Este link ya no sirve.",
  ya_no_disponible: "Este alquiler ya fue confirmado o cancelado.",
  sos_vos: "No podés confirmar tu propia invitación: este link es para la otra parte.",
  inexistente: "No encontramos esta invitación.",
  demasiados_intentos: "Probaste varias veces seguidas. Esperá unos minutos.",
  servidor: "Algo se rompió de nuestro lado. Probá de nuevo en un rato.",
};

const MENSAJES_ESTADO: Record<string, string> = {
  vencida: "Este link venció. Pedile a quien te invitó que te mande uno nuevo: es gratis y tarda un segundo.",
  usada: "Este link ya se usó. Si fuiste vos, entrá con tu mail y vas a ver el alquiler en tu panel.",
  revocada: "Este link ya no sirve. Puede que hayan generado uno nuevo o cancelado el alquiler.",
  inexistente: "No encontramos esta invitación. Revisá que hayas copiado el link completo.",
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
          <h1 className="mt-0 mb-2 t-titulo">Listo, gracias</h1>
          <p className="mt-0 mb-0 text-body">
            Le avisamos a quien te mandó el link que se equivocó de contacto. No vas a recibir nada
            más de este alquiler.
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
            Ese link no parece válido
          </h1>
          <p className="mt-0 mb-5 text-body">
            Revisá que lo hayas copiado completo, o pedile a quien te invitó que te mande uno nuevo.
          </p>
          <ButtonLink href="/" variant="secondary">
            Ir a Inkey
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
            Este link ya no está disponible
          </h1>
          <p className="mt-0 mb-5 text-body">
            {MENSAJES_ESTADO[resumen.estado] ?? MENSAJES_ESTADO.inexistente}
          </p>
          <ButtonLink href="/" variant="secondary">
            Conocer Inkey
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
          <p className="t-etiqueta m-0 text-primary-ink">Invitación a confirmar</p>
          <h1 className="mt-1.5 mb-2 t-titulo">
            {quien} te invita a confirmar este alquiler
          </h1>
          <p className="m-0 text-body">
            En Inkey las dos partes confirman cada pago. Así el historial vale: nadie puede
            inventarse un mes que no pagó.
          </p>
        </div>

        <Card hero className="flex flex-col gap-5">
          <div>
            <p className="t-etiqueta m-0 text-muted">La propiedad</p>
            <p className="m-0 text-[19px] font-medium">{alquiler.direccion}</p>
            <p className="m-0 text-[15px] text-muted">{alquiler.barrio}</p>
          </div>

          <dl className="m-0 grid grid-cols-1 gap-4 border-t-[1.5px] border-dashed border-line pt-5 sm:grid-cols-2">
            <div>
              <dt className="t-etiqueta text-muted">Alquiler mensual</dt>
              <dd className="m-0 text-[17px] font-medium">
                {formatearMonto(alquiler.monto, alquiler.moneda)}
              </dd>
            </div>
            <div>
              <dt className="t-etiqueta text-muted">Vencimiento</dt>
              <dd className="m-0 text-[17px] font-medium">
                {t(claveDeVencimiento(alquiler.dia_vencimiento), { dia: alquiler.dia_vencimiento })}
              </dd>
            </div>
            <div>
              <dt className="t-etiqueta text-muted">Desde</dt>
              <dd className="m-0 text-[17px] font-medium">{formatearFecha(alquiler.desde)}</dd>
            </div>
            <div>
              <dt className="t-etiqueta text-muted">Hasta</dt>
              <dd className="m-0 text-[17px] font-medium">{formatearFecha(alquiler.hasta)}</dd>
            </div>
            {alquiler.indice_ajuste && (
              <div>
                <dt className="t-etiqueta text-muted">Ajuste</dt>
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
            {MENSAJES_ERROR[error] ?? MENSAJES_ERROR.servidor}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {user ? (
            <Aceptar token={token} />
          ) : (
            <>
              <ButtonLink href={`/ingresar?volver_a=/invitacion/${token}`} className="w-full">
                Entrar para confirmar
              </ButtonLink>
              <p className="m-0 text-center text-[15px] text-muted">
                Entrás con tu mail. Sin contraseñas.
              </p>
            </>
          )}
          <Rechazar token={token} rol={rol} />
        </div>

        <p className="m-0 text-[15px] text-muted">
          {ti("alConfirmar", { rol: t(claveDeRol(rol)) })}{" "}
          <Link href="/" className="font-medium text-primary-ink">
            Cómo funciona Inkey
          </Link>
        </p>
      </div>
    </Marco>
  );
}
