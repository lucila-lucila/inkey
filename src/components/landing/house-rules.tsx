import { CandadoIcon, CheckIcon, EscudoIcon } from "@/components/ui";

/*
 * Las reglas de la casa: la franja oscura, de borde a borde.
 *
 * Es lo único de la página que corta el crema, y está puesto acá a propósito:
 * son las promesas que sostienen todo lo demás, y merecen frenar la lectura.
 */

const REGLAS = [
  {
    Icono: CandadoIcon,
    tono: "text-invertido-primary",
    titulo: "Vos decidís quién lo ve",
    texto: "Nada es público. Cada link lo creás vos y lo revocás cuando quieras.",
  },
  {
    Icono: CheckIcon,
    // El verde solo donde significa confirmado: esta regla habla justo de eso.
    tono: "text-invertido-confirm",
    titulo: "Solo suma lo que se confirma",
    texto: "Un mes cuenta cuando lo confirman los dos. No hay listas negras ni marcas en contra.",
  },
  {
    Icono: EscudoIcon,
    tono: "text-invertido-primary",
    titulo: "Sin datos crediticios",
    texto: "No consultamos bancos ni Veraz. Es tu palabra y la de tu dueño.",
  },
];

export function HouseRules() {
  return (
    <section className="bg-invertido py-16 text-invertido-ink min-[860px]:py-24">
      <div className="wrap">
        <p className="t-etiqueta m-0 text-invertido-primary">Las reglas de la casa</p>
        <h2 className="t-titulo mt-3 mb-12 max-w-[16em]">
          Tu historial es tuyo. Y nadie queda escrachado.
        </h2>

        <div className="grid grid-cols-1 gap-9 min-[860px]:grid-cols-3 min-[860px]:gap-8">
          {REGLAS.map(({ Icono, tono, titulo, texto }) => (
            <div key={titulo}>
              <Icono size={24} className={tono} />
              <h3 className="mt-3.5 mb-2 text-[17px] font-bold">{titulo}</h3>
              <p className="m-0 text-[16px] leading-[1.6] text-invertido-ink/75">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
