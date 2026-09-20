const REGLAS = [
  {
    titulo: "Tu historial es tuyo",
    texto: "Vos decidís si lo compartís y con quién. Nadie ve esto sin tu permiso.",
  },
  {
    titulo: "Solo lo que se confirma",
    texto: "Un mes cuenta cuando lo confirman los dos. No hay listas negras ni escraches.",
  },
  {
    titulo: "Sin datos crediticios",
    texto: "No consultamos bancos ni Veraz. Es tu palabra y la de tu dueño.",
  },
];

export function HouseRules() {
  return (
    <section className="wrap pb-14 min-[860px]:pb-24">
      <h2 className="t-titulo mb-10 max-w-[15em]">Las reglas de la casa</h2>
      <div className="grid grid-cols-1 gap-6 min-[860px]:grid-cols-3 min-[860px]:gap-8">
        {REGLAS.map((regla) => (
          <div key={regla.titulo} className="rounded-tarjeta bg-surface p-6">
            <h3 className="t-subtitulo mb-2">{regla.titulo}</h3>
            <p className="t-cuerpo m-0 text-body">{regla.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
