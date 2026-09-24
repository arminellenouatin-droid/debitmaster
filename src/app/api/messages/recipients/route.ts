import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.view")) return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const [{ data: employees }, { data: company }] = await Promise.all([
      context.supabase.from("employees").select("user_id,first_name,last_name,position,last_seen_at").eq("tenant_id", tenantId).eq("status", "ACTIVE").is("deleted_at", null).not("user_id", "is", null).order("first_name").limit(200),
      context.supabase.from("companies").select("owner_user_id").eq("id", tenantId).is("deleted_at", null).maybeSingle(),
    ]);
    const { data: ownerProfile } = company?.owner_user_id ? await context.supabase.from("profiles").select("first_name,last_name,last_seen_at").eq("id", company.owner_user_id).maybeSingle() : { data: null };
    const owner = company?.owner_user_id ? [{ user_id: company.owner_user_id, first_name: ownerProfile?.first_name ?? "Promoteur", last_name: ownerProfile?.last_name ?? "", position: "PROPRIÉTAIRE", last_seen_at: ownerProfile?.last_seen_at ?? null }] : [];
    const recipients = [...owner, ...(employees ?? [])].filter((person) => person.user_id !== context.user!.id).map((person) => ({
      user_id: person.user_id,
      name: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Membre de l’équipe",
      position: person.position,
      online: Boolean(person.last_seen_at && Date.now() - new Date(person.last_seen_at).getTime() < 120000),
    }));
    return NextResponse.json({ currentUserId: context.user.id, recipients });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}
