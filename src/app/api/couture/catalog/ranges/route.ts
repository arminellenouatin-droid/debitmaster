import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const context = await getCoutureContext(requestedTenantId);

    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") {
      return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    }

    assertCouturePermission(context, "catalog.view");

    const admin = createSupabaseAdminClient();
    const { data: ranges, error } = await admin
      .from("couture_ranges")
      .select("id,tenant_id,name,description,rank,is_active,created_at,updated_at")
      .eq("tenant_id", context.tenantId)
      .order("rank", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les gammes." }, { status: 500 });
    }

    return NextResponse.json({ ranges: ranges ?? [] });
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

    assertCouturePermission(context, "catalog.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : null;
    const rank = Number.isSafeInteger(body.rank) ? Number(body.rank) : 1;

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: "Le nom de la gamme doit comporter entre 2 et 60 caractères." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: range, error } = await admin
      .from("couture_ranges")
      .insert({
        tenant_id: context.tenantId,
        name,
        description,
        rank,
        created_by: context.user.id,
      })
      .select("id,tenant_id,name,description,rank,is_active,created_at,updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Une gamme portant ce nom existe déjà." }, { status: 409 });
      }
      return NextResponse.json({ error: "Impossible de créer la gamme." }, { status: 500 });
    }

    return NextResponse.json({ range }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
