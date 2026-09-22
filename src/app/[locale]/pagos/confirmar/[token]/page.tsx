import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink, Cabecera, Card, Pie } from "@/components/ui";
import { formatearFecha, formatearMonto } from "@/lib/domain/alquiler";
import { nombrePeriodo } from "@/lib/domain/pagos";
import { nombreVisible } from "@/lib/domain/perfil";
import type { Moneda } from "@/lib/validation/rental";
import { hashearToken, pareceToken } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";
import { Responder } from "./piezas";

export const metadata: Metadata = {
  title: "Confirmá el pago · Inkey",
  robots: { index: false, follow: false },
};

type Resumen = {
  estado: "valido" | "usado" | "vencido" | "ya_confirmado" | "inexistente";
  periodo?: string;
  monto?: string;
  moneda?: Moneda;
  pagado_el?: string;
  vencia?: string;
  barrio?: string;
  inquilino?: { nombre: string; inicial_apellido: string };
};

const MENSAJES: Record<string, string> = {
  usado: "confirmarPago.usado",
  vencido: "confirmarPago.vencido",
  ya_confirmado: "confirmarPago.ya_confirmado",
  inexistente: "confirmarPago.inexistente",
};

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera />
      <main className="wrap flex w-full flex-1 flex-col items-center justify-center py-8">
        <div className="w-full max-w-[520px]">{children}</div>
      </main>
      <Pie />
    </div>
  );
}

export default async function ConfirmarDesdeMailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ respuesta?: string; resultado?: string }>;
}) {
  const t = await getTranslations();
  const { token } = await params;
  const { respuesta, resultado } = await searchParams;

  if (resultado) {
    const confirmado = resultado === "confirmado";
    return (
      <Marco>
        <Card hero>
          <h1 className="t-titulo mt-0 mb-2">
            {confirmado ? "Listo, quedó confirmado" : "Listo, le avisamos"}
          </h1>
          <p className="mt-0 mb-5 text-body">
            {confirmado
              ? "Ese mes ya suma al historial de tu inquilino, y los dos tienen el recibo."
              : "Tu inquilino va a poder volver a reportarlo con el comprobante. No queda ninguna marca."}
          </p>
          <ButtonLink href="/panel" variant="secondary">
            Ver mis alquileres
          </ButtonLink>
        </Card>
      </Marco>
    );
  }

  const valido = pareceToken(token);
  const supabase = await createClient();

  const { data } = valido
    ? await supabase.rpc("payment_token_preview", { p_token_hash: hashearToken(token) })
    : { data: null };

  const resumen = (data ?? { estado: "inexistente" }) as Resumen;

  if (resumen.estado !== "valido") {
    return (
      <Marco>
        <Card hero>
          <h1 className="t-titulo mt-0 mb-2">Este link ya no sirve</h1>
          <p className="mt-0 mb-5 text-body">
            {t(MENSAJES[resumen.estado] ?? MENSAJES.inexistente)}
          </p>
          <ButtonLink href="/ingresar" variant="secondary">
            Entrar a Inkey
          </ButtonLink>
        </Card>
      </Marco>
    );
  }

  const quien = resumen.inquilino
    ? nombreVisible(resumen.inquilino.nombre, resumen.inquilino.inicial_apellido)
    : "Tu inquilino";

  return (
    <Marco>
      <div className="flex flex-col gap-5">
        <div>
          <p className="t-etiqueta m-0 text-primary-ink">Te reportaron un pago</p>
          <h1 className="t-titulo mt-2 mb-2">¿Te llegó este pago?</h1>
          <p className="m-0 text-body">
            {quien} reportó que pagó el alquiler de {nombrePeriodo(resumen.periodo!)} en{" "}
            {resumen.barrio}.
          </p>
        </div>

        <Card hero className="flex flex-col gap-4">
          <div>
            <p className="t-etiqueta m-0 text-muted">Monto</p>
            <p className="t-numero m-0">{formatearMonto(resumen.monto!, resumen.moneda!)}</p>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <dt className="t-etiqueta text-muted">Lo pagó el</dt>
              <dd className="m-0 text-[17px] font-medium">
                {formatearFecha(String(resumen.pagado_el).slice(0, 10))}
              </dd>
            </div>
            <div>
              <dt className="t-etiqueta text-muted">Vencía el</dt>
              <dd className="m-0 text-[17px] font-medium">
                {formatearFecha(String(resumen.vencia).slice(0, 10))}
              </dd>
            </div>
          </dl>
        </Card>

        <Responder token={token} abrirNota={respuesta === "no"} />

        <p className="m-0 text-[15px] text-muted">
          Este link responde solo este pago y se usa una sola vez: no abre tu cuenta. Para ver todo
          tu historial, entrá con tu mail.
        </p>
      </div>
    </Marco>
  );
}
