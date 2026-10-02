import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

const validSiteTypes = ["BOUTIQUE", "ATELIER"] as const;
const validCurrencies = ["FCFA", "XOF", "XAF", "EUR", "USD", "GHS", "NGN"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "sites.view");

    const admin = createSupabaseAdminClient();
    const { data: sites, error } = await admin
      .from("couture_sites")
      .select("id,tenant_id,name,site_type,country,city,address,currency,phone,photo_url,status,created_at,updated_at")
      .eq("tenant_id", context.tenantId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les sites." }, { status: 500 });
    }

    return NextResponse.json({ sites: sites ?? [] });
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

    assertCouturePermission(context, "sites.manage");

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const siteType = typeof body.siteType === "string" ? body.siteType.toUpperCase() : "BOUTIQUE";
    const country = typeof body.country === "string" ? body.country.trim() : "Togo";
    const city = typeof body.city === "string" ? body.city.trim().slice(0, 120) : null;
    const address = typeof body.address === "string" ? body.address.trim().slice(0, 240) : null;
    const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "FCFA";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : null;
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : null;

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Le nom du site doit comporter entre 2 et 120 caractères." }, { status: 400 });
    }

    if (!validSiteTypes.includes(siteType as (typeof validSiteTypes)[number])) {
      return NextResponse.json({ error: "Type de site invalide (BOUTIQUE ou ATELIER requis)." }, { status: 400 });
    }

    if (!validCurrencies.includes(currency as (typeof validCurrencies)[number])) {
      return NextResponse.json({ error: "Devise invalide." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: newSite, error } = await admin
      .from("couture_sites")
      .insert({
        tenant_id: context.tenantId,
        name,
        site_type: siteType,
        country,
        city,
        address,
        currency,
        phone,
        photo_url: photoUrl,
        created_by: context.user.id,
      })
      .select("id,tenant_id,name,site_type,country,city,address,currency,phone,photo_url,status,created_at,updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Un site portant ce nom existe déjà pour cet établissement." }, { status: 409 });
      }
      return NextResponse.json({ error: "Impossible de créer le site." }, { status: 500 });
    }

    await admin.from("couture_audit_events").insert({
      tenant_id: context.tenantId,
      actor_user_id: context.user.id,
      action: "SITE_CREATED",
      entity_type: "SITE",
      entity_id: newSite.id,
      metadata: { name: newSite.name, site_type: newSite.site_type, country: newSite.country, currency: newSite.currency },
    });

    return NextResponse.json({ site: newSite }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
