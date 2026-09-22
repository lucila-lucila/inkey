export type Direccion = "tenant_to_owner" | "owner_to_tenant";

export type EtiquetaResena = {
  code: string;
  direction: Direccion;
  label: string;
};

export type ResenaPropia = {
  id: string;
  text: string | null;
  tags: string[];
  created_at: string;
  published_at: string | null;
  direction: Direccion;
};

export type ResenaPublica = {
  texto: string | null;
  etiquetas: string[];
  fecha: string;
  de: string;
};

export const TOPE_TEXTO_RESENA = 500;

/** Cuántos días esperamos antes de publicar una reseña sola. */
export const DIAS_PARA_PUBLICAR = 14;

export function direccionDe(soyInquilino: boolean): Direccion {
  return soyInquilino ? "tenant_to_owner" : "owner_to_tenant";
}

/**
 * Cuándo se publica una reseña que todavía está sola: a los 14 días del fin
 * del contrato.
 */
export function fechaDePublicacion(finDelContrato: string): Date {
  const fin = new Date(finDelContrato);
  fin.setDate(fin.getDate() + DIAS_PARA_PUBLICAR);
  return fin;
}

/*
 * Los códigos que devuelven las funciones de reseñas. El texto de cada uno
 * vive en `dominio.mensajeResena`.
 */
export const MENSAJES_RESENA = [
  "sin_sesion",
  "no_encontrado",
  "no_esta_activo",
  "no_esta_terminando",
  "lo_propusiste_vos",
  "todavia_no_termino",
  "sin_contraparte",
  "vacia",
  "texto_largo",
  "etiqueta_invalida",
  "ya_la_dejaste",
] as const;
