import { CheckIcon } from "@/components/ui";

const INQUILINOS = [
  "Llegás a cada visita con pruebas, no con promesas.",
  "Tus recibos ordenados, siempre a mano.",
  "Antes de firmar, ves cómo es el dueño según sus inquilinos.",
];

const PROPIETARIOS = [
  "Mirá el historial real del candidato, confirmado por otros dueños.",
  "Recibos automáticos cada vez que confirmás un pago.",
  "Construí tu reputación de buen dueño y alquilá más rápido.",
];

function Lista({ items, tono }: { items: string[]; tono: "green" | "terra" }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0 text-[16px] text-body min-[860px]:text-[18px]">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckIcon
            className={`mt-[3px] shrink-0 ${tono === "green" ? "text-green-ink" : "text-terra-ink"}`}
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
      className="wrap grid grid-cols-1 gap-7 py-14 min-[860px]:grid-cols-2 min-[860px]:py-28"
    >
      <article className="rounded-card border-[1.5px] border-ink bg-surface p-7 min-[860px]:p-11">
        <p className="m-0 text-[15px] font-semibold text-green-ink">Para inquilinos</p>
        <h3 className="mt-3.5 mb-6 font-serif text-[clamp(28px,3vw,40px)] leading-[1.12] font-semibold">
          Que tu buena conducta te abra puertas.
        </h3>
        <Lista items={INQUILINOS} tono="green" />
      </article>

      <article className="rounded-card border-[1.5px] border-ink bg-terra-tint p-7 min-[860px]:p-11">
        <p className="m-0 text-[15px] font-semibold text-terra-ink">Para propietarios</p>
        <h3 className="mt-3.5 mb-6 font-serif text-[clamp(28px,3vw,40px)] leading-[1.12] font-semibold">
          Elegí inquilino con algo más que intuición.
        </h3>
        <Lista items={PROPIETARIOS} tono="terra" />
      </article>
    </section>
  );
}
