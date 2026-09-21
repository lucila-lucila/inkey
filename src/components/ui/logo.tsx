import Link from "next/link";
import { cn } from "@/lib/cn";

/*
 * Dos llaves enganchadas, en trazo, con las paletas hacia lados opuestos
 * (ver docs/identidad.md).
 *
 * Una sola forma para todos los tamaños: sin dientes y con trazo 8. El dibujo
 * es exactamente el de `public/brand/inkey-simbolo.svg`, y un test compara los
 * dos para que no se separen.
 *
 * Geometría: R = 15 (radio del aro), centros a 1R, paletas de 2R, trazo 8.
 */

/** Los extremos reales del dibujo (contando el trazo) más medio punto de aire. */
const CAJA = { viewBox: "13.5 6.5 93 39", ancho: 93, alto: 39 };
const TRAZO = 8;
const RADIO = 15;

const PALETA_IZQUIERDA = "M37 26H18";
const PALETA_DERECHA = "M83 26h19";

/*
 * El cruce, como dos eslabones de verdad: arriba pasa por delante la llave
 * izquierda y abajo la derecha. `ARCO_DE_ADELANTE` es un tramo del aro
 * izquierdo que se dibuja último, así queda por encima en el cruce de arriba;
 * el de abajo sale solo, porque el aro derecho se dibuja después del izquierdo.
 */
const ARCO_DE_ADELANTE = "M49.40 11.23A15 15 0 0 1 66.10 20.87";

/*
 * Con una sola tinta el cruce no se lee por color. Ahí cada aro de atrás se
 * recorta con un clip: un rectángulo grande con un hueco (regla evenodd) que
 * muerde el aro justo en el cruce. A diferencia de tapar con el color del
 * fondo, esto funciona sobre cualquier fondo.
 */
const CLIP_IZQUIERDA =
  "M-20 -20H140V80H-20ZM70.05 46.20A20.3 20.3 0 0 1 48.90 32.88L58.87 29.29A9.7 9.7 0 0 0 68.98 35.65Z";
const CLIP_DERECHA =
  "M-20 -20H140V80H-20ZM49.95 5.80A20.3 20.3 0 0 1 71.10 19.12L61.13 22.71A9.7 9.7 0 0 0 51.02 16.35Z";

/**
 * Una sola tinta.
 *
 * El `id` lo pone quien lo usa, y tiene que ser único en la página: si dos
 * logos comparten el id del recorte, `url(#...)` se queda con el primero. No se
 * genera acá a propósito: un contador de módulo sería estado mutable durante el
 * render (se rompe con render concurrente) y un valor al azar no sobreviviría a
 * la hidratación. Pedirlo deja la unicidad a la vista de quien escribe la
 * pantalla.
 */
export type UnaTinta = { color: string; id: string };

export function Simbolo({
  ancho = 93,
  className,
  unaTinta,
  titulo,
}: {
  ancho?: number;
  className?: string;
  unaTinta?: UnaTinta;
  titulo?: string;
}) {
  const colorIzquierda = unaTinta?.color ?? "var(--primary)";
  const colorDerecha = unaTinta?.color ?? "var(--confirm)";

  const id = unaTinta ? `inkey-${unaTinta.id}` : "";

  return (
    <svg
      viewBox={CAJA.viewBox}
      width={ancho}
      height={(ancho * CAJA.alto) / CAJA.ancho}
      fill="none"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      className={className}
    >
      {unaTinta && (
        <defs>
          <clipPath id={`${id}-a`}>
            <path clipRule="evenodd" fillRule="evenodd" d={CLIP_IZQUIERDA} />
          </clipPath>
          <clipPath id={`${id}-b`}>
            <path clipRule="evenodd" fillRule="evenodd" d={CLIP_DERECHA} />
          </clipPath>
        </defs>
      )}

      <g clipPath={unaTinta ? `url(#${id}-a)` : undefined}>
        <circle cx="52" cy="26" r={RADIO} stroke={colorIzquierda} strokeWidth={TRAZO} />
        <path
          d={PALETA_IZQUIERDA}
          stroke={colorIzquierda}
          strokeWidth={TRAZO}
          strokeLinecap="round"
        />
      </g>

      <g clipPath={unaTinta ? `url(#${id}-b)` : undefined}>
        <circle cx="68" cy="26" r={RADIO} stroke={colorDerecha} strokeWidth={TRAZO} />
        <path d={PALETA_DERECHA} stroke={colorDerecha} strokeWidth={TRAZO} strokeLinecap="round" />
      </g>

      {/* Con dos tintas, el cruce de arriba lo resuelve este arco por encima. */}
      {!unaTinta && (
        <path d={ARCO_DE_ADELANTE} stroke={colorIzquierda} strokeWidth={TRAZO} />
      )}
    </svg>
  );
}

/*
 * Dos medidas por tamaño, según el lockup:
 *   - `pie`: símbolo a la izquierda, wordmark a 1R;
 *   - `header`: wordmark grande y símbolo chico de remate.
 * En el header el símbolo NO crece con el wordmark: es un punto final, de
 * alrededor de dos quintos de la altura de las mayúsculas.
 */
const TAMANIOS = {
  sm: { simboloPie: 72, fuentePie: 22, fuenteHeader: 34, simboloHeader: 23 },
  lg: { simboloPie: 93, fuentePie: 28, fuenteHeader: 44, simboloHeader: 30 },
} as const;

/**
 * Lockup.
 *
 * - `punto` (por defecto): wordmark grande y el símbolo chico a la derecha,
 *   apoyado en la base del texto, ocupando el lugar del punto final. Es el de
 *   TODOS los encabezados, del sitio, de la app y de los mails. Es el valor por
 *   defecto a propósito, para que una pantalla nueva no pueda quedar con el
 *   orden viejo.
 * - `simbolo-izquierda`: símbolo a la izquierda y wordmark a 1R. Solo para lo
 *   que no es encabezado: pie, recibo y perfil en PDF.
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
  unaTinta?: UnaTinta;
  variante?: "simbolo-izquierda" | "punto";
}) {
  const medidas = TAMANIOS[size];
  const esPunto = variante === "punto";

  const fuenteUsada = esPunto ? medidas.fuenteHeader : medidas.fuentePie;
  const anchoSimbolo = esPunto ? medidas.simboloHeader : medidas.simboloPie;

  // 1R de aire en el lockup del pie; medio radio cuando hace de punto final.
  const radio = (RADIO * anchoSimbolo) / CAJA.ancho;
  const separacion = esPunto ? radio / 2 : radio;

  const marca = <Simbolo ancho={anchoSimbolo} unaTinta={unaTinta} />;

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
