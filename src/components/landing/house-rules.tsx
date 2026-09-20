const REGLAS = [
  {
    titulo: "Tu historial es tuyo",
    texto: "Vos decidís si lo compartís y con quién. Nadie lo ve sin tu permiso.",
  },
  {
    titulo: "Solo lo que se confirma",
    texto: "Cada mes cuenta cuando lo confirman las dos partes. No hay listas negras ni escraches.",
  },
  {
    titulo: "Sin datos crediticios",
    texto: "No consultamos bancos ni Veraz. Es tu palabra y la de tu dueño.",
  },
];

export function HouseRules() {
  return (
    <section className="wrap pb-14 min-[860px]:pb-28">
      <h2 className="mb-10 max-w-[15em] font-serif text-[clamp(34px,4.4vw,56px)] leading-[1.08] font-semibold tracking-[-0.02em]">
        Las reglas de la casa
      </h2>
      <div className="grid grid-cols-1 gap-6.5 min-[860px]:grid-cols-3 min-[860px]:gap-8">
        {REGLAS.map((regla) => (
          <div key={regla.titulo}>
            <h3 className="mb-2 text-[22px] font-semibold">{regla.titulo}</h3>
            <p className="m-0 leading-[1.55] text-body">{regla.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
