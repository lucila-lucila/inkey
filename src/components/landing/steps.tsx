const PASOS = [
  {
    titulo: "Invitás a tu dueño",
    texto:
      "Le mandás un link por WhatsApp. Lo abre, ve el alquiler y lo confirma con un toque. No tiene que crear contraseña.",
  },
  {
    titulo: "Cada mes, confirman el pago",
    texto:
      "Vos marcás que pagaste y subís el comprobante. Tu dueño responde “recibido”. Los dos quedan con el recibo.",
  },
  {
    titulo: "Compartís tu historial",
    texto:
      "Cuando buscás tu próximo alquiler, mandás tu perfil. Meses confirmados, reseñas y todo confirmado por la otra parte.",
  },
];

export function Steps() {
  return (
    <section id="como" className="wrap">
      <div className="rounded-tarjeta bg-invertido px-6 py-14 text-invertido-ink min-[860px]:px-12 min-[860px]:py-20">
        <h2 className="t-titulo mb-12 max-w-[15em]">Tres pasos. Cero garantes nerviosos.</h2>
        <ol className="step-list grid list-none grid-cols-1 gap-9 p-0 min-[860px]:grid-cols-3 min-[860px]:gap-8">
          {PASOS.map((paso) => (
            <li key={paso.titulo} className="border-t-2 border-invertido-ink/30 pt-5">
              <h3 className="t-subtitulo mb-3">{paso.titulo}</h3>
              <p className="t-cuerpo m-0 text-invertido-ink/75">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
