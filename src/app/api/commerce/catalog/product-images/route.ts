import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceFormData } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeCommerceAuditEvent } from "@/lib/commerce-audit";

const maxImageBytes = 5 * 1024 * 1024;
const sniffImage = (bytes: Uint8Array): { mime: string; extension: string } | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
};

export async function POST(request: Request) {
  try {
    const access = await authorizeCommerceApi(request, { permission: "catalog.manage", write: true, scope: "catalog:images:write", limit: 15 });
    if (access.response) return access.response;
    const parsed = await readCommerceFormData(request, maxImageBytes + 64 * 1024);
    if (parsed.response) return parsed.response;
    const form = parsed.form!;
    const requestedTenantId = typeof form.get("tenantId") === "string" ? String(form.get("tenantId")) : access.context.tenantId;
    if (requestedTenantId !== access.context.tenantId) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const file = form.get("photo");
    if (!(file instanceof File)) return NextResponse.json({ error: "Photo manquante." }, { status: 400 });
    if (file.size < 1 || file.size > maxImageBytes) return NextResponse.json({ error: "La photo doit peser 5 Mo maximum." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = sniffImage(bytes);
    if (!detected || file.type !== detected.mime) return NextResponse.json({ error: "Formats acceptés : JPEG, PNG ou WebP valides." }, { status: 415 });
    const path = `${access.context.tenantId}/${randomUUID()}.${detected.extension}`;
    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage.from("commerce-product-images").upload(path, bytes, { contentType: detected.mime, upsert: false, cacheControl: "3600" });
    if (uploadError) return NextResponse.json({ error: "Impossible d’enregistrer la photo." }, { status: 500 });
    const { data: signed, error: signedError } = await admin.storage.from("commerce-product-images").createSignedUrl(path, 3600);
    if (signedError || !signed?.signedUrl) {
      await admin.storage.from("commerce-product-images").remove([path]);
      return NextResponse.json({ error: "Impossible de préparer l’aperçu privé de la photo." }, { status: 500 });
    }
    const audited = await writeCommerceAuditEvent({ tenantId: access.context.tenantId!, actorUserId: access.context.user!.id, action: "PRODUCT_PHOTO_UPLOADED", entityType: "PRODUCT_IMAGE", entityId: path.split("/").at(-1), metadata: { mimeType: detected.mime, sizeBytes: file.size } });
    if (!audited) {
      await admin.storage.from("commerce-product-images").remove([path]);
      return NextResponse.json({ error: "La photo n’a pas été enregistrée dans le journal d’audit." }, { status: 500 });
    }
    return NextResponse.json({ photoPath: path, photoUrl: signed.signedUrl }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête d’image invalide." }, { status: 400 });
  }
}
