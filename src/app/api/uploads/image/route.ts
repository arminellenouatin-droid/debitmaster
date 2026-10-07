// DebitManager Image Upload API: uploads product & service pictures to Supabase product-images bucket.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { can, getAuthorizationContext } from "@/lib/authorization";
import { detectSupportedImageMime } from "@/lib/image-validation";
import { requestHasSameOrigin } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const maxBytes = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes + 64 * 1024) {
      return NextResponse.json({ error: "L’image ne doit pas dépasser 5 Mo." }, { status: 413 });
    }

    const context = await getAuthorizationContext();
    if (!context.user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const tenantId = (formData.get("tenantId") as string) || context.tenantIds[0] || "";

    if (!tenantId || !context.tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    if (!can(context, "products.manage") && !can(context, "services.manage")) {
      return NextResponse.json({ error: "Droit de gestion du catalogue requis." }, { status: 403 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Sélectionnez un fichier image valide." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json(
        { error: "L’image doit être au format JPG, PNG ou WebP et ne pas dépasser 5 Mo." },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectSupportedImageMime(bytes);
    if (!contentType) {
      return NextResponse.json(
        { error: "L’image doit être un fichier JPG, PNG ou WebP valide et ne pas dépasser 5 Mo." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${tenantId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, bytes, { contentType, upsert: false, cacheControl: "3600" });

    if (uploadError) {
      console.error("[upload] Erreur upload image:", uploadError);
      return NextResponse.json({ error: "Impossible de téléverser l'image pour le moment." }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from("product-images").getPublicUrl(path);
    const imageUrl = publicData?.publicUrl || "";

    return NextResponse.json({ ok: true, imageUrl, path });
  } catch (error) {
    console.error("[upload] Exception upload:", error);
    return NextResponse.json({ error: "Erreur lors du traitement de l'image." }, { status: 500 });
  }
}
