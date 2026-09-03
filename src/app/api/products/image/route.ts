import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export async function POST(request: Request) {
  const context = await getAuthorizationContext();
  if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const tenantId = String(form?.get("tenantId") ?? "");
  const file = form?.get("file");
  if (!tenantId || !context.tenantIds.includes(tenantId) || !can(context, "products.manage")) return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
  if (!(file instanceof File) || !extensions[file.type]) return NextResponse.json({ error: "Sélectionnez une image JPG, PNG, WebP ou AVIF." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "L’image ne doit pas dépasser 5 Mo." }, { status: 400 });
  const path = `${tenantId}/${randomUUID()}.${extensions[file.type]}`;
  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage.from("product-images").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) return NextResponse.json({ error: "Impossible d’enregistrer l’image du produit." }, { status: 500 });
  const { data } = admin.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ imageUrl: data.publicUrl });
}
