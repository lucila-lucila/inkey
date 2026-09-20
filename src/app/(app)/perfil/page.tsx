import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { TarjetaPerfil } from "@/components/perfil/tarjeta-perfil";
import { ROLES_PERFIL, type Metricas } from "@/lib/domain/perfil";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { ListaDeLinks, NuevoLink, type LinkGuardado } from "./piezas";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?volver_a=/perfil");

  const [{ data: perfil }, { data: metricasCrudas }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_profile_metrics", { p_role: rol }),
    supabase
      .from("share_links")
      .select("id, label, show_amounts, view_count, created_at, revoked_at, subject_role")
      .eq("subject_role", rol)
      .order("created_at", { ascending: false }),
  ]);

  const metricas = metricasCrudas as Metricas;
  const error = params.error ? ERRORES[params.error] : undefined;

  return (
    <div className="flex max-w-[720px] flex-col gap-7">
      <div>
        <h1 className="t-titulo mt-0 mb-2">{ROLES_PERFIL[rol].titulo}</h1>
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
        {(["tenant", "owner"] as const).map((valor) => (
          <Link
            key={valor}
            href={`/perfil?rol=${valor}`}
            aria-current={rol === valor ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-[15px] font-medium no-underline",
              rol === valor ? "bg-primary text-on-primary" : "bg-transparent text-body",
            )}
          >
            {ROLES_PERFIL[valor].corto}
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

      <section aria-labelledby="titulo-links" className="flex flex-col gap-4">
        <h2 id="titulo-links" className="t-subtitulo m-0">
          Tus links
        </h2>
        <NuevoLink rol={rol} />
        <ListaDeLinks links={(links ?? []) as LinkGuardado[]} />
      </section>
    </div>
  );
}
