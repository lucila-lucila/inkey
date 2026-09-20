const PASOS = [
  {
    titulo: "Invitás a tu dueño",
    texto:
      "Le mandás un link por WhatsApp. Confirma el alquiler con un toque, sin crear cuenta ni contraseña.",
  },
  {
    titulo: "Cada mes, confirman el pago",
    texto:
      "Vos marcás que pagaste y subís el comprobante. Tu dueño responde “recibido”. Los dos quedan con el recibo.",
  },
  {
    titulo: "Compartís tu historial",
    texto:
      "Cuando buscás tu próximo alquiler, mandás tu perfil. Meses confirmados, reseñas y todo verificado.",
  },
];

export function Steps() {
  return (
    <section id="como" className="bg-dark py-16 text-on-dark min-[860px]:py-[104px]">
      <div className="wrap">
        <h2 className="mb-13 max-w-[15em] font-serif text-[clamp(34px,4.4vw,56px)] leading-[1.08] font-semibold tracking-[-0.02em]">
          Tres pasos. Cero garantes nerviosos.
        </h2>
        <ol className="step-list grid list-none grid-cols-1 gap-9 p-0 min-[860px]:grid-cols-3 min-[860px]:gap-8">
          {PASOS.map((paso) => (
            <li key={paso.titulo} className="border-t-2 border-on-dark pt-[22px]">
              <h3 className="mb-3 text-[25px] font-semibold">{paso.titulo}</h3>
              <p className="m-0 leading-[1.55] text-on-dark-muted">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
