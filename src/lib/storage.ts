import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const BUCKET_DOCUMENTOS = "documentos";
export const TAMANIO_MAXIMO = 10 * 1024 * 1024; // 10 MB

const TIPOS_PERMITIDOS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type TipoPermitido = keyof typeof TIPOS_PERMITIDOS;

/**
 * Mira los primeros bytes del archivo en vez de confiar en lo que dice el
 * navegador: un .exe renombrado a .pdf no pasa.
 */
export function detectarTipoReal(bytes: Uint8Array): TipoPermitido | null {
  const empiezaCon = (...esperado: number[]) =>
    esperado.every((byte, indice) => bytes[indice] === byte);

  if (empiezaCon(0x25, 0x50, 0x44, 0x46)) return "application/pdf"; // %PDF
  if (empiezaCon(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (empiezaCon(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (
    empiezaCon(0x52, 0x49, 0x46, 0x46) && // RIFF
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

export type ResultadoArchivo =
  | { ok: true; ruta: string }
  | { ok: false; mensaje: string };

/**
 * Sube un documento del alquiler. La ruta es <rental_id>/<archivo>: de ahí
 * sacan las políticas de Storage quiénes pueden verlo.
 * Sube con la sesión de la persona, así que RLS decide igual que en la base.
 */
export async function subirDocumento(opciones: {
  rentalId: string;
  archivo: File;
  prefijo: string;
}): Promise<ResultadoArchivo> {
  const { rentalId, archivo, prefijo } = opciones;

  if (archivo.size === 0) return { ok: false, mensaje: "El archivo está vacío." };
  if (archivo.size > TAMANIO_MAXIMO) {
    return { ok: false, mensaje: "El archivo pesa más de 10 MB. Probá con uno más liviano." };
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = detectarTipoReal(bytes);
  if (!tipo) {
    return { ok: false, mensaje: "Se puede subir PDF, JPG, PNG o WEBP." };
  }

  const ruta = `${rentalId}/${prefijo}-${randomBytes(8).toString("hex")}.${TIPOS_PERMITIDOS[tipo]}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(ruta, bytes, {
    contentType: tipo,
    upsert: false,
  });

  if (error) {
    console.error("No se pudo subir el documento", error);
    return { ok: false, mensaje: "No pudimos subir el archivo. Probá de nuevo." };
  }

  return { ok: true, ruta };
}

/**
 * URL firmada de vida corta. Solo la consigue quien puede leer el objeto, o
 * sea las dos partes del alquiler.
 */
export async function urlFirmada(ruta: string, segundos = 60): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(ruta, segundos);

  if (error) {
    console.error("No se pudo firmar la URL del documento", error);
    return null;
  }
  return data.signedUrl;
}
