// DebitManager catalogue API: les catégories restent isolées par tenant et validées côté serveur.
import { NextResponse } from "next/server";
import { getOwnedTenantIds } from "@/lib/tenants";

export async function GET() {
  try {
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.length) return NextResponse.json({ categories: [] });
    const { data, error } = await supabase.from("categories").select("id,tenant_id,name,created_at").in("tenant_id", tenantIds).order("name").limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger les catégories." }, { status: 500 });
    return NextResponse.json({ categories: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    if (name.length < 2 || !tenantId) return NextResponse.json({ error: "Nom et établissement requis." }, { status: 400 });
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await supabase.from("categories").insert({ tenant_id: tenantId, name }).select("id,tenant_id,name,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible de créer la catégorie." }, { status: 400 });
    return NextResponse.json({ category: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
