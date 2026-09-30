import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const access = await authorizeCommerceApi(request, { permission: "catalog.view", scope: "catalog:categories:read" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("commerce_categories")
      .select("id,tenant_id,parent_id,name,description,color,icon_key,sort_order,status,created_at,updated_at")
      .eq("tenant_id", access.context.tenantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(500);
    if (error) return NextResponse.json({ error: "Impossible de charger les catégories." }, { status: 500 });
    return NextResponse.json({ categories: data ?? [], accessMode: access.context.accessMode });
  } catch {
    return NextResponse.json({ error: "Service Commerce temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readCommerceJson(request);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
    const color = body.color === undefined ? "#0f766e" : typeof body.color === "string" ? body.color : "";
    const iconKey = body.iconKey === undefined ? "tag" : typeof body.iconKey === "string" ? body.iconKey : "";
    const sortOrder = body.sortOrder === undefined ? 0 : Number(body.sortOrder);
    if (name.length < 2 || name.length > 80 || !/^#[0-9a-f]{6}$/i.test(color) || !/^[a-z][a-z0-9_-]{0,39}$/.test(iconKey) || !Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000 || (parentId && !uuidPattern.test(parentId))) {
      return NextResponse.json({ error: "Nom, parent ou ordre de tri invalide." }, { status: 400 });
    }
    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.manage", write: true, scope: "catalog:categories:write" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    if (parentId) {
      const { data: parent } = await admin.from("commerce_categories").select("id,status").eq("id", parentId).eq("tenant_id", access.context.tenantId).maybeSingle();
      if (!parent || parent.status !== "ACTIVE") return NextResponse.json({ error: "La catégorie parente n’existe pas ou est archivée." }, { status: 400 });
    }
    const { data, error } = await admin.from("commerce_categories").insert({
      tenant_id: access.context.tenantId,
      parent_id: parentId,
      name,
      description,
      color,
      icon_key: iconKey,
      sort_order: sortOrder,
      created_by: access.context.user!.id,
      updated_by: access.context.user!.id,
    }).select("id,tenant_id,parent_id,name,description,color,icon_key,sort_order,status,created_at,updated_at").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Une catégorie du même niveau porte déjà ce nom." : "Impossible de créer la catégorie." }, { status: error?.code === "23505" ? 409 : 400 });
    return NextResponse.json({ category: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
