import { NextResponse } from "next/server";
import { can, getAuthorizationContext } from "@/lib/authorization";
import { mealAccompanimentNames, type MealAccompanimentName } from "@/lib/meal-accompaniments";
import { requestHasSameOrigin } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAccompanimentName(value: unknown): value is MealAccompanimentName {
  return typeof value === "string" && mealAccompanimentNames.includes(value as MealAccompanimentName);
}

function isTenantImagePath(path: unknown, tenantId: string): path is string {
  if (typeof path !== "string") return false;
  const [pathTenant, filename, ...rest] = path.split("/");
  return pathTenant === tenantId && rest.length === 0 && /^[\da-f-]{36}\.(jpg|png|webp)$/i.test(filename ?? "");
}

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId")?.trim() ?? "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.allTenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }
    if (!can(context, "orders.create") && !can(context, "products.manage")) {
      return NextResponse.json({ error: "Accès au menu non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("meal_accompaniment_images")
      .select("name,image_path")
      .eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: "Impossible de charger les photos d’accompagnement." }, { status: 500 });

    const byName = new Map((data ?? []).map((row) => [row.name, row.image_path]));
    const images = mealAccompanimentNames.map((name) => {
      const imagePath = byName.get(name) ?? null;
      const imageUrl = imagePath ? admin.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl : null;
      return { name, imagePath, imageUrl };
    });

    return NextResponse.json({ images }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Impossible de charger les photos d’accompagnement." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const context = await getAuthorizationContext();
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantId || !context.allTenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }
    if (!can(context, "products.manage")) {
      return NextResponse.json({ error: "Droit de gestion du catalogue requis." }, { status: 403 });
    }
    if (!isAccompanimentName(body.name)) {
      return NextResponse.json({ error: "Accompagnement invalide." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    if (body.imagePath === null) {
      const { error } = await admin
        .from("meal_accompaniment_images")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("name", body.name);
      if (error) return NextResponse.json({ error: "Impossible de retirer la photo." }, { status: 500 });
      return NextResponse.json({ ok: true, imagePath: null, imageUrl: null });
    }

    if (!isTenantImagePath(body.imagePath, tenantId)) {
      return NextResponse.json({ error: "Chemin de photo invalide pour cet établissement." }, { status: 400 });
    }

    const { error: storageError } = await admin.storage.from("product-images").createSignedUrl(body.imagePath, 60);
    if (storageError) return NextResponse.json({ error: "Photo introuvable dans le stockage de cet établissement." }, { status: 400 });

    const { error } = await admin.from("meal_accompaniment_images").upsert(
      { tenant_id: tenantId, name: body.name, image_path: body.imagePath, updated_by: context.user.id, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,name" }
    );
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer la photo d’accompagnement." }, { status: 500 });

    const imageUrl = admin.storage.from("product-images").getPublicUrl(body.imagePath).data.publicUrl;
    return NextResponse.json({ ok: true, imagePath: body.imagePath, imageUrl });
  } catch {
    return NextResponse.json({ error: "Impossible d’enregistrer la photo d’accompagnement." }, { status: 400 });
  }
}
