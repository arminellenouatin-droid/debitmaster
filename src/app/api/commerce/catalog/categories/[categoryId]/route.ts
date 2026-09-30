import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ categoryId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { categoryId } = await params;
    const parsed = await readCommerceJson(request);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    if (!uuidPattern.test(categoryId)) return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
    const patch: Record<string, string | number | null> = {};
    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Le nom doit contenir de 2 à 80 caractères." }, { status: 400 });
      patch.name = name;
    }
    if (body.description !== undefined) patch.description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
    if (body.color !== undefined) {
      if (typeof body.color !== "string" || !/^#[0-9a-f]{6}$/i.test(body.color)) return NextResponse.json({ error: "Couleur de catégorie invalide." }, { status: 400 });
      patch.color = body.color;
    }
    if (body.iconKey !== undefined) {
      if (typeof body.iconKey !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(body.iconKey)) return NextResponse.json({ error: "Icône de catégorie invalide." }, { status: 400 });
      patch.icon_key = body.iconKey;
    }
    if (body.sortOrder !== undefined) {
      const sortOrder = Number(body.sortOrder);
      if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) return NextResponse.json({ error: "Ordre de tri invalide." }, { status: 400 });
      patch.sort_order = sortOrder;
    }
    if (body.status !== undefined) {
      if (body.status !== "ACTIVE" && body.status !== "ARCHIVED") return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
      patch.status = body.status;
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Aucun changement à enregistrer." }, { status: 400 });

    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.manage", write: true, scope: "catalog:categories:write" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    if (patch.status === "ARCHIVED") {
      const { count, error: childError } = await admin.from("commerce_categories").select("id", { count: "exact", head: true }).eq("tenant_id", access.context.tenantId).eq("parent_id", categoryId).eq("status", "ACTIVE");
      if (childError) return NextResponse.json({ error: "Impossible de vérifier les sous-catégories." }, { status: 500 });
      if ((count ?? 0) > 0) return NextResponse.json({ error: "Archivez ou fusionnez d’abord les sous-catégories actives." }, { status: 409 });
    }
    const { data, error } = await admin.from("commerce_categories").update({ ...patch, updated_by: access.context.user!.id, updated_at: new Date().toISOString() })
      .eq("id", categoryId).eq("tenant_id", access.context.tenantId)
      .select("id,tenant_id,parent_id,name,description,color,icon_key,sort_order,status,updated_at").maybeSingle();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Une catégorie du même niveau porte déjà ce nom." : "Catégorie introuvable ou modification impossible." }, { status: error?.code === "23505" ? 409 : 404 });
    return NextResponse.json({ category: data });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
