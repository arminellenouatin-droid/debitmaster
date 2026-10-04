// DebitMaster API: Récupération rapide du nombre de messages non lus pour l'utilisateur dans l'établissement courant.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { user, tenantIds } = context;

    if (!user) {
      return NextResponse.json({ unreadCount: 0 });
    }
    if (!can(context, "messages.view")) {
      return NextResponse.json({ unreadCount: 0 });
    }
    if (!tenantId || !tenantIds.includes(tenantId)) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const admin = createSupabaseAdminClient();

    // Compter les messages non lus reçus par cet utilisateur dans ce tenant
    const { count, error } = await admin
      .from("internal_messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .is("deleted_at", null);

    if (error) {
      // Table peut ne pas exister ou erreur silencieuse
      return NextResponse.json({ unreadCount: 0 });
    }

    return NextResponse.json({ unreadCount: count ?? 0 });
  } catch {
    return NextResponse.json({ unreadCount: 0 });
  }
}
