# Plantillas de los mails de ingreso (Supabase)

Estos son los mails que manda **Supabase Auth**, no la app: el del link para
entrar y el de la primera vez. Los de la app (pagos, invitaciones, reseñas)
viven en `src/lib/email/plantillas.ts` y no se tocan desde acá.

## Cómo se cargan

Panel de Supabase → **Authentication → Emails → Templates**. Una pestaña por
plantilla. De cada archivo de esta carpeta:

- el **asunto** está en la primera línea, después de `Subject:`;
- el **cuerpo** es todo lo que sigue: copialo entero en el campo del mensaje.

## El encabezado

Nombre primero y símbolo después, a la derecha, como en todos los encabezados
(ver `docs/identidad.md`). El símbolo es un PNG servido por el sitio
(`{{ .SiteURL }}/brand/inkey-simbolo.png`), porque Gmail y Outlook no
muestran SVG. Entre `</span>` y `<img` no puede haber ni un espacio.

## Las variables

| Variable | Qué es |
| --- | --- |
| `{{ .ConfirmationURL }}` | El link que entra directo. |
| `{{ .Token }}` | El código de 6 dígitos. **Sin esto, el código no se manda.** |
| `{{ .SiteURL }}` | El dominio configurado como Site URL. |

El código de 6 dígitos y el link son dos caminos al mismo lugar, y los dos
tienen que estar: algunos servicios de correo abren los links solos para
revisarlos y los gastan antes de que la persona los toque. La pantalla para
escribir el código es `/ingresar`, después de pedir el mail.

## Las versiones en inglés

En `en/` están las mismas cinco plantillas traducidas.

Una advertencia que importa: **Supabase manda una sola plantilla para todo el
mundo**. No sabe en qué idioma usa la app cada persona —y en el mail de alta
todavía no hay cuenta ni preferencia guardada—, así que no puede elegir. Los
mails de la app (pagos, invitaciones, reseñas) sí salen en el idioma de quien
los recibe, porque los arma Inkey leyendo el perfil.

Entonces, con los dos idiomas prendidos, hay que elegir una:

- **castellano** (los archivos de esta carpeta), que es lo que conviene
  mientras la mayoría del tráfico sea de acá;
- **inglés** (`en/`), si algún día el público cambia.

Si hiciera falta que cada persona lo reciba en su idioma, habría que sacarle
a Supabase el envío de estos mails y mandarlos desde la app con Resend, como
los demás. No está hecho: es una decisión de producto, no una tarea pendiente.
