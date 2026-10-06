import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

const validGenders = ["HOMME", "FEMME", "ENFANT", "UNISEXE"] as const;

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
    const { data: models, error } = await admin
      .from("couture_models")
      .select("id,tenant_id,name,description,gender,image_url,is_active,created_at,updated_at")
      .eq("tenant_id", context.tenantId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Impossible de charger les modèles." }, { status: 500 });
    }

    return NextResponse.json({ models: models ?? [] });
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
    const gender = typeof body.gender === "string" ? body.gender.toUpperCase() : "UNISEXE";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 2048) || null : null;
    if (imageUrl && !imageUrl.startsWith("https://")) return NextResponse.json({ error: "URL de photo invalide." }, { status: 400 });

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Le nom du modèle doit contenir entre 2 et 100 caractères." }, { status: 400 });
    }

    if (!validGenders.includes(gender as (typeof validGenders)[number])) {
      return NextResponse.json({ error: "Genre invalide (HOMME, FEMME, ENFANT, UNISEXE requis)." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: model, error } = await admin
      .from("couture_models")
      .insert({
        tenant_id: context.tenantId,
        name,
        description,
        gender,
        image_url: imageUrl,
        created_by: context.user.id,
      })
      .select("id,tenant_id,name,description,gender,image_url,is_active,created_at,updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Un modèle avec ce nom existe déjà." }, { status: 409 });
      }
      return NextResponse.json({ error: "Impossible de créer le modèle." }, { status: 500 });
    }

    return NextResponse.json({ model }, { status: 201 });
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

    assertCouturePermission(context, "catalog.manage");
    if (context.accessMode !== "ACTIVE") {
      return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === "string" && body.name.trim().length >= 2) updates.name = body.name.trim();
    if (typeof body.description === "string") updates.description = body.description.trim().slice(0, 500);
    if (typeof body.gender === "string" && validGenders.includes(body.gender.toUpperCase() as (typeof validGenders)[number])) updates.gender = body.gender.toUpperCase();
    if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
    if (body.imageUrl !== undefined) {
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 2048) || null : null;
      if (imageUrl && !imageUrl.startsWith("https://")) return NextResponse.json({ error: "URL de photo invalide." }, { status: 400 });
      updates.image_url = imageUrl;
    }

    const admin = createSupabaseAdminClient();
    const { data: updated, error } = await admin
      .from("couture_models")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .select("id,tenant_id,name,description,gender,image_url,is_active,created_at,updated_at")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: "Modèle introuvable ou modification impossible." }, { status: 400 });
    }

    return NextResponse.json({ model: updated });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
