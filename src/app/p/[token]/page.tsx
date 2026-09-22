import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Cabecera, Card, Pie } from "@/components/ui";
import { TarjetaPerfil } from "@/components/perfil/tarjeta-perfil";
import { ListaResenas } from "@/components/resena/lista-resenas";
import { nombreVisible, resumenParaCompartir } from "@/lib/domain/perfil";
import { perfilDelToken } from "./datos";

/*
 * Perfil compartible. Es público para quien tenga el link, pero nunca
 * indexable: el historial es de la persona, no de internet.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const perfil = await perfilDelToken(token);

  if (perfil.estado !== "valido") {
    return { title: "Perfil no disponible · Inkey", robots: { index: false, follow: false } };
  }

  const nombre = nombreVisible(perfil.nombre, perfil.inicial_apellido);
  const titulo = `${nombre} · Historial de alquiler confirmado`;
  const descripcion = resumenParaCompartir(perfil.metricas, perfil.rol);

  return {
    title: titulo,
    description: descripcion,
    robots: { index: false, follow: false },
    openGraph: { title: titulo, description: descripcion, type: "profile" },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera />
      <main className="wrap flex w-full flex-1 flex-col items-center py-4">
        <div className="w-full max-w-[560px]">{children}</div>
      </main>
      <Pie />
    </div>
  );
}

const MENSAJES: Record<string, string> = {
  revocado: "Quien te lo compartió dio de baja este link. Pedile uno nuevo.",
  vencido: "Este link venció. Pedile uno nuevo a quien te lo compartió.",
  inexistente: "No encontramos este perfil. Revisá que hayas copiado el link completo.",
};

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const perfil = await perfilDelToken(token);

  if (perfil.estado !== "valido") {
    return (
      <Marco>
        <Card hero>
          <h1 className="t-titulo mt-0 mb-2">Este link ya no está disponible</h1>
          <p className="mt-0 mb-5 text-body">
            {MENSAJES[perfil.estado] ?? MENSAJES.inexistente}
          </p>
          <ButtonLink href="/" variant="secondary">
            Conocer Inkey
          </ButtonLink>
        </Card>
      </Marco>
    );
  }

  const esInquilino = perfil.rol === "tenant";

  return (
    <Marco>
      <div className="flex flex-col gap-5">
        <div>
          <p className="t-etiqueta m-0 text-primary-ink">Historial confirmado</p>
          <h1 className="t-titulo mt-2 mb-2">
            {esInquilino
              ? `El historial de alquiler de ${nombreVisible(perfil.nombre, perfil.inicial_apellido)}`
              : `${nombreVisible(perfil.nombre, perfil.inicial_apellido)} como propietario`}
          </h1>
          <p className="m-0 text-body">
            Cada mes que ves acá lo confirmaron las dos partes: quien pagó y quien cobró. Nadie
            puede inventarse un mes.
          </p>
        </div>

        <TarjetaPerfil
          nombre={perfil.nombre}
          inicialApellido={perfil.inicial_apellido}
          rol={perfil.rol}
          metricas={perfil.metricas}
        />

        {perfil.resenas.length > 0 && (
          <section aria-labelledby="titulo-resenas" className="flex flex-col gap-3">
            <h2 id="titulo-resenas" className="t-subtitulo m-0">
              {perfil.resenas.length === 1
                ? "Lo que dijo la otra parte"
                : "Lo que dijeron las otras partes"}
            </h2>
            <ListaResenas resenas={perfil.resenas} />
          </section>
        )}

        <Card className="flex flex-col items-start gap-3">
          <p className="m-0 text-body">
            ¿Querés guardarlo o imprimirlo? Bajate el perfil en PDF.
          </p>
          <ButtonLink href={`/p/${token}/pdf`} target="_blank" variant="secondary" size="md">
            Descargar en PDF
          </ButtonLink>
        </Card>

        <p className="m-0 text-[15px] text-muted">
          Inkey no muestra la dirección, el teléfono ni el mail de nadie, y tampoco los meses sin
          confirmar. Quien comparte este link decide qué se ve y puede darlo de baja cuando
          quiera.{" "}
          <Link href="/" className="font-medium text-primary-ink">
            Cómo funciona Inkey
          </Link>
        </p>
      </div>
    </Marco>
  );
}
