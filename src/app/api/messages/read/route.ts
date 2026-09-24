import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    const { tenantId, messageIds } = await request.json();
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (typeof tenantId !== "string" || !context.tenantIds.includes(tenantId) || !Array.isArray(messageIds)) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    const ids = messageIds.filter((id): id is string => typeof id === "string").slice(0, 100);
    if (ids.length) await createSupabaseAdminClient().from("internal_messages").update({ read_at: new Date().toISOString(), delivered_at: new Date().toISOString() }).in("id", ids).eq("tenant_id", tenantId).eq("recipient_user_id", context.user.id).is("read_at", null);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
