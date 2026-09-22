import { getRequestConfig } from "next-intl/server";
import { estaActivo, idiomaDeRespaldo } from "./activos";

/*
 * Los textos que se cargan para cada request. Vienen de `messages/<idioma>.json`,
 * que es el único lugar donde vive el texto que lee la gente.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Un idioma apagado nunca llega hasta acá (el proxy ya redirigió), pero si
  // llegara, hablamos el que esté prendido antes que romper la pantalla.
  const pedido = await requestLocale;
  const locale = pedido && estaActivo(pedido) ? pedido : idiomaDeRespaldo();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    /*
     * La app opera en Argentina: los montos van en pesos y las fechas en
     * formato de acá, se lea en el idioma que se lea. Por eso el formato no
     * sigue al idioma.
     */
    timeZone: "America/Argentina/Buenos_Aires",
  };
});
