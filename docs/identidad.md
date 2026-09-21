# Inkey — identidad de marca y actualización visual

Documento para Claude Code. Reemplaza la identidad provisoria de la Fase 1 por la definitiva. **No cambia ninguna funcionalidad**: solo tokens, componentes, logo y textos de interfaz.

---

## 1. La marca en una línea

Inkey es el historial de alquiler que confirman entre inquilino y dueño. La marca se llama **Vecindario**: dos personas que se arreglan bien. Cálida, cercana y confiable, nunca bancaria ni corporativa.

Tres reglas que gobiernan todo lo visual:

- **Cálido antes que serio.** Fondos crema, formas redondeadas, nada de gris azulado ni azul institucional.
- **El verde solo significa confirmado.** Nunca es decorativo ni el color de marca.
- **Nada acusa a nadie.** No existe el rojo de error para la conducta de las personas: un mes sin confirmar es neutro, no una alarma.

---

## 2. Tokens de color

Reemplazá el contenido de `src/styles/tokens.css` por estos valores, conservando la forma en que ya están expuestos como utilidades de Tailwind v4.

### Modo claro

| Token | Hex | Uso |
| --- | --- | --- |
| `bg` | `#FFF6EA` | Fondo de página |
| `surface` | `#FFFFFF` | Tarjetas y superficies elevadas |
| `surface-sunk` | `#F1E7D8` | Botón secundario, campos, zonas hundidas |
| `ink` | `#23201C` | Texto principal |
| `body` | `#57504A` | Texto secundario |
| `muted` | `#8B8179` | Etiquetas, metadatos |
| `line` | `#E6DACA` | Bordes y separadores |
| `primary` | `#B8451A` | Color de marca y acción principal |
| `primary-soft` | `#F7E2D6` | Fondo de estados de marca |
| `primary-ink` | `#8E340F` | Texto sobre `primary-soft` |
| `confirm` | `#2F7A5F` | Confirmado, acción del dueño |
| `confirm-soft` | `#E8F0EB` | Fondo de estado confirmado |
| `confirm-ink` | `#24614B` | Texto sobre `confirm-soft` |
| `sun` | `#F2D06B` | Destaque, avatares, métricas |

### Modo oscuro

Mismos nombres de token, activados por `prefers-color-scheme` como ya está implementado.

| Token | Hex |
| --- | --- |
| `bg` | `#1A1815` |
| `surface` | `#262320` |
| `surface-sunk` | `#322E29` |
| `ink` | `#F5EFE4` |
| `body` | `#C2B9AC` |
| `muted` | `#9A9084` |
| `line` | `#3B362F` |
| `primary` | `#E59B78` |
| `primary-soft` | `#3A241A` |
| `primary-ink` | `#F0BFA4` |
| `confirm` | `#7FC3A6` |
| `confirm-soft` | `#1C2E26` |
| `confirm-ink` | `#A5D9C2` |
| `sun` | `#E8C765` |

Reglas de uso:

- Un botón `primary` lleva texto `#FFF6EA`; un botón `confirm` lleva texto blanco.
- `sun` **nunca** lleva texto blanco encima: siempre `ink`.
- En modo oscuro, `primary` y `confirm` se usan como texto o como fondo de pastillas suaves, no como fondo de botones grandes (ahí van con el tono del modo claro y texto oscuro).

---

## 3. Tipografía

Dos familias, ambas de Google Fonts, cargadas con el mismo `<link>` que ya usa el proyecto (no `next/font`: ya está documentado por qué).

- **Display: Bricolage Grotesque**, pesos 700 y 800. Títulos, números grandes, el logotipo.
- **Texto: DM Sans**, pesos 400, 500 y 700. Todo lo demás.

Se eliminan Fraunces e Instrument Sans.

| Rol | Familia | Tamaño / interlínea | Tracking |
| --- | --- | --- | --- |
| Display | Bricolage 800 | 52 / 1.02 (móvil 40) | -1.8px |
| Título | Bricolage 800 | 34 / 1.08 | -1.1px |
| Subtítulo | Bricolage 700 | 22 / 1.2 | -0.4px |
| Cuerpo | DM Sans 400 | 17 / 1.6 | 0 |
| Secundario | DM Sans 400 | 15 / 1.5 | 0 |
| Etiqueta | DM Sans 700 | 13, mayúsculas | 1.2px |
| Números | Bricolage 700 | 30–34 | -0.5px |

