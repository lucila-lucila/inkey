import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Cabecera, Card, Pie } from "@/components/ui";
import { TarjetaPerfil } from "@/components/perfil/tarjeta-perfil";
import { ListaResenas } from "@/components/resena/lista-resenas";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations();
  const { token } = await params;
  const perfil = await perfilDelToken(token);

  if (perfil.estado !== "valido") {
    return { title: t("perfilPublico.noDisponibleMeta"), robots: { index: false, follow: false } };
  }

  const nombre = nombreVisible(perfil.nombre, perfil.inicial_apellido);
  const titulo = `${nombre} · ${t("perfilPublico.tituloMeta")}`;
  const descripcion = resumenParaCompartir(t, perfil.metricas, perfil.rol);

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
  revocado: "perfilLink.revocado",
  vencido: "perfilLink.vencido",
  inexistente: "perfilLink.inexistente",
};

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const t = await getTranslations();
  const tpp = await getTranslations("perfilPublicoPagina");
  const { token } = await params;
  const perfil = await perfilDelToken(token);

  if (perfil.estado !== "valido") {
    return (
      <Marco>
        <Card hero>
          <h1 className="t-titulo mt-0 mb-2">{tpp("yaNoDisponible")}</h1>
          <p className="mt-0 mb-5 text-body">
            {t(MENSAJES[perfil.estado] ?? MENSAJES.inexistente)}
          </p>
          <ButtonLink href="/" variant="secondary">
            {tpp("conocerInkey")}
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
          <p className="t-etiqueta m-0 text-primary-ink">{tpp("eyebrow")}</p>
          <h1 className="t-titulo mt-2 mb-2">
            {esInquilino
              ? tpp("titulo", { nombre: nombreVisible(perfil.nombre, perfil.inicial_apellido) })
              : tpp("tituloPropietario", {
                  nombre: nombreVisible(perfil.nombre, perfil.inicial_apellido),
                })}
          </h1>
          <p className="m-0 text-body">
            {tpp("bajada")}
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
              {perfil.resenas.length === 1 ? tpp("loQueDijo") : tpp("loQueDijeron")}
            </h2>
            <ListaResenas resenas={perfil.resenas} />
          </section>
        )}

        <Card className="flex flex-col items-start gap-3">
          <p className="m-0 text-body">
            {tpp("guardarloPdf")}
          </p>
          <ButtonLink href={`/p/${token}/pdf`} target="_blank" variant="secondary" size="md">
            {tpp("descargarPdf")}
          </ButtonLink>
        </Card>

        <p className="m-0 text-[15px] text-muted">
          {tpp("nota")}{" "}
          <Link href="/" className="font-medium text-primary-ink">
            {tpp("comoFuncionaInkey")}
          </Link>
        </p>
      </div>
    </Marco>
  );
}
