import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Tokens de invitación y de links compartibles.
 *
 * Se generan con 32 bytes aleatorios y de ellos guardamos SOLO el hash: el
 * token en claro existe únicamente en el link que recibe la persona. Si
 * alguien se lleva una copia de la base, no se lleva ningún link vivo.
 */

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashearToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Forma de un token válido, para descartar basura antes de tocar la base. */
export function pareceToken(valor: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(valor);
}

/** Comparación en tiempo constante, para cuando haga falta comparar hashes. */
export function hashesIguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** El link que recibe la persona invitada. */
export function enlaceInvitacion(token: string): string {
  return new URL(`/invitacion/${token}`, serverEnv.siteUrl).toString();
}

/**
 * Token de un link de perfil.
 *
 * A diferencia de una invitación, un link de perfil se comparte muchas veces:
 * la persona tiene que poder volver a copiarlo. Por eso no lo guardamos (ni en
 * claro ni hasheado a secas): lo derivamos del id del link con un HMAC y una
 * clave del servidor. De la base guardamos solo el hash del resultado, así que
 * con una copia de la base —sin la clave— no se puede armar ningún link vivo.
 */
export function tokenDeLink(idLink: string): string | null {
  const clave = serverEnv.shareLinkSecret;
  if (!clave) return null;
  return createHmac("sha256", clave).update(idLink).digest("base64url");
}

export function enlacePerfil(token: string): string {
  return new URL(`/p/${token}`, serverEnv.siteUrl).toString();
}
