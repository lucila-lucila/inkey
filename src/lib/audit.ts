import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type EntradaAuditoria = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Registra una acción sensible. Escribe con service role: la bitácora no
 * puede depender de que el cliente quiera anotarse.
 * Nunca guardes datos personales de más en `metadata`.
 */
export async function registrarAuditoria(entrada: EntradaAuditoria): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) {
      console.warn(
        `[inkey] Sin SUPABASE_SERVICE_ROLE_KEY no se registra la bitácora (${entrada.action}).`,
      );
      return;
    }

    const { error } = await supabase.from("audit_log").insert({
      actor_id: entrada.actorId ?? null,
      action: entrada.action,
      entity_type: entrada.entityType,
      entity_id: entrada.entityId ?? null,
      metadata: entrada.metadata ?? {},
    });

    if (error) {
      console.error("No se pudo escribir en audit_log", { action: entrada.action, error });
    }
  } catch (error) {
    // La bitácora nunca puede voltear lo que la persona vino a hacer.
    console.error("La bitácora falló de forma inesperada", { action: entrada.action, error });
  }
}
