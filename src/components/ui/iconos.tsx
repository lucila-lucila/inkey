/*
 * Íconos de trazo, con el mismo ancho y las mismas puntas redondeadas que el
 * logo: en la marca todo está dibujado con la misma pluma.
 */

type Props = { size?: number; className?: string };

function Trazo({ size = 22, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Candado: lo que solo abre quien tiene la llave. */
export function CandadoIcon(props: Props) {
  return (
    <Trazo {...props}>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Trazo>
  );
}

/** Escudo: lo que no entra. */
export function EscudoIcon(props: Props) {
  return (
    <Trazo {...props}>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z" />
    </Trazo>
  );
}

/** Flecha de los links de texto: acompaña, no empuja. */
export function FlechaIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={className}>
      →
    </span>
  );
}
