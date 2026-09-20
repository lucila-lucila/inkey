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

export const MENSAJES_RESENA: Record<string, string> = {
  sin_sesion: "Volvé a entrar para seguir.",
  no_encontrado: "No encontramos ese alquiler.",
  no_esta_activo: "Este alquiler no está activo.",
  no_esta_terminando: "Este alquiler no está esperando que confirmen el fin.",
  lo_propusiste_vos: "Lo propusiste vos: lo tiene que confirmar la otra parte.",
  todavia_no_termino: "Las reseñas se escriben cuando el contrato termina.",
  sin_contraparte: "Este alquiler no tiene a la otra parte confirmada.",
  vacia: "Elegí al menos una etiqueta o escribí algo.",
  texto_largo: "El texto no puede pasar de 500 caracteres.",
  etiqueta_invalida: "Esa etiqueta no corresponde a esta reseña.",
  ya_la_dejaste: "Ya dejaste tu reseña de este alquiler.",
};
