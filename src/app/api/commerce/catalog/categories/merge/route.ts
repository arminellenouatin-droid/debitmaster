import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const parsed = await readCommerceJson(request);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const sourceCategoryId = typeof body.sourceCategoryId === "string" ? body.sourceCategoryId : "";
    const targetCategoryId = typeof body.targetCategoryId === "string" ? body.targetCategoryId : "";
    if (!uuidPattern.test(sourceCategoryId) || !uuidPattern.test(targetCategoryId) || sourceCategoryId === targetCategoryId) {
      return NextResponse.json({ error: "Choisissez deux catégories différentes." }, { status: 400 });
    }
    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.manage", write: true, scope: "catalog:categories:merge", limit: 10, ownerOnly: true });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("merge_commerce_category", {
      p_tenant_id: access.context.tenantId!,
      p_source_category_id: sourceCategoryId,
      p_target_category_id: targetCategoryId,
      p_actor_user_id: access.context.user!.id,
    });
    if (error) return NextResponse.json({ error: "La fusion est impossible. Vérifiez les catégories et réessayez." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