Nunca por debajo de 15px en texto corrido. Los montos siempre en la familia display.

---

## 4. Forma y espacio

- **Radios:** 12 chips y pastillas chicas, 16 campos y bloques internos, 24 tarjetas, 999 botones.
- **Espaciado:** múltiplos de 4; 24 y 28 son los respiros habituales dentro de tarjetas.
- **Sin sombras proyectadas y sin la sombra dura de la versión anterior.** Las tarjetas se separan por color de fondo: `surface` sobre `bg`.
- **Bordes:** solo donde hacen falta (campos, separadores), con `line`. Las tarjetas no llevan borde.
- **Objetivos táctiles:** mínimo 44px de alto, como ya está.

---

## 5. Logo

Dos llaves enganchadas, en trazo, con las paletas hacia lados opuestos. Se implementa como un componente `Logo` con una prop de tamaño.

Geometría: R es el radio del aro; los centros están a 1R; las paletas miden 2R; el trazo es 0,3R; el aire mínimo alrededor es 1R.

**Versión completa** (a partir de 120px de ancho):

```html
<svg viewBox="0 0 124 52" fill="none" role="img" aria-label="Inkey">
  <circle cx="52" cy="26" r="15" stroke="var(--primary)" stroke-width="4.5"/>
  <path d="M37 26H6M14 26v-8M23.5 26v-5.5" stroke="var(--primary)" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="68" cy="26" r="15" stroke="var(--confirm)" stroke-width="4.5"/>
  <path d="M83 26h31M106 26v8M96.5 26v5.5" stroke="var(--confirm)" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M49.40 11.23A15 15 0 0 1 66.10 20.87" stroke="var(--primary)" stroke-width="4.5"/>
</svg>
```

**El cruce: dos eslabones de verdad.** El último `path` es un tramo del aro izquierdo que se dibuja por encima del derecho, así que **arriba pasa por delante la llave terracota y abajo la verde**. Es el mismo arco en las tres versiones: lo único que cambia con el tamaño es el grosor del trazo.

**Versión media** (40–120px): mismo dibujo con `stroke-width="6"`, un solo diente por llave (`M37 26H14M21 26v-7` y `M83 26h23M99 26v7`).

**Versión mínima** (menos de 40px, favicon): `stroke-width="8"`, sin dientes (`M37 26H18` y `M83 26h19`).

**Lockup del header:** el wordmark manda y el símbolo va a la derecha, ocupando el lugar del punto final. **Es el de todos los encabezados, sin excepción**: landing, panel, perfil, perfil público, ingreso, onboarding, invitación, el encabezado de los mails —los de la app y los de ingreso— y cualquier pantalla nueva. El orden es siempre nombre primero, símbolo después.

- El wordmark es el elemento dominante: bien más grande que en el otro lockup.
- El símbolo **no crece con el wordmark**: es un remate chico, de alrededor de **dos quintos de la altura de las mayúsculas** del wordmark.
- Va **apoyado en la línea de base del texto**, no centrado.
- La separación entre el final de la palabra y el símbolo es de **medio radio**: bien ajustada, como un punto.
- Se dibuja en **versión media** (un diente por llave): al lado del texto, dos dientes hacen ruido.
- El símbolo se recorta al contorno real del dibujo, sin el aire del `viewBox`, o esa separación de medio radio se pierde.

**Lockup con el símbolo a la izquierda:** símbolo a la izquierda, wordmark "inkey" en Bricolage 800 con tracking -1.6px, separados por 1R. El wordmark va en `ink`. Se usa **solo fuera de los encabezados**: pie, recibo y perfil en PDF.

**El archivo de marca:** la geometría de la versión media vive en
`public/brand/inkey-simbolo-medio.svg`, con la caja ajustada `10.5 7.5 99 37`
(los extremos reales del dibujo, contando el trazo, más medio punto de aire).
El componente `Logo` usa exactamente esa geometría y un test lo compara contra
el archivo, para que la marca no se parta en dos. La única diferencia a
propósito es el color: el archivo lo trae fijo, porque se usa donde no hay
variables CSS (mails), y el componente usa los tokens, para que el modo oscuro
funcione.

