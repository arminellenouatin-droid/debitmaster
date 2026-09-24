import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.view")) return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    if (!tenantId || !context.tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    const [{ data: employees }, { data: company }, { data: sentMessages }] = await Promise.all([
      admin.from("employees").select("user_id,first_name,last_name,position,last_seen_at").eq("tenant_id", tenantId).eq("status", "ACTIVE").is("deleted_at", null).not("user_id", "is", null).order("first_name").limit(200),
      admin.from("companies").select("owner_user_id,subscription_plan").eq("id", tenantId).is("deleted_at", null).maybeSingle(),
      admin.from("internal_messages").select("sender_user_id").eq("tenant_id", tenantId).eq("recipient_user_id", context.user.id).not("sender_user_id", "is", null).order("created_at", { ascending: false }).limit(200),
    ]);
    const senderIds = [...new Set((sentMessages ?? []).map((message) => message.sender_user_id).filter((id): id is string => Boolean(id)))];
    const { data: senderProfiles } = senderIds.length ? await admin.from("profiles").select("id,first_name,last_name,last_seen_at").in("id", senderIds).limit(200) : { data: [] };
    const { data: ownerProfile } = company?.owner_user_id ? await admin.from("profiles").select("first_name,last_name,last_seen_at").eq("id", company.owner_user_id).maybeSingle() : { data: null };
    const owner = company?.owner_user_id ? [{ user_id: company.owner_user_id, first_name: ownerProfile?.first_name ?? "Promoteur", last_name: ownerProfile?.last_name ?? "", position: "PROPRIÉTAIRE", last_seen_at: ownerProfile?.last_seen_at ?? null }] : [];
    const employeeIds = new Set((employees ?? []).map((person) => person.user_id));
    const previousSenders = (senderProfiles ?? []).filter((profile) => profile.id !== context.user!.id && !employeeIds.has(profile.id)).map((profile) => ({ user_id: profile.id, first_name: profile.first_name, last_name: profile.last_name, position: "EXPÉDITEUR", last_seen_at: profile.last_seen_at }));
    const recipients = [...owner, ...(employees ?? []), ...previousSenders].filter((person) => person.user_id !== context.user!.id).map((person) => ({
      user_id: person.user_id,
      name: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Membre de l’équipe",
      position: person.position,
      online: Boolean(person.last_seen_at && Date.now() - new Date(person.last_seen_at).getTime() < 120000),
    }));
    return NextResponse.json({ currentUserId: context.user.id, canSendVideo: company?.subscription_plan === "SPECIAL", recipients });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}
