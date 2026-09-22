import {
  MaquetaCompartir,
  MaquetaConfirmacion,
  MaquetaInvitacion,
} from "@/components/landing/maquetas";

/*
 * Cómo funciona: tres pasos, cada uno con un dibujo de lo que pasa en la
 * pantalla. La maqueta va arriba y el texto abajo, porque primero se mira y
 * después se lee.
 */

const PASOS = [
  {
    maqueta: <MaquetaInvitacion />,
    titulo: "Invitás a tu dueño",
    texto: "Le llega un link. Confirma con un toque, sin crear contraseña.",
  },
  {
    maqueta: <MaquetaConfirmacion />,
    titulo: "Cada mes, confirman el pago",
    texto: "Vos avisás que pagaste. Tu dueño marca “Recibido”. Los dos quedan con el recibo.",
  },
  {
    maqueta: <MaquetaCompartir />,
    titulo: "Compartís tu historial",
    texto: "Cuando buscás tu próximo alquiler, mandás el link. Lo revocás cuando quieras.",
  },
];

export function Steps() {
  return (
    <section id="como" className="wrap py-14 min-[860px]:py-24">
      <p className="t-etiqueta m-0 text-primary-ink">Cómo funciona</p>
      <h2 className="t-titulo mt-3 mb-10 max-w-[14em]">Tres pasos. Diez segundos por mes.</h2>

      <ol className="m-0 grid list-none grid-cols-1 gap-10 p-0 min-[860px]:grid-cols-3 min-[860px]:gap-8">
        {PASOS.map((paso, i) => (
          <li key={paso.titulo} className="flex flex-col items-stretch gap-5">
            {paso.maqueta}
            <div className="flex gap-3">
              <span
                aria-hidden
                className="t-numero font-display text-[17px] leading-[1.5] font-bold text-primary-ink"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="m-0 text-[17px] font-bold">{paso.titulo}</h3>
                <p className="mt-1 mb-0 text-[16px] leading-[1.55] text-body">{paso.texto}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
