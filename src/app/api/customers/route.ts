// DebitManager customers API: clients isolés par établissement et créables par les preneurs de commande.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 80) ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "orders.view")) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    let query = context.supabase.from("customers").select("id,tenant_id,full_name,phone,customer_type,created_at").eq("tenant_id", tenantId).order("full_name").limit(50);
    if (search) query = query.ilike("full_name", `%${search}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les clients." }, { status: 500 });
    return NextResponse.json({ customers: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 160) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 32) : null;
    const customerType = body.customerType === "NAMED" ? "NAMED" : "COUNTER";
    if (!tenantId || fullName.length < 2) return NextResponse.json({ error: "Établissement et nom de client valides requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantIds.includes(tenantId) || !can(context, "orders.create")) return NextResponse.json({ error: "Permission insuffisante pour créer un client." }, { status: 403 });
    const { data, error } = await context.supabase.from("customers").insert({ tenant_id: tenantId, full_name: fullName, phone, customer_type: customerType, created_by: context.user.id }).select("id,tenant_id,full_name,phone,customer_type,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible de créer le client." }, { status: 400 });
    return NextResponse.json({ customer: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
