import { CheckIcon } from "@/components/ui";

const INQUILINOS = [
  "Llegás a cada visita con pruebas, no con promesas.",
  "Tus recibos ordenados, siempre a mano.",
  "Antes de firmar, ves cómo es el dueño según sus inquilinos.",
];

const PROPIETARIOS = [
  "Mirás el historial real del candidato, confirmado por otros dueños.",
  "Recibos automáticos cada vez que confirmás un pago.",
  "Construís tu reputación de buen dueño y alquilás más rápido.",
];

function Lista({ items, tono }: { items: string[]; tono: "confirm" | "primary" }) {
  return (
    <ul className="t-cuerpo m-0 flex list-none flex-col gap-3.5 p-0 text-body">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckIcon
            className={`mt-1 shrink-0 ${tono === "confirm" ? "text-confirm-ink" : "text-primary-ink"}`}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Audiences() {
  return (
    <section
      id="para-quien"
      className="wrap grid grid-cols-1 gap-6 py-14 min-[860px]:grid-cols-2 min-[860px]:py-24"
    >
      <article className="rounded-tarjeta bg-surface p-7 min-[860px]:p-10">
        <p className="t-etiqueta m-0 text-confirm-ink">Para inquilinos</p>
        <h3 className="t-titulo mt-3 mb-6">Que tu buena conducta te abra puertas.</h3>
        <Lista items={INQUILINOS} tono="confirm" />
      </article>

      <article className="rounded-tarjeta bg-primary-soft p-7 min-[860px]:p-10">
        <p className="t-etiqueta m-0 text-primary-ink">Para propietarios</p>
        <h3 className="t-titulo mt-3 mb-6">Elegí inquilino con algo más que intuición.</h3>
        <Lista items={PROPIETARIOS} tono="primary" />
      </article>
    </section>
  );
}
