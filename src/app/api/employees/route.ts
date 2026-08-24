// DebitManager staff API: employés rattachés au tenant possédé, sans création implicite de compte Auth.
import { NextResponse } from "next/server";
import { getOwnedTenantIds } from "@/lib/tenants";

const positions = [
  "SERVEUR",
  "SUPERVISEUR",
  "MAGASINIER",
  "GERANT",
  "BARMAN",
  "SECRETAIRE",
  "COMPTABLE",
  "APPROVISIONNEMENT",
  "CUISINIER",
  "CHEF_CUISINE",
  "ADMINISTRATEUR",
] as const;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const query = supabase.from("employees").select("id,tenant_id,user_id,first_name,last_name,position,status,created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
    const { data, error } = await (tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds));
    if (error) return NextResponse.json({ error: "Impossible de charger l’équipe." }, { status: 500 });
    return NextResponse.json({ employees: data ?? [], positions });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const position = typeof body.position === "string" ? body.position : "";
    if (!tenantId || firstName.length < 2 || lastName.length < 2 || !positions.includes(position as (typeof positions)[number])) return NextResponse.json({ error: "Prénom, nom, établissement et rôle valides requis." }, { status: 400 });
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await supabase.from("employees").insert({ tenant_id: tenantId, first_name: firstName, last_name: lastName, position, status: "ACTIVE" }).select("id,tenant_id,user_id,first_name,last_name,position,status,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’ajouter le membre de l’équipe." }, { status: 400 });
    return NextResponse.json({ employee: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
