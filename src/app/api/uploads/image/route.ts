// DebitManager Image Upload API: uploads product & service pictures to Supabase product-images bucket.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);
const maxBytes = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
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

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Sélectionnez un fichier image valide." }, { status: 400 });
    }

    if (!allowedTypes.has(file.type) || file.size > maxBytes) {
      return NextResponse.json(
        { error: "L’image doit être au format JPG, PNG ou WebP et ne pas dépasser 5 Mo." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const path = `${tenantId}/${uniqueId}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "3600" });

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
