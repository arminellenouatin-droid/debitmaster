import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { emitTenantNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    if (!tenantId || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });

    // Rappel quotidien d'échéance si <= 10 jours restants pour le promoteur
    const { data: company } = await context.supabase
      .from("companies")
      .select("id, name, owner_user_id, status, trial_ends_at, subscription_expires_at")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();

    if (company?.owner_user_id) {
      const cutoff = company.subscription_expires_at || company.trial_ends_at;
      if (cutoff) {
        const diffMs = new Date(cutoff).getTime() - Date.now();
        const daysRemaining = Math.ceil(diffMs / (1000 * 3600 * 24));
        if (daysRemaining <= 10 && daysRemaining >= 0 && !["SUSPENDED", "CANCELLED", "EXPIRED"].includes(String(company.status).toUpperCase())) {
          const todayDate = new Date().toISOString().slice(0, 10);
          const expiryDateFormatted = new Date(cutoff).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
          const subject = daysRemaining === 0
            ? "⚠️ Votre abonnement expire aujourd'hui"
            : `⚠️ Échéance abonnement : reste ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`;
          const body = `Rappel : L’abonnement de votre établissement « ${company.name} » arrive à expiration le ${expiryDateFormatted}. Renouvelez-le dès maintenant pour éviter toute coupure d'activité.`;

          await emitTenantNotification({
            tenantId,
            actorUserId: null,
            operatorUserIds: [company.owner_user_id],
            subject,
            body,
            eventType: "SUBSCRIPTION_EXPIRY_WARNING",
            actionPath: "/dashboard/subscription",
            dedupeKey: `sub-exp-warning:${tenantId}:${todayDate}`,
            metadata: { daysRemaining, cutoff },
          });
        }
      }
    }
    const { data, error } = await context.supabase
      .from("internal_messages")
      .select("id,subject,body,created_at,read_at,event_type,entity_id,action_path,action_permission,operator_user_id,metadata")
      .eq("tenant_id", tenantId)
      .eq("recipient_user_id", context.user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return NextResponse.json({ error: "Impossible de charger les notifications." }, { status: 500 });
    const notifications = (data ?? []).map((notification) => ({
      ...notification,
      action_allowed: Boolean(
        notification.action_path &&
        (!notification.operator_user_id || notification.operator_user_id === context.user?.id) &&
        (!notification.action_permission || can(context, notification.action_permission))
      ),
    }));
    return NextResponse.json({ count: notifications.length, notifications });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; notificationId?: string; markAllRead?: boolean };
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!body.tenantId || !context.tenantIds.includes(body.tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 400 });

    if (body.markAllRead) {
      const { error } = await context.supabase
        .from("internal_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("tenant_id", body.tenantId)
        .eq("recipient_user_id", context.user.id)
        .is("read_at", null);
      if (error) return NextResponse.json({ error: "Impossible de marquer les notifications comme lues." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!body.notificationId) return NextResponse.json({ error: "Notification requise." }, { status: 400 });
    const { error } = await context.supabase
      .from("internal_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", body.notificationId)
      .eq("tenant_id", body.tenantId)
      .eq("recipient_user_id", context.user.id)
      .is("read_at", null);
    if (error) return NextResponse.json({ error: "Impossible de marquer la notification comme lue." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
