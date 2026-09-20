import { Avatar, Card, CheckIcon, Pill, Stat } from "@/components/ui";

const MESES = ["Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"];

/*
 * Perfil de ejemplo del hero. Es una maqueta: los datos reales del perfil
 * compartible llegan en la Fase 4.
 */
export function ExampleProfile() {
  return (
    <div className="flex justify-center" aria-label="Perfil de ejemplo">
      <Card hero className="flex w-full max-w-[500px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <Avatar initials="MR" />
            <div>
              <b className="block text-[19px] font-bold">Martina R.</b>
              <small className="text-[15px] text-muted">Inquilina · perfil de ejemplo</small>
            </div>
          </div>
          <Pill tone="confirm">
            <CheckIcon size={14} />
            Confirmado
          </Pill>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Stat value={36} label="meses confirmados" destacado />
          <Stat value="100%" label="pagos en fecha" />
          <Stat value={2} label="contratos cumplidos" />
        </div>

        <div>
          <p className="t-etiqueta mb-3 text-muted">Últimos 12 meses</p>
          <div className="grid grid-cols-12 gap-[5px]" aria-label="12 meses confirmados">
            {MESES.map((mes) => (
              <div key={mes} className="flex flex-col items-center gap-1.5 text-[11px] text-muted">
                <i className="block h-[30px] w-full rounded-[6px] bg-confirm" />
                <span className="max-[560px]:hidden">{mes}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <q className="quote t-cuerpo block text-body italic">
            Siempre al día, y cuando se rompió el calefón avisó enseguida. La recomiendo sin dudar.
          </q>
          <small className="mt-2 block text-[15px] text-muted">
            Su dueño anterior, confirmado
          </small>
        </div>
      </Card>
    </div>
  );
}
