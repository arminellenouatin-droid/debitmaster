import { NextResponse } from "next/server";
import { getCoutureContext } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

const validCategories = [
  "PURCHASE_APPROVAL",
  "LOW_STOCK",
  "PRODUCTION_ALERT",
  "ATTENDANCE_INCIDENT",
  "PAYROLL_READY",
  "QC_REJECTED",
  "GENERAL",
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("couture_notifications")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Impossible de charger les notifications." }, { status: 500 });
    }

    return NextResponse.json({ notifications: notifications ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    const category = validCategories.includes(body.category) ? body.category : "GENERAL";
    const severity = ["INFO", "WARNING", "URGENT"].includes(body.severity) ? body.severity : "INFO";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) : "";
    const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim().slice(0, 300) : null;
    const recipientRole = typeof body.recipientRole === "string" ? body.recipientRole.trim() : null;
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : null;

    if (!title || !message) {
      return NextResponse.json({ error: "Titre et message obligatoires." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: notif, error: insertErr } = await admin
      .from("couture_notifications")
      .insert({
        tenant_id: context.tenantId,
        recipient_user_id: body.recipientUserId || null,
        recipient_role: recipientRole,
        site_id: siteId,
        category,
        severity,
        title,
        message,
        link_url: linkUrl,
        is_read: false,
      })
      .select()
      .single();

    if (insertErr || !notif) {
      return NextResponse.json({ error: "Impossible de créer la notification." }, { status: 500 });
    }

    return NextResponse.json({ notification: notif }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
