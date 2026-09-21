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

Geometría: R es el radio del aro; los centros están a 1R; las paletas miden 2R; el aire mínimo alrededor es 1R.

**Una sola forma, para todos los tamaños.** Sin dientes y con `stroke-width="8"`. Antes había tres versiones (completa, media y mínima) y la que quedó es la que antes era la mínima: a cualquier tamaño se lee igual, y una forma sola es una marca sola.

```html
<svg viewBox="13.5 6.5 93 39" fill="none" role="img" aria-label="Inkey">
  <g stroke-width="8">
    <g stroke="var(--primary)">
      <circle cx="52" cy="26" r="15"/>
      <path d="M37 26H18" stroke-linecap="round"/>
    </g>
    <g stroke="var(--confirm)">
      <circle cx="68" cy="26" r="15"/>
      <path d="M83 26h19" stroke-linecap="round"/>
    </g>
    <path d="M49.40 11.23A15 15 0 0 1 66.10 20.87" stroke="var(--primary)"/>
  </g>
</svg>
```

**Los colores: la primera llave terracota y la segunda verde, en todos los usos.** En pantalla salen de los tokens `primary` y `confirm`, así que el modo oscuro los aclara solo:

| | Primera llave | Segunda llave |
| --- | --- | --- |
| Modo claro | `#B8451A` (`primary`) | `#2F7A5F` (`confirm`) |
| Modo oscuro | `#E59B78` | `#7FC3A6` |

**La excepción del verde.** En toda la interfaz el verde significa *confirmado*: nunca es decorativo ni el color de marca. **El logo es la única excepción**, y es deliberada: las dos llaves son dos partes, y que cada una tenga su color es lo que cuenta de qué se trata el producto. Fuera del logo, la regla no se toca.

**El cruce: dos eslabones de verdad.** El último `path` es un tramo del aro izquierdo que se dibuja por encima del derecho, así que **arriba pasa por delante la llave terracota y abajo la verde**.

**Una sola tinta.** Cuando no hay dos colores disponibles (el pie, un sello, una impresión a un color), el cruce no se lee por color: cada aro de atrás se **recorta** con un `clipPath` —un rectángulo con un hueco, en regla `evenodd`, que muerde el aro justo en el cruce— y se respeta el mismo orden de eslabones. A diferencia de tapar con el color del fondo, el recorte funciona sobre cualquier fondo. El color se cambia con el `stroke`. Vive en `public/brand/inkey-simbolo-una-tinta.svg`.

Si hay más de un logo en la misma página, los ids del `clipPath` tienen que ser únicos: si se repiten, `url(#...)` se queda con el primero. En el componente el id lo pone quien lo usa (`unaTinta={{ color, id }}`) y el tipo lo exige, así la unicidad queda a la vista de quien escribe la pantalla en vez de depender de un contador escondido.

**Lockup del header:** el wordmark manda y el símbolo va a la derecha, ocupando el lugar del punto final. **Es el de todos los encabezados, sin excepción**: landing, panel, perfil, perfil público, ingreso, onboarding, invitación, el encabezado de los mails —los de la app y los de ingreso— y cualquier pantalla nueva. El orden es siempre nombre primero, símbolo después.

- El wordmark es el elemento dominante: bien más grande que en el otro lockup.
- El símbolo **no crece con el wordmark**: es un remate chico, de alrededor de **dos quintos de la altura de las mayúsculas** del wordmark.
- Va **apoyado en la línea de base del texto**, no centrado.
- La separación entre el final de la palabra y el símbolo es de **medio radio**: bien ajustada, como un punto.
- El símbolo se recorta al contorno real del dibujo, sin el aire del `viewBox`, o esa separación de medio radio se pierde.

**Lockup con el símbolo a la izquierda:** símbolo a la izquierda, wordmark "inkey" en Bricolage 800 con tracking -1.6px, separados por 1R. El wordmark va en `ink`. Se usa **solo fuera de los encabezados**: pie, recibo y perfil en PDF.

**El archivo de marca:** la geometría vive en `public/brand/inkey-simbolo.svg`,
con la caja ajustada `13.5 6.5 93 39` (los extremos reales del dibujo, contando
el trazo, más medio punto de aire). El componente `Logo` usa exactamente esa
geometría y un test lo compara contra el archivo, para que la marca no se parta
en dos. La única diferencia a propósito es el color: el archivo lo trae fijo,
porque se usa donde no hay variables CSS (mails), y el componente usa los
tokens, para que el modo oscuro funcione solo.

**En los mails**, donde no se puede dibujar un SVG (Gmail y Outlook no lo
muestran), el símbolo del encabezado es `inkey-simbolo.png`, exportado
del mismo archivo: se muestra a 24 × 10 px al lado de un wordmark de 28px, con
`vertical-align: baseline` y 2px de separación. Entre la palabra y la imagen no
puede quedar ni un espacio en el HTML: se dibuja y rompe el remate.

**Favicon y app icon:** el símbolo en los tonos del modo oscuro (`#E59B78` y `#7FC3A6`) sobre un cuadrado `ink` (`#23201C`) con radio 26. Los colores van fijos: un favicon no ve las variables CSS.

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
