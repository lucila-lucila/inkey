import { Logo } from "./logo";

/**
 * El header de las pantallas simples (ingreso, onboarding, invitación, perfil
 * público). Existe para que todos los headers del producto sean literalmente
 * el mismo componente y ninguno quede con el logo en otro orden.
 *
 * La landing y la app tienen su propia barra porque llevan navegación, pero
 * usan el mismo `Logo` con el lockup de header.
 */
export function Cabecera({
  href = "/",
  size = "sm",
  acciones,
}: {
  href?: string;
  size?: "sm" | "lg";
  acciones?: React.ReactNode;
}) {
  return (
    <header className="wrap flex items-center justify-between gap-4 py-6">
      <Logo href={href} size={size} />
      {acciones}
    </header>
  );
}
