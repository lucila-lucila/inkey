import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import type { Traductor } from "@/i18n/texto";

/*
 * Un traductor de verdad para los tests, con los archivos de mensajes del
 * repo. No es una imitación: es el mismo formateador que usa la app, así que
 * si un plural está mal escrito en un idioma, el test lo ve.
 */
const MENSAJES = { es, en };

export function traductor(idioma: "es" | "en"): Traductor {
  const t = createTranslator({ locale: idioma, messages: MENSAJES[idioma] });
  const envuelto = ((clave: string, valores?: Record<string, unknown>) =>
    t(clave as never, valores as never)) as Traductor;
  envuelto.has = (clave: string) => t.has(clave as never);
  return envuelto;
}
