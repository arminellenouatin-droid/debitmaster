import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { sanitizeMeasurements, sanitizeBeneficiaries } from "@/lib/couture-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneIdentifier } from "@/lib/auth-identifiers";
import { requestHasSameOrigin } from "@/lib/request-security";

const validGenders = ["HOMME", "FEMME", "ENFANT", "UNISEXE"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const query = (searchParams.get("q") ?? "").trim();
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "customers.view");

    const admin = createSupabaseAdminClient();
    let builder = admin
      .from("couture_customers")
      .select("id,tenant_id,first_name,last_name,phone,email,gender,birthday,notes,measurements,habitual_beneficiaries,photo_url,status,created_at,updated_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (query) {
      builder = builder.or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%,phone.ilike.%${query}%`);
    }

    const { data: customers, error } = await builder;

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les fiches clients." }, { status: 500 });
    }

    return NextResponse.json({ customers: customers ?? [] });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "customers.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 100) : "";
    const phone = typeof body.phone === "string" ? normalizePhoneIdentifier(body.phone) : "";
    const email = typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase().slice(0, 120) : null;
    const gender = typeof body.gender === "string" && validGenders.includes(body.gender.toUpperCase() as (typeof validGenders)[number]) ? body.gender.toUpperCase() : "HOMME";
    const birthday = typeof body.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthday) ? body.birthday : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : null;

    const measurements = sanitizeMeasurements(body.measurements);
    const habitualBeneficiaries = sanitizeBeneficiaries(body.habitualBeneficiaries);

    if (firstName.length < 1 || lastName.length < 1 || !phone) {
      return NextResponse.json({ error: "Prénom, nom et numéro de téléphone valide requis." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: customer, error } = await admin
      .from("couture_customers")
      .insert({
        tenant_id: context.tenantId,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        gender,
        birthday,
        notes,
        measurements,
        habitual_beneficiaries: habitualBeneficiaries,
        photo_url: photoUrl,
        created_by: context.user.id,
      })
      .select("id,tenant_id,first_name,last_name,phone,email,gender,birthday,notes,measurements,habitual_beneficiaries,photo_url,status,created_at,updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Un client avec ce numéro de téléphone existe déjà." }, { status: 409 });
      }
      return NextResponse.json({ error: "Impossible de créer la fiche client." }, { status: 500 });
    }

    return NextResponse.json({ customer }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const requestedTenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "customers.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.firstName === "string" && body.firstName.trim()) updates.first_name = body.firstName.trim().slice(0, 80);
    if (typeof body.lastName === "string" && body.lastName.trim()) updates.last_name = body.lastName.trim().slice(0, 100);
    if (typeof body.phone === "string" && body.phone.trim()) updates.phone = normalizePhoneIdentifier(body.phone);
    if (body.email !== undefined) updates.email = typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase().slice(0, 120) : null;
    if (typeof body.gender === "string" && validGenders.includes(body.gender.toUpperCase() as (typeof validGenders)[number])) updates.gender = body.gender.toUpperCase();
    if (body.birthday !== undefined) updates.birthday = typeof body.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthday) ? body.birthday : null;
    if (body.notes !== undefined) updates.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    if (body.photoUrl !== undefined) updates.photo_url = typeof body.photoUrl === "string" ? body.photoUrl.trim() : null;
    if (body.measurements !== undefined) updates.measurements = sanitizeMeasurements(body.measurements);
    if (body.habitualBeneficiaries !== undefined) updates.habitual_beneficiaries = sanitizeBeneficiaries(body.habitualBeneficiaries);
    if (typeof body.status === "string" && ["ACTIVE", "INACTIVE"].includes(body.status.toUpperCase())) updates.status = body.status.toUpperCase();

    const admin = createSupabaseAdminClient();
    const { data: customer, error } = await admin
      .from("couture_customers")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select("id,tenant_id,first_name,last_name,phone,email,gender,birthday,notes,measurements,habitual_beneficiaries,photo_url,status,created_at,updated_at")
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: "Client introuvable ou mise à jour impossible." }, { status: 400 });
    }

    return NextResponse.json({ customer });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
