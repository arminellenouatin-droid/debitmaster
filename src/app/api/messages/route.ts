// DebitManager messages API: chaque message est borné au tenant autorisé et aux permissions RBAC du rôle courant.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter la messagerie." }, { status: 403 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("internal_messages").select("id,tenant_id,sender_user_id,recipient_user_id,subject,body,read_at,created_at").order("created_at", { ascending: false }).limit(100);
    const { data, error } = await (tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds));
    if (error) return NextResponse.json({ error: "Impossible de charger les messages." }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 160) : "";
    const messageBody = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    const recipientUserId = typeof body.recipientUserId === "string" && body.recipientUserId ? body.recipientUserId : null;
    if (!tenantId || messageBody.length < 1) return NextResponse.json({ error: "Établissement et message requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.send")) return NextResponse.json({ error: "Permission insuffisante pour envoyer un message." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await supabase.from("internal_messages").insert({ tenant_id: tenantId, sender_user_id: user.id, recipient_user_id: recipientUserId, subject: subject || null, body: messageBody }).select("id,tenant_id,sender_user_id,recipient_user_id,subject,body,read_at,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’envoyer le message." }, { status: 400 });
    return NextResponse.json({ message: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
