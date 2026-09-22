import Link from "next/link";
import { FlechaIcon } from "@/components/ui";

/*
 * Para quién: los dos lados del alquiler, uno al lado del otro en una sola
 * tarjeta. Van juntos a propósito —es el mismo trato visto desde cada
 * vereda— y cada columna termina en su propia puerta de entrada.
 */

const LADOS = [
  {
    etiqueta: "Si alquilás",
    titulo: "Llegá a cada visita con pruebas, no con promesas.",
    puntos: [
      "Tu historial confirmado, listo para mandar.",
      "Tus recibos ordenados en un solo lugar.",
      "Antes de firmar, ves cómo es el dueño según sus inquilinos.",
    ],
    accion: { texto: "Crear mi historial", href: "/ingresar?intencion=inquilino" },
  },
  {
    etiqueta: "Si tenés una propiedad",
    titulo: "Elegí inquilino con algo más que intuición.",
    puntos: [
      "El historial real del candidato, confirmado por otros dueños.",
      "Un recibo automático cada vez que confirmás un pago.",
      "Tu reputación de buen dueño, a la vista de quien alquila.",
    ],
    accion: { texto: "Sumar mi propiedad", href: "/ingresar?intencion=propietario" },
  },
];

export function Audiences() {
  return (
    <section id="para-quien" className="wrap pb-14 min-[860px]:pb-24">
      <div className="grid grid-cols-1 rounded-tarjeta bg-surface min-[860px]:grid-cols-2">
        {LADOS.map((lado, i) => (
          <article
            key={lado.etiqueta}
            /*
              La línea que los separa: al costado cuando van lado a lado,
              arriba cuando se apilan. Nunca las dos.
            */
            className={
              i === 0
                ? "p-7 min-[860px]:p-10"
                : "border-t border-line p-7 min-[860px]:border-t-0 min-[860px]:border-l min-[860px]:p-10"
            }
          >
            <p className="t-etiqueta m-0 text-primary-ink">{lado.etiqueta}</p>
            <h3 className="t-titulo mt-3 mb-5 max-w-[13em]">{lado.titulo}</h3>

            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {lado.puntos.map((punto) => (
                <li key={punto} className="text-[16px] leading-[1.6] text-body">
                  {punto}
                </li>
              ))}
            </ul>

            <Link
              href={lado.accion.href}
              className="mt-5 inline-block text-[16px] font-bold text-ink no-underline hover:underline hover:underline-offset-4"
            >
              {lado.accion.texto} <FlechaIcon className="text-primary-ink" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
