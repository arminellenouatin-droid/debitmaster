// DebitManager notifications: badge non lu tenant-scoped, sans exposer les messages d’un autre utilisateur.
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
      .select("id,subject,body,created_at,read_at")
      .eq("tenant_id", tenantId)
      .is("read_at", null)
      .or(`recipient_user_id.eq.${context.user.id},recipient_user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: "Impossible de charger les notifications." }, { status: 500 });
    return NextResponse.json({ count: data?.length ?? 0, notifications: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}
