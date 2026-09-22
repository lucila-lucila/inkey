import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { TarjetaPerfil } from "@/components/perfil/tarjeta-perfil";
import { ListaResenas } from "@/components/resena/lista-resenas";
import { ROLES_PERFIL, type Metricas } from "@/lib/domain/perfil";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { SeccionDeLinks, type LinkGuardado } from "./piezas";

export const metadata: Metadata = {
  title: "Mi perfil · Inkey",
  robots: { index: false, follow: false },
};

const ERRORES: Record<string, string> = {
  revocar: "No se pudo revocar el link. Probá de nuevo en un momento.",
  montos: "No se pudo cambiar la configuración de montos. Probá de nuevo en un momento.",
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string; error?: string }>;
}) {
  const params = await searchParams;
  const rol: "tenant" | "owner" = params.rol === "owner" ? "owner" : "tenant";

  const supabase = await createClient();
  const t = await getTranslations();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/perfil");

  // Las reseñas que me dejaron y ya se pueden mostrar. RLS decide cuáles.
  const direccion = rol === "tenant" ? "owner_to_tenant" : "tenant_to_owner";

  const [{ data: perfil }, { data: metricasCrudas }, { data: links }, { data: resenas }, { data: catalogo }] =
    await Promise.all([
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_profile_metrics", { p_role: rol }),
    supabase
      .from("share_links")
      .select("id, label, show_amounts, view_count, created_at, revoked_at, subject_role")
      .eq("subject_role", rol)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("text, tags, created_at, published_at, direction, subject_id")
      .eq("subject_id", user.id)
      .eq("direction", direccion)
      .order("created_at", { ascending: false }),
    supabase.from("review_tag_defs").select("code, label").eq("active", true),
  ]);

  const metricas = metricasCrudas as Metricas;
  const error = params.error ? ERRORES[params.error] : undefined;

  const nombreEtiqueta = new Map(
    ((catalogo ?? []) as Array<{ code: string; label: string }>).map((fila) => [
      fila.code,
      fila.label,
    ]),
  );

  // RLS ya filtró: lo que llega acá es lo que se puede mostrar.
  const resenasVisibles = ((resenas ?? []) as Array<{
    text: string | null;
    tags: string[];
    created_at: string;
    published_at: string | null;
  }>).map((resena) => ({
    texto: resena.text,
    etiquetas: resena.tags.map((codigo) => nombreEtiqueta.get(codigo) ?? codigo),
    fecha: resena.published_at ?? resena.created_at,
    de: rol === "tenant" ? "Su dueño" : "Su inquilino",
  }));

  return (
    <div className="flex max-w-[720px] flex-col gap-7">
      <div>
        <h1 className="t-titulo mt-0 mb-2">{t(`dominio.rolPerfil.${rol}.titulo`)}</h1>
        <p className="m-0 text-body">
          Esto es exactamente lo que ve quien abre tu link. Nadie lo ve sin tu permiso.
        </p>
      </div>

      {/* Una misma cuenta puede tener historial de los dos lados. */}
      <div
        role="group"
        aria-label="Qué historial estás viendo"
        className="inline-grid w-fit grid-cols-2 gap-1.5 rounded-full bg-surface-sunk p-1.5"
      >
        {ROLES_PERFIL.map((valor) => (
          <Link
            key={valor}
            href={`/perfil?rol=${valor}`}
            aria-current={rol === valor ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-[15px] font-medium no-underline",
              rol === valor ? "bg-primary text-on-primary" : "bg-transparent text-body",
            )}
          >
            {t(`dominio.rolPerfil.${valor}.corto`)}
          </Link>
        ))}
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-campo bg-primary-soft p-3 text-[15px] text-primary-ink">
          {error}
        </p>
      )}

      <TarjetaPerfil
        nombre={perfil?.first_name ?? ""}
        inicialApellido={(perfil?.last_name ?? "").slice(0, 1)}
        rol={rol}
        metricas={metricas}
      />

      {metricas?.meses_confirmados === 0 && rol === "tenant" && (
        <Card>
          <p className="m-0 text-body">
            Tu historial empieza a llenarse cuando tu dueño confirme el primer pago. Podés compartir
            el link igual: va a mostrar lo que haya hasta ese momento.
          </p>
        </Card>
      )}

      {resenasVisibles.length > 0 && (
        <section aria-labelledby="titulo-resenas" className="flex flex-col gap-3">
          <h2 id="titulo-resenas" className="t-subtitulo m-0">
            Lo que dijeron de vos
          </h2>
          <ListaResenas resenas={resenasVisibles} />
        </section>
      )}

      <section aria-labelledby="titulo-links" className="flex flex-col gap-4">
        <h2 id="titulo-links" className="t-subtitulo m-0">
          Tus links
        </h2>
        <SeccionDeLinks rol={rol} links={(links ?? []) as LinkGuardado[]} />
      </section>
    </div>
  );
}
