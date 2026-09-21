import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

/**
 * Cliente de Resend. Devuelve null si no está configurado: mandar un mail es
 * una tarea secundaria y nunca puede voltear lo que la persona vino a hacer.
 */
export function createEmailClient(): Resend | null {
  const clave = serverEnv.resendApiKey;
  if (!clave) return null;
  return new Resend(clave);
}

/**
 * De qué dirección salen los mails. Se configura por entorno porque el dominio
 * propio se verifica después: mientras tanto sirve el remitente de prueba de
 * Resend (que solo puede escribirle a tu propia casilla).
 */
export function remitente(): string {
  return serverEnv.emailFrom;
}
