// DebitManager notifications: émission serveur tenant-scoped, deep-linkée et dédupliquée par événement.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const GLOBAL_POSITIONS = ["SUPERVISEUR"] as const;

type NotificationInput = {
  tenantId: string;
  actorUserId?: string | null;
  subject: string;
  body: string;
  eventType: string;
  entityId?: string | null;
  actionPath: string;
  actionPermission?: string | null;
  operatorUserIds?: Array<string | null | undefined>;
  operatorPositions?: string[];
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
};

export async function emitTenantNotification(input: NotificationInput) {
  if (!input.tenantId || !input.subject || !input.body || !input.actionPath.startsWith("/")) return;
  const admin = createSupabaseAdminClient();
  const [{ data: company }, { data: globalEmployees }, { data: operators }] = await Promise.all([
    admin.from("companies").select("owner_user_id").eq("id", input.tenantId).is("deleted_at", null).maybeSingle(),
    admin.from("employees").select("user_id").eq("tenant_id", input.tenantId).in("position", [...GLOBAL_POSITIONS]).eq("status", "ACTIVE").is("deleted_at", null).limit(50),
    input.operatorPositions?.length ? admin.from("employees").select("user_id").eq("tenant_id", input.tenantId).in("position", input.operatorPositions).eq("status", "ACTIVE").is("deleted_at", null).limit(50) : Promise.resolve({ data: [] as Array<{ user_id: string | null }> }),
  ]);

  const recipientIds = new Set<string>();
  const globalRecipientIds = new Set<string>();
  const operatorIds = new Set<string>();
  for (const id of input.operatorUserIds ?? []) if (id) { recipientIds.add(id); operatorIds.add(id); }
  if (company?.owner_user_id) { recipientIds.add(company.owner_user_id); globalRecipientIds.add(company.owner_user_id); }
  for (const employee of globalEmployees ?? []) if (employee.user_id) { recipientIds.add(employee.user_id); globalRecipientIds.add(employee.user_id); }
  for (const employee of operators ?? []) if (employee.user_id) { recipientIds.add(employee.user_id); operatorIds.add(employee.user_id); }
  if (input.actorUserId && !globalRecipientIds.has(input.actorUserId)) recipientIds.delete(input.actorUserId);
  if (!recipientIds.size) return;

  const rows = [...recipientIds].map((recipientUserId) => ({
    tenant_id: input.tenantId,
    sender_user_id: input.actorUserId ?? recipientUserId,
    recipient_user_id: recipientUserId,
    subject: input.subject,
    body: input.body,
    event_type: input.eventType,
    entity_id: input.entityId ?? null,
    action_path: input.actionPath,
    action_permission: input.actionPermission ?? null,
    operator_user_id: operatorIds.has(recipientUserId) ? recipientUserId : null,
    dedupe_key: input.dedupeKey ? `${input.dedupeKey}:${recipientUserId}` : null,
    metadata: input.metadata ?? {},
  }));

  const { error } = await admin.from("internal_messages").upsert(rows, { onConflict: "tenant_id,dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error("Impossible d’émettre les notifications.");
}
