import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? "";
    const unreadOnly = searchParams.get("unread") === "true";

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("commerce_notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`recipient_user_id.is.null,recipient_user_id.eq.${context.user.id}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error } = await query;
    if (error) {
      console.error("[notifications.GET] error", error);
      return NextResponse.json({ error: "Impossible de charger les notifications." }, { status: 500 });
    }

    // Count unread
    const { count: unreadCount } = await admin
      .from("commerce_notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_read", false)
      .or(`recipient_user_id.is.null,recipient_user_id.eq.${context.user.id}`);

    return NextResponse.json({
      notifications: notifications ?? [],
      unreadCount: unreadCount ?? 0,
    });
  } catch (err) {
    console.error("[notifications.GET] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const notificationId = typeof body.notificationId === "string" ? body.notificationId : "";
    const markAll = body.all === true;

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    if (markAll) {
      const { error } = await admin
        .from("commerce_notifications")
        .update({ is_read: true })
        .eq("tenant_id", tenantId)
        .eq("is_read", false)
        .or(`recipient_user_id.is.null,recipient_user_id.eq.${context.user.id}`);

      if (error) {
        console.error("[notifications.PATCH markAll] error", error);
        return NextResponse.json({ error: "Impossible de marquer les notifications comme lues." }, { status: 500 });
      }

      return NextResponse.json({ message: "Toutes les notifications ont été marquées comme lues." });
    }

    if (!notificationId) {
      return NextResponse.json({ error: "ID de notification requis." }, { status: 400 });
    }

    const { error } = await admin
      .from("commerce_notifications")
      .update({ is_read: true })
      .eq("tenant_id", tenantId)
      .eq("id", notificationId);

    if (error) {
      console.error("[notifications.PATCH] error", error);
      return NextResponse.json({ error: "Impossible de mettre à jour la notification." }, { status: 500 });
    }

    return NextResponse.json({ message: "Notification marquée comme lue." });
  } catch (err) {
    console.error("[notifications.PATCH] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const type = ["INFO", "SUCCESS", "WARNING", "ALERT"].includes(body.type) ? body.type : "INFO";
    const link = typeof body.link === "string" ? body.link.slice(0, 255) : null;
    const targetRole = typeof body.targetRole === "string" ? body.targetRole : null;
    const recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId : null;
    const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {};

    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!title || !message) {
      return NextResponse.json({ error: "Titre et message requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: notif, error } = await admin
      .from("commerce_notifications")
      .insert({
        tenant_id: tenantId,
        title,
        message,
        type,
        link,
        target_role: targetRole,
        recipient_user_id: recipientUserId,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("[notifications.POST] error", error);
      return NextResponse.json({ error: "Impossible de créer la notification." }, { status: 500 });
    }

    return NextResponse.json({ notification: notif, message: "Notification créée." });
  } catch (err) {
    console.error("[notifications.POST] unexpected error", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
