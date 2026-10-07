import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCoutureContext, assertCouturePermission } from "@/lib/couture-auth";
import { detectSupportedImageMime } from "@/lib/image-validation";
import { requestHasSameOrigin } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const maxImageBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxImageBytes + 64 * 1024) {
      return NextResponse.json({ error: "La photo ne doit pas dépasser 5 Mo." }, { status: 413 });
    }

    const form = await request.formData();
    const tenantValue = form.get("tenantId");
    const tenantId = typeof tenantValue === "string" ? tenantValue : undefined;
    const context = await getCoutureContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.tenantId || context.accessMode === "BLOCKED") return NextResponse.json({ error: "Accès atelier de couture non autorisé." }, { status: 403 });
    assertCouturePermission(context, "catalog.manage");
    if (context.accessMode !== "ACTIVE") return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });
    if (tenantId && tenantId !== context.tenantId) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });

    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Sélectionnez un fichier image valide." }, { status: 400 });
    if (file.size < 1 || file.size > maxImageBytes) return NextResponse.json({ error: "La photo doit peser 5 Mo maximum." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectSupportedImageMime(bytes);
    if (!contentType || file.type !== contentType) return NextResponse.json({ error: "Formats acceptés : JPEG, PNG ou WebP valides." }, { status: 415 });

    const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
    const path = `${context.tenantId}/${randomUUID()}.${extension}`;
    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from("product-images").upload(path, bytes, { contentType, upsert: false, cacheControl: "3600" });
    if (error) return NextResponse.json({ error: "Impossible d’enregistrer la photo." }, { status: 500 });
    const { data } = admin.storage.from("product-images").getPublicUrl(path);
    if (!data.publicUrl) {
      await admin.storage.from("product-images").remove([path]);
      return NextResponse.json({ error: "Impossible de préparer la photo." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, imageUrl: data.publicUrl }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Erreur inattendue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
