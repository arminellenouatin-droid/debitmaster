// DebitManager invitation API: records a pending invite without pretending that an email was sent.
import { NextResponse } from "next/server";
import { getOwnedTenantIds } from "@/lib/tenants";
import { roleLabels } from "@/lib/staff-permissions";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await supabase.from("employee_invitations").select("id,tenant_id,email,first_name,last_name,position,status,expires_at,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: "Impossible de charger les invitations." }, { status: 500 });
    return NextResponse.json({ invitations: data ?? [] });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const position = typeof body.position === "string" ? body.position : "";
    if (!tenantId || !emailPattern.test(email) || firstName.length < 2 || lastName.length < 2 || !roleLabels[position]) return NextResponse.json({ error: "Établissement, identité, e-mail et rôle valides requis." }, { status: 400 });
    const { supabase, user, tenantIds } = await getOwnedTenantIds();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data, error } = await supabase.from("employee_invitations").insert({ tenant_id: tenantId, email, first_name: firstName, last_name: lastName, position, invited_by: user.id }).select("id,tenant_id,email,first_name,last_name,position,status,expires_at,created_at").single();
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer l’invitation." }, { status: 400 });
    return NextResponse.json({ invitation: data, delivery: "PENDING_EMAIL_CONFIGURATION" }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
