import { IDIOMAS, IDIOMA_POR_DEFECTO, esIdioma, type Idioma } from "./routing";

/*
 * Qué idiomas están prendidos.
 *
 * `IDIOMAS` es el catálogo: todo lo que la app sabe hablar. `IDIOMAS_ACTIVOS`
 * es lo que está abierto al público hoy, y se cambia en Vercel sin tocar
 * código ni volver a deployar la traducción entera.
 *
 * Un idioma apagado no desaparece: sus direcciones redirigen al activo
 * conservando la ruta, así ningún link que alguien ya mandó da error. Y la
 * preferencia que la persona tenga guardada en su perfil se respeta cuando
 * ese idioma vuelva a prenderse.
 *
 * Siempre queda al menos uno. Si la variable viene vacía, mal escrita o con
 * idiomas que no existen, hablamos castellano: es mejor que una pantalla en
 * blanco.
 */

export function idiomasActivos(valor = process.env.IDIOMAS_ACTIVOS): Idioma[] {
  const pedidos = (valor ?? "")
    .split(",")
    .map((trozo) => trozo.trim().toLowerCase())
    .filter(esIdioma);

  // Se ordenan como el catálogo, no como los escribieron en la variable.
  const activos = IDIOMAS.filter((idioma) => pedidos.includes(idioma));
  return activos.length > 0 ? [...activos] : [IDIOMA_POR_DEFECTO];
}

export function estaActivo(idioma: string, valor?: string): boolean {
  return esIdioma(idioma) && idiomasActivos(valor).includes(idioma);
}

/**
 * El idioma al que va a parar quien pide uno apagado.
 *
 * El castellano si está prendido; si lo apagaron, el primero que quede.
 */
export function idiomaDeRespaldo(valor?: string): Idioma {
  const activos = idiomasActivos(valor);
  return activos.includes(IDIOMA_POR_DEFECTO) ? IDIOMA_POR_DEFECTO : activos[0];
}

/** Hay selector solo si hay entre qué elegir. */
export function haySeleccionDeIdioma(valor?: string): boolean {
  return idiomasActivos(valor).length > 1;
}
