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

/*
 * Caja ajustada de cada versión: el viewBox completo deja aire a los lados, y
 * cuando el símbolo hace de punto final ese aire se nota como un espacio de
 * más entre la palabra y el símbolo.
 *
 * Son los extremos reales del dibujo (contando el grosor del trazo) más medio
 * punto de aire. La de `medio` es, carácter por carácter, la del archivo de
 * marca `public/brand/inkey-simbolo-medio.svg`; el test de identidad compara
 * las dos.
 */
const CAJA_AJUSTADA: Record<Version, { viewBox: string; ancho: number; alto: number }> = {
  completo: { viewBox: "3.25 8.25 113.5 35.5", ancho: 113.5, alto: 35.5 },
  medio: { viewBox: "10.5 7.5 99 37", ancho: 99, alto: 37 },
  minimo: { viewBox: "13.5 6.5 93 39", ancho: 93, alto: 39 },
};

/*
 * Los dos cruces, como dos eslabones enganchados de verdad: arriba pasa por
 * delante la llave izquierda y abajo la derecha.
 *
 * `ARCO_DE_ADELANTE` es un tramo del aro izquierdo que se dibuja último, así
 * queda por encima del derecho en el cruce de arriba. El de abajo sale solo,
 * porque el aro derecho se dibuja después del izquierdo.
 *
 * Con una sola tinta el cruce no se lee por color: ahí hacen falta además dos
 * muescas cortas del color del fondo, una en cada cruce, para separar el aro
 * de atrás del de adelante.
 */
const ARCO_DE_ADELANTE = "M49.40 11.23A15 15 0 0 1 66.10 20.87";
const MUESCA_ARRIBA = "M57.17 15.62A15 15 0 0 1 63.31 11.75";
const MUESCA_ABAJO = "M62.83 36.38A15 15 0 0 1 56.69 40.25";

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
  /** Forzar una versión: al lado del texto, la media se lee mejor que la mínima. */
  version: versionForzada,
  /** Sin el aire del viewBox, para lockups ajustados. */
  ajustado = false,
}: {
  ancho?: number;
  className?: string;
  unaTinta?: { color: string; fondo: string };
  titulo?: string;
  version?: Version;
  ajustado?: boolean;
}) {
  const version = versionForzada ?? versionPara(ancho);
  const { izquierda, derecha, trazo } = DIENTES[version];
  const colorIzquierda = unaTinta?.color ?? "var(--primary)";
  const colorDerecha = unaTinta?.color ?? "var(--confirm)";
  const caja = ajustado
    ? CAJA_AJUSTADA[version]
    : { viewBox: "0 0 124 52", ancho: 124, alto: 52 };

  return (
    <svg
      viewBox={caja.viewBox}
      width={ancho}
      height={(ancho * caja.alto) / caja.ancho}
      fill="none"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      className={className}
    >
      <circle cx="52" cy="26" r="15" stroke={colorIzquierda} strokeWidth={trazo} />
      <path d={izquierda} stroke={colorIzquierda} strokeWidth={trazo} strokeLinecap="round" />

      {/* Abajo pasa por delante la llave derecha: se muesca el aro izquierdo. */}
      {unaTinta && (
        <path
          d={MUESCA_ABAJO}
          stroke={unaTinta.fondo}
          strokeWidth={trazo + 4}
          strokeLinecap="butt"
        />
      )}

      <circle cx="68" cy="26" r="15" stroke={colorDerecha} strokeWidth={trazo} />
      <path d={derecha} stroke={colorDerecha} strokeWidth={trazo} strokeLinecap="round" />

      {/* Y arriba pasa la izquierda: se muesca el aro derecho. */}
      {unaTinta && (
        <path
          d={MUESCA_ARRIBA}
          stroke={unaTinta.fondo}
          strokeWidth={trazo + 4}
          strokeLinecap="butt"
        />
      )}
      <path d={ARCO_DE_ADELANTE} stroke={colorIzquierda} strokeWidth={trazo} />
    </svg>
  );
}

/*
 * Dos medidas por tamaño, según el lockup:
 *   - `pie`: símbolo a la izquierda, wordmark a 1R;
 *   - `header`: wordmark grande y símbolo chico de remate.
 * En el header el símbolo NO crece con el wordmark: es un punto final.
 */
const TAMANIOS = {
  sm: { simboloPie: 96, fuentePie: 22, fuenteHeader: 34, simboloHeader: 27 },
  lg: { simboloPie: 124, fuentePie: 28, fuenteHeader: 44, simboloHeader: 34 },
} as const;

/**
 * Lockup.
 *
 * - `punto` (por defecto): wordmark grande y el símbolo chico a la derecha,
 *   apoyado en la base del texto, ocupando el lugar del punto final. Es el de
 *   TODOS los headers, del sitio y de la app. Va en versión media: al lado del
 *   texto, dos dientes por llave hacen ruido. Es el valor por defecto a
 *   propósito, para que una pantalla nueva no pueda quedar con el orden viejo.
 * - `simbolo-izquierda`: símbolo a la izquierda y wordmark a 1R. Solo para lo
 *   que no es header: pie, recibo, perfil en PDF y mails.
 */
export function Logo({
  href = "/",
  className,
  size = "lg",
  unaTinta,
  variante = "punto",
}: {
  href?: string;
  className?: string;
  size?: keyof typeof TAMANIOS;
  unaTinta?: { color: string; fondo: string };
  variante?: "simbolo-izquierda" | "punto";
}) {
  const medidas = TAMANIOS[size];
  const esPunto = variante === "punto";

  const fuenteUsada = esPunto ? medidas.fuenteHeader : medidas.fuentePie;
  const anchoSimbolo = esPunto ? medidas.simboloHeader : medidas.simboloPie;

  // 1R de aire en el lockup del pie; medio radio cuando hace de punto final.
  const radio = esPunto
    ? (15 * anchoSimbolo) / CAJA_AJUSTADA.medio.ancho
    : (15 * anchoSimbolo) / 124;
  const separacion = esPunto ? radio / 2 : radio;

  const marca = (
    <Simbolo
      ancho={anchoSimbolo}
      unaTinta={unaTinta}
      version={esPunto ? "medio" : undefined}
      ajustado={esPunto}
    />
  );

  const palabra = (
    <span
      className="font-display font-extrabold"
      style={{
        fontSize: `${fuenteUsada}px`,
        letterSpacing: "-1.6px",
        color: unaTinta?.color,
      }}
    >
      inkey
    </span>
  );

  const contenido = esPunto ? (
    <>
      {palabra}
      {marca}
    </>
  ) : (
    <>
      {marca}
      {palabra}
    </>
  );

  const clases = cn(
    "inline-flex text-ink no-underline",
    // Con el símbolo como punto final, se apoya en la base del texto.
    esPunto ? "items-baseline" : "items-center",
    className,
  );

  if (!href) {
    return (
      <span className={clases} style={{ gap: `${separacion}px` }} aria-label="Inkey">
        {contenido}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label="Inkey, inicio"
      className={clases}
      style={{ gap: `${separacion}px` }}
    >
      {contenido}
    </Link>
  );
}
