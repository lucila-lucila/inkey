import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui";

/*
 * Las tres maquetas de "Cómo funciona".
 *
 * Son dibujos de la app, no la app: nada de esto responde a un toque ni tiene
 * datos reales. Están para que se entienda de un vistazo qué pasa en cada
 * paso, que es algo que ningún párrafo logra tan rápido.
 *
 * Por eso van con `aria-hidden`: quien usa un lector de pantalla ya tiene el
 * texto del paso al lado, y una maqueta muda solo le haría leer de más.
 */

function Maqueta({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      // `flex-1`: las tres quedan de la misma altura aunque digan distinto.
      className="flex min-h-[210px] flex-1 flex-col justify-center rounded-tarjeta bg-surface p-6"
    >
      {children}
    </div>
  );
}

/** 1. El mensaje que le llega al dueño por WhatsApp, con su vista previa. */
export function MaquetaInvitacion() {
  const t = useTranslations("landing.maquetas");
  return (
    <Maqueta>
      <div className="rounded-campo bg-surface-sunk p-3.5">
        <p className="m-0 text-[15px] leading-[1.45] text-body">
          {t("mensaje")}
        </p>
        {/* La tarjeta de vista previa del link, como la arma WhatsApp. */}
        <div className="mt-2.5 rounded-[10px] bg-surface p-3">
          <b className="block text-[14px] font-bold">{t("previewTitulo")}</b>
          <small className="block text-[13px] text-muted">{t("previewUrl")}</small>
        </div>
      </div>
      <small className="mt-2.5 block self-end text-right text-[13px] leading-[1.3] text-muted">
        {t("enviadoPor")}
      </small>
    </Maqueta>
  );
}

/** 2. Lo que ve el dueño: el monto y dos botones grandes. */
export function MaquetaConfirmacion() {
  const t = useTranslations("landing.maquetas");
  return (
    <Maqueta>
      <div className="flex items-center gap-2.5">
        <Avatar initials="MR" className="size-8 text-[13px]" />
        <b className="text-[15px] font-bold">{t("avisoPago")}</b>
      </div>
      <p className="t-monto mt-3.5 mb-0 text-[30px] whitespace-nowrap">$ 450.000</p>
      <small className="mt-1 block text-[14px] text-muted">{t("periodoPago")}</small>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {/*
          El único verde de toda la sección: acá el verde es el "recibido",
          que es exactamente lo que el verde significa en Inkey.
        */}
        <span className="rounded-full bg-confirm px-4 py-2 text-[14px] font-medium text-on-confirm">
          {t("recibido")}
        </span>
        <span className="rounded-full bg-surface-sunk px-4 py-2 text-[14px] font-medium text-ink">
          {t("todaviaNo")}
        </span>
      </div>
    </Maqueta>
  );
}

/** 3. El link del historial, listo para copiar y mandar. */
export function MaquetaCompartir() {
  const t = useTranslations("landing.maquetas");
  return (
    <Maqueta>
      <div className="flex items-baseline gap-2.5">
        <span className="t-numero font-display text-[34px] leading-none font-extrabold tracking-[-1px]">
          36
        </span>
        <span className="text-[14px] leading-[1.35] text-body">
          {t("mesesConfirmados")}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-campo bg-surface-sunk p-2 pl-3.5">
        <span className="min-w-0 flex-1 truncate text-[14px] text-body">{t("linkPerfil")}</span>
        <span className="shrink-0 rounded-full bg-invertido px-3.5 py-1.5 text-[13px] font-medium text-invertido-ink">
          {t("copiar")}
        </span>
      </div>
      <small className="mt-2.5 block text-[13px] text-muted">
        {t("aberturas")}
      </small>
    </Maqueta>
  );
}
