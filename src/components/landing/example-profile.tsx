import { Avatar, Card, CheckIcon, Pill, Stat } from "@/components/ui";

const MESES = ["Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"];

/*
 * Perfil de ejemplo del hero. Es una maqueta estática: los datos reales del
 * perfil compartible llegan en la Fase 4.
 */
export function ExampleProfile() {
  return (
    <div className="flex justify-center" aria-label="Perfil de ejemplo">
      <Card
        hero
        className="flex w-full max-w-[500px] flex-col gap-5 p-[22px] sm:gap-6 sm:p-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <Avatar initials="MR" />
            <div>
              <b className="block text-[20px]">Martina R.</b>
              <small className="text-[14px] text-muted">Inquilina · perfil de ejemplo</small>
            </div>
          </div>
          <Pill tone="green">
            <CheckIcon size={14} />
            Verificado
          </Pill>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Stat value={36} label="meses confirmados" />
          <Stat value="100%" label="pagos en fecha" />
          <Stat value={2} label="contratos cumplidos" />
        </div>

        <div>
          <p className="mb-2.5 text-[14px] font-semibold text-muted">Últimos 12 meses</p>
          <div className="grid grid-cols-12 gap-[5px]" aria-label="12 meses confirmados">
            {MESES.map((mes) => (
              <div key={mes} className="flex flex-col items-center gap-1.5 text-[11px] text-muted">
                <i className="block h-[30px] w-full rounded-md bg-green" />
                <span className="max-[560px]:hidden">{mes}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t-[1.5px] border-dashed border-line pt-[18px]">
          <q className="quote block font-serif text-[17px] leading-[1.45] font-medium text-terra-ink italic sm:text-[19px]">
            Siempre al día, y cuando se rompió el calefón avisó enseguida. La recomiendo sin dudar.
          </q>
          <small className="mt-2 block text-[14px] text-muted">
            Su propietario anterior, confirmado
          </small>
        </div>
      </Card>
    </div>
  );
}
