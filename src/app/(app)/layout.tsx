import Link from "next/link";
import { redirect } from "next/navigation";
import { cerrarSesion } from "@/app/(auth)/ingresar/actions";
import { BotonSalir, MenuDeCuenta } from "@/components/app/menu-de-cuenta";
import { Logo, Pie } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { iniciales } from "@/lib/validation/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const nombre = perfil?.first_name ?? "";
  const apellido = perfil?.last_name ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-[1.5px] border-line">
        <div className="wrap flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-7">
            <Logo href="/panel" size="sm" />
            {/* En el celular esta barra no entra: los links viven en el menú. */}
            <nav className="flex gap-5 text-[15px] font-medium max-[760px]:hidden">
              <Link href="/panel" className="text-ink no-underline hover:underline hover:underline-offset-4">
                Panel
              </Link>
              <Link href="/perfil" className="text-ink no-underline hover:underline hover:underline-offset-4">
                Mi perfil
              </Link>
              <Link href="/cuenta" className="text-ink no-underline hover:underline hover:underline-offset-4">
                Mi cuenta
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {nombre ? (
              <MenuDeCuenta iniciales={iniciales(nombre, apellido)} cerrarSesion={cerrarSesion} />
            ) : (
              <BotonSalir cerrarSesion={cerrarSesion} />
            )}
          </div>
        </div>
      </header>

      <main className="wrap w-full flex-1 py-8">{children}</main>
      <Pie />
    </div>
  );
}
