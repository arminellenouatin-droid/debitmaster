import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    const { tenantId } = await request.json();
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (typeof tenantId !== "string" || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    const [{ error: profileError }, { error: employeeError }] = await Promise.all([
      admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", context.user.id),
      admin.from("employees").update({ last_seen_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("user_id", context.user.id).eq("status", "ACTIVE").is("deleted_at", null),
    ]);
    if (profileError && employeeError) return NextResponse.json({ error: "Présence indisponible." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
