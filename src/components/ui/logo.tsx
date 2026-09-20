import Link from "next/link";
import { cn } from "@/lib/cn";

/*
 * Dos llaves enganchadas, en trazo, con las paletas hacia lados opuestos
 * (ver docs/identidad.md). El dibujo es siempre el mismo: lo que cambia con
 * el tamaño es el grosor del trazo y cuántos dientes se dibujan, para que no
 * se empaste en chico.
 *
 * Geometría: R = 15 (radio del aro), centros a 1R, paletas de 2R, trazo 0,3R.
 */

type Version = "completo" | "medio" | "minimo";

const DIENTES: Record<Version, { izquierda: string; derecha: string; trazo: number }> = {
  completo: {
    izquierda: "M37 26H6M14 26v-8M23.5 26v-5.5",
    derecha: "M83 26h31M106 26v8M96.5 26v5.5",
    trazo: 4.5,
  },
  medio: {
    izquierda: "M37 26H14M21 26v-7",
    derecha: "M83 26h23M99 26v7",
    trazo: 6,
  },
  minimo: {
    izquierda: "M37 26H18",
    derecha: "M83 26h19",
    trazo: 8,
  },
};

function versionPara(ancho: number): Version {
  if (ancho >= 120) return "completo";
  if (ancho >= 40) return "medio";
  return "minimo";
}

export function Simbolo({
  ancho = 64,
  className,
  /** Una sola tinta: el aro de atrás se corta en el cruce con el color del fondo. */
  unaTinta,
  titulo,
}: {
  ancho?: number;
  className?: string;
  unaTinta?: { color: string; fondo: string };
  titulo?: string;
}) {
  const version = versionPara(ancho);
  const { izquierda, derecha, trazo } = DIENTES[version];
  const colorIzquierda = unaTinta?.color ?? "var(--primary)";
  const colorDerecha = unaTinta?.color ?? "var(--confirm)";

  return (
    <svg
      viewBox="0 0 124 52"
      width={ancho}
      height={(ancho * 52) / 124}
      fill="none"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      className={className}
    >
      <circle cx="52" cy="26" r="15" stroke={colorIzquierda} strokeWidth={trazo} />
      <path d={izquierda} stroke={colorIzquierda} strokeWidth={trazo} strokeLinecap="round" />

      {/* De una tinta, el cruce se lee por el corte en el aro de atrás. */}
      {unaTinta && (
        <path
          d="M60 13.3a15 15 0 0 1 0 25.4"
          stroke={unaTinta.fondo}
          strokeWidth={trazo + 4}
          strokeLinecap="round"
        />
      )}

      <circle cx="68" cy="26" r="15" stroke={colorDerecha} strokeWidth={trazo} />
      <path d={derecha} stroke={colorDerecha} strokeWidth={trazo} strokeLinecap="round" />
      <path d="M60 13.3a15 15 0 0 1 0 25.4" stroke={colorIzquierda} strokeWidth={trazo} />
    </svg>
  );
}

const TAMANIOS = {
  sm: { simbolo: 96, texto: "text-[22px]" },
  lg: { simbolo: 124, texto: "text-[28px]" },
} as const;

/**
 * Lockup principal: símbolo a la izquierda y el wordmark en display,
 * separados por 1R.
 */
export function Logo({
  href = "/",
  className,
  size = "lg",
  unaTinta,
}: {
  href?: string;
  className?: string;
  size?: keyof typeof TAMANIOS;
  unaTinta?: { color: string; fondo: string };
}) {
  const { simbolo, texto } = TAMANIOS[size];
  const aire = (15 * simbolo) / 124;

  const contenido = (
    <>
      <Simbolo ancho={simbolo} unaTinta={unaTinta} />
      <span
        className={cn("font-display font-extrabold tracking-[-1.6px]", texto)}
        style={unaTinta ? { color: unaTinta.color } : undefined}
      >
        inkey
      </span>
    </>
  );

  const clases = cn(
    "inline-flex items-center text-ink no-underline",
    unaTinta ? undefined : "text-ink",
    className,
  );

  if (!href) {
    return (
      <span className={clases} style={{ gap: `${aire}px` }} aria-label="Inkey">
        {contenido}
      </span>
    );
  }

  return (
    <Link href={href} aria-label="Inkey, inicio" className={clases} style={{ gap: `${aire}px` }}>
      {contenido}
    </Link>
  );
}
