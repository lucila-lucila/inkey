import { Avatar, CheckIcon, Pill } from "@/components/ui";

/*
 * El perfil de ejemplo del hero: lo que la persona va a querer tener.
 *
 * Es una maqueta, no datos reales. Muestra una sola cosa grande —los meses
 * confirmados— porque es la que importa; el resto acompaña en chico.
 */

const PRIMER_MES = "Oct 2025";
const ULTIMO_MES = "Sep 2026";
const MESES = 12;

/* "Oct 2025" se parte en dos renglones: en la tira el mes manda y el año acompaña. */
function Punta({ mes, alineado }: { mes: string; alineado: "left" | "right" }) {
  const [nombre, anio] = mes.split(" ");
  return (
    <span className={`block ${alineado === "right" ? "text-right" : ""}`}>
      {nombre}
      <br />
      {anio}
    </span>
  );
}

export function ExampleProfile() {
  return (
    <div className="flex justify-center" aria-label="Perfil de ejemplo">
      {/*
        `pb`/`pl` de más abajo a la izquierda: el aviso flotante se apoya sobre
        el borde de la tarjeta y necesita lugar para hacerlo sin taparla.
      */}
      <div className="relative w-full max-w-[520px] pb-10 pl-3 max-[560px]:pb-6 max-[560px]:pl-0">
        <div className="rounded-tarjeta bg-surface p-6 shadow-[0_18px_44px_-24px_rgba(35,32,28,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <Avatar initials="MR" />
              <div>
                <b className="block text-[19px] font-bold">Martina R.</b>
                <small className="block text-[15px] whitespace-nowrap text-muted">Inquilina · Palermo</small>
              </div>
            </div>
            <Pill tone="confirm">
              <CheckIcon size={14} />
              Verificado
            </Pill>
          </div>

          {/*
           * En el celular la tarjeta muestra menos: la cita y las puntas de la
           * tira se esconden, y el resumen pasa debajo de los meses. Lo que
           * tiene que leerse en una pantalla chica es el número.
           */}
          <div className="mt-6 flex flex-col">
            <div className="flex items-center gap-4">
              <span className="t-numero font-display text-[52px] leading-none font-extrabold tracking-[-2px]">
                36
              </span>
              <span className="max-w-[12em] text-[17px] leading-[1.35] text-body">
                meses pagados, confirmados por su dueño
              </span>
            </div>

            <p className="mt-2 mb-0 text-[15px] text-muted max-[560px]:order-3 max-[560px]:mt-4">
              100% en fecha · 2 contratos cumplidos
            </p>

            <div className="mt-6 max-[560px]:order-2 max-[560px]:mt-5">
              <div className="flex gap-[5px]" aria-label={`${MESES} meses confirmados`}>
                {Array.from({ length: MESES }, (_, i) => (
                  <i key={i} className="block h-[26px] flex-1 rounded-[6px] bg-confirm" />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[13px] leading-[1.25] text-muted max-[560px]:hidden">
                <Punta mes={PRIMER_MES} alineado="left" />
                <Punta mes={ULTIMO_MES} alineado="right" />
              </div>
            </div>

            <div className="mt-6 rounded-campo bg-bg p-4 max-[560px]:hidden">
              <q className="quote block text-[17px] leading-[1.6] text-body italic">
                Siempre al día, y cuando se rompió el calefón avisó enseguida.
              </q>
              <small className="mt-2 block text-[15px] text-muted">Su dueño anterior</small>
            </div>
          </div>
        </div>

        {/*
          El momento en el que el producto cumple: el dueño confirmó. Se apoya
          en el borde de la tarjeta para que se lea como algo que acaba de
          pasar, no como parte del perfil.
        */}
        <div className="absolute bottom-0 left-0 flex items-center gap-3 rounded-campo bg-invertido px-4 py-3 text-invertido-ink shadow-[0_14px_30px_-18px_rgba(35,32,28,0.6)] max-[560px]:right-0 max-[560px]:gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-invertido-confirm text-invertido">
            <CheckIcon size={15} />
          </span>
          <div>
            <b className="block text-[15px] font-medium whitespace-nowrap">
              Pago de septiembre confirmado
            </b>
            <small className="block text-[13px] opacity-70 max-[560px]:hidden">
              Tu dueño marcó “Recibido”
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
