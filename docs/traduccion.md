# Decisiones de traducción

Cómo decimos en inglés lo que Inkey dice en castellano rioplatense.

No es un glosario de equivalencias: es un registro de decisiones. El objetivo
no fue traducir palabra por palabra sino que el inglés suene como suena Inkey
en castellano —cercano, claro, sin jerga inmobiliaria ni tono bancario— y que
diga lo mismo. Donde hizo falta, cambiamos la estructura de la frase.

La regla de tono está en `docs/identidad.md` §8 y vale igual para los dos
idiomas.

---

## Lo que manda

- El **castellano rioplatense** es el idioma de la casa. Si hay una diferencia
  entre las dos versiones de un texto legal, prevalece el castellano, y los
  dos textos en inglés lo dicen en su primera línea.
- La app **opera en Argentina**. Los montos van en pesos, los ajustes siguen
  índices argentinos y las fechas mantienen el orden de acá (día, mes, año)
  se lean en el idioma que se lean. Lo único que cambia con el idioma es el
  nombre del mes: "21 de septiembre de 2026" / "21 September 2026".
- Quien lee en inglés puede no saber que esto es una app argentina. El pie lo
  aclara antes de que cargue un alquiler.

---

## Los términos del producto

| Castellano | Inglés | Por qué |
| --- | --- | --- |
| dueño | **landlord** | Es la palabra de todos los días en inglés. "Owner" es más fría y se confunde con la propiedad del inmueble, no con el rol en el alquiler. |
| inquilino | **tenant** | Universal y neutra. "Renter" suena más informal pero es menos clara fuera de Estados Unidos. |
| alquiler (el contrato) | **lease** | "Rental" es ambiguo: puede ser el contrato, la propiedad o el acto de alquilar. "Lease" nombra el vínculo, que es de lo que habla Inkey. |
| alquiler (el monto) | **rent** | Cuando es la plata que se paga cada mes, no el contrato. |
| comprobante | **proof of payment** | "Receipt" es el recibo que emite Inkey al confirmar; el comprobante es lo que sube el inquilino. Mantenerlos distintos evita que se pisen. |
| recibo | **receipt** | El PDF que genera Inkey. |
| historial | **history** | Nunca "record" ni "score": no es una calificación. |
| perfil compartible | **shareable profile** | |
| barrio | **neighbourhood** | Grafía británica, por coherencia con el resto (ver más abajo). |

## Los dos botones que importan

La tarjeta de confirmación es el corazón del producto y su par de botones fue
la decisión más discutida.

| Castellano | Inglés | Por qué |
| --- | --- | --- |
| Recibido | **Received** | Probamos "Got it", que suena más cálido, pero se lee como "entendí" y no como "me llegó la plata". "Received" es llano, no bancario, y no se malinterpreta. |
| Todavía no me llegó | **It hasn't arrived yet** | Se mantiene la frase entera, no un "Not received". El sujeto es el dinero, no la persona: nadie queda acusado. |
| Todavía no (versión corta) | **Not yet** | Donde no entra la frase larga, como en la maqueta de la landing. |
| Falta que lo confirme | **Waiting to be confirmed** | En voz pasiva a propósito: no señala a nadie. |

## Lo que no se puede traducir literal

| Castellano | Inglés | Por qué |
| --- | --- | --- |
| "Y nadie queda **escrachado**" | "And nobody gets **publicly shamed**" | "Escrache" no tiene equivalente de una palabra. La idea —la exposición pública como castigo— se dice entera. |
| "Pagaste puntual durante años. **Ahora demostralo**." | "You've paid on time for years. **Now you can prove it**." | El imperativo en inglés suena a orden; el "you can" mantiene el envión sin mandar. |
| "Lo que cumpliste, **que quede escrito**." | "You kept your word. **Put it in writing**." | El "que quede" no existe en inglés. Se parte en dos frases, que además le da ritmo al cierre. |
| "Cero garantes nerviosos" | *(se eliminó)* | Dependía de entender el sistema argentino de garantías. La sección se rediseñó y la frase ya no está en ninguno de los dos idiomas. |
| "Tres pasos. Diez segundos por mes." | "Three steps. Ten seconds a month." | |

## El contexto argentino

Cuando una palabra nombra algo que solo existe acá, el inglés la explica en
lugar de buscarle un equivalente que no existe.

| Castellano | Inglés | Cómo se explica |
| --- | --- | --- |
| garantía (la persona) | **guarantor** | Quien responde por el inquilino. Cuando haga falta: "a guarantor — in Argentina landlords usually ask you to find someone who owns property to back your lease". |
| garantía (el requisito) | **guarantee** | El requisito en sí, no la persona. |
| garantía propietaria | **property-owner guarantor** | La forma más común acá: el garante tiene que ser dueño de un inmueble. |
| caución | **rent guarantee insurance** | Un seguro que reemplaza al garante. No es "deposit": no se entrega plata, se paga una póliza. |
| ICL | **ICL** | Se deja la sigla y se aclara: "the official rent index published by Argentina's central bank". |
| IPC | **IPC** | Igual: el índice de precios al consumidor. |
| Veraz | **credit bureau** | En castellano "Veraz" se entiende sola; en inglés se dice qué es, porque el nombre no significa nada afuera. |
| ajuste | **adjustment** | Con la aclaración, donde entra: "in Argentina rent is adjusted periodically against an official index". |

Ninguno de estos términos aparece todavía en la interfaz: viven en los textos
legales y en las ayudas de los formularios. Cuando aparezcan en pantalla, esta
tabla es la que manda.

## Inglés británico o americano

Grafía **británica** (neighbourhood, organisation), y fechas en orden día-mes-
año. No es una preferencia estética: es lo que menos fricción hace con un
lector argentino que escribe fechas así, y `en-GB` da exactamente ese orden.

## Cómo se ve todo esto en el código

- Ningún texto vive en el código: todo está en `messages/es.json` y
  `messages/en.json`, con las mismas claves. Un test falla si a uno le falta
  una que el otro tiene.
- Los plurales se escriben en el archivo de textos, no en el código, porque
  cada idioma los arma distinto. Los tests atraviesan clave más archivo, así
  que un plural mal escrito en cualquiera de los dos sale en rojo.
- Los mensajes de error viajan como claves desde el servidor y se traducen al
  mostrarse: una acción del servidor no sabe en qué idioma está mirando la
  persona.
