// DebitManager notifications: badge, destinations profondes et action_allowed calculé côté serveur.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.view")) return NextResponse.json({ count: 0, notifications: [] });
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    if (!tenantId || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
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
      action_allowed: Boolean(notification.action_path && notification.operator_user_id === context.user?.id && (!notification.action_permission || (context.employeeId !== null && can(context, notification.action_permission)))),
    }));
    return NextResponse.json({ count: notifications.length, notifications });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; notificationId?: string };
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.view")) return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    if (!body.tenantId || !context.tenantIds.includes(body.tenantId) || !body.notificationId) return NextResponse.json({ error: "Notification invalide." }, { status: 400 });
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
