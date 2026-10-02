import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditMetadataValue = string | number | boolean | null | AuditMetadataValue[] | { [key: string]: AuditMetadataValue };

type CoutureAuditInput = {
  tenantId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, AuditMetadataValue>;
};

export async function writeCoutureAuditEvent(input: CoutureAuditInput): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("couture_audit_events").insert({
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("[couture.audit] insert failed", { code: error.code });
  return !error;
}