**En los mails**, donde no se puede dibujar un SVG (Gmail y Outlook no lo
muestran), el símbolo del encabezado es `inkey-simbolo-medio.png`, exportado
del mismo archivo: se muestra a 24 × 9 px al lado de un wordmark de 28px, con
`vertical-align: baseline` y 2px de separación. Entre la palabra y la imagen no
puede quedar ni un espacio en el HTML: se dibuja y rompe el remate.

**Una sola tinta:** ambos trazos del mismo color. Como el cruce no se lee por color, cada aro que queda atrás se interrumpe con una **muesca corta** del color del fondo, de ancho `stroke-width + 4`, y el orden de los eslabones es el mismo que con dos tintas:

- en el cruce de **abajo** se muesca el aro izquierdo (`M62.83 36.38A15 15 0 0 1 56.69 40.25`), porque ahí pasa por delante la llave derecha;
- en el de **arriba** se muesca el aro derecho (`M57.17 15.62A15 15 0 0 1 63.31 11.75`), porque ahí pasa la izquierda.

Cada muesca cubre unos 14° a cada lado del punto de cruce: lo justo para que se vea la separación sin comerse el aro.

**Favicon y app icon:** símbolo mínimo en `#FFF6EA` y `#F2D06B` sobre cuadrado `ink` con radio 26.

---

## 6. Iconografía

Íconos de trazo, ancho 2.2, puntas y uniones redondeadas, mismo peso visual que el logo. Sin íconos rellenos, sin librerías de íconos con estilos mezclados y **sin emojis en la interfaz**. El check de confirmación es el mismo path que ya se usa.

---

## 7. Estados

| Estado | Fondo | Texto |
| --- | --- | --- |
| Confirmado | `confirm-soft` | `confirm-ink` |
| Esperando al dueño | `primary-soft` | `primary-ink` |
| Sin confirmar | `surface-sunk` | `body` |
| Métrica destacada | `sun` | `ink` |

"Sin confirmar" es deliberadamente neutro. Nunca rojo, nunca ícono de alerta, nunca lenguaje de incumplimiento.

---

## 8. Tono de voz en la interfaz

Voseo siempre, frases cortas, sin jerga inmobiliaria ni tono bancario.

| Así sí | Así no |
| --- | --- |
| "Listo, quedó confirmado." | "Operación procesada con éxito." |
| "Mandale el link a tu dueño." | "Invite al propietario del inmueble." |
| "Nadie ve esto sin tu permiso." | "Sus datos están protegidos." |
| "Todavía no lo confirmó." | "Pago no verificado." |

Los errores explican qué pasó y qué hacer, sin culpar a la persona: "No se pudo guardar. Probá de nuevo en un momento."

La tarjeta de acción sigue siempre este orden: quién, cuánto, cuándo, qué hacer. El botón que confirma va primero y en `confirm`.

---

## 9. Qué hacer, en orden

1. Reescribir `src/styles/tokens.css` con la paleta nueva (claro y oscuro) y su mapeo en Tailwind. Los nombres de token cambian, así que actualizá todos los usos.
2. Cambiar las fuentes a Bricolage Grotesque + DM Sans y aplicar la escala tipográfica de arriba.
3. Ajustar los componentes base: sacar la sombra dura de `Card`, pasar los botones a radio completo, revisar `Pill`, `Stat`, `Badge` y `Avatar` con los estados nuevos.
4. Crear el componente `Logo` con las tres versiones por tamaño y el lockup, y usarlo en el header, el pie y las pantallas de ingreso e invitación. Actualizar favicon y `apple-touch-icon`.
5. Aplicar todo a la landing, al panel, al alta de alquiler, a la invitación y al ingreso.
6. Revisar contraste: todo el texto a 4.5:1 como mínimo (3:1 de 24px para arriba), en los dos modos.
7. Pasar los textos de interfaz por la tabla de tono de voz, incluidos los mensajes de error.
8. Actualizar los tests que verifiquen tokens o textos, y anotar el cambio de identidad en `docs/decisiones.md`.

Trabajá en el mismo orden y frená al terminar para mostrarme cómo quedó antes de seguir con la Fase 3.
