import "server-only";
import { cache } from "react";
import { hashearToken, pareceToken } from "@/lib/tokens";
import type { PerfilPublico } from "@/lib/domain/perfil";
import { createClient } from "@/lib/supabase/server";

/**
 * Trae el perfil público de un token.
 *
 * Va envuelto en `cache` para que la página y sus metadatos compartan una sola
 * llamada por request: si no, la visita se contaría dos veces.
 * La imagen de preview y el PDF piden con `contar: false`.
 */
export const perfilDelToken = cache(
  async (token: string, opciones: { contar?: boolean } = {}): Promise<PerfilPublico> => {
    if (!pareceToken(token)) return { estado: "inexistente" };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_profile", {
      p_token_hash: hashearToken(token),
      p_contar: opciones.contar ?? true,
    });

    if (error) {
      console.error("public_profile falló", error);
      return { estado: "inexistente" };
    }

    return data as PerfilPublico;
  },
);
