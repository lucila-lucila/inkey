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
(`{{ .SiteURL }}/brand/inkey-simbolo-medio.png`), porque Gmail y Outlook no
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
