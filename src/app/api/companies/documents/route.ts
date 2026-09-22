// DebitMaster company documents: uploads sensibles du promoteur, uniquement pour le propriétaire du tenant.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const identityTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const photoMaxBytes = 5 * 1024 * 1024;
const identityMaxBytes = 8 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const formData = await request.formData();
    const tenantId = typeof formData.get("tenantId") === "string" ? String(formData.get("tenantId")) : "";
    const promoterPhoto = formData.get("promoterPhoto");
    const identityCard = formData.get("identityCard");
    if (!tenantId || !(promoterPhoto instanceof File) || !(identityCard instanceof File)) return NextResponse.json({ error: "La photo du promoteur et la pièce d’identité sont obligatoires." }, { status: 400 });
    if (!photoTypes.has(promoterPhoto.type) || promoterPhoto.size > photoMaxBytes) return NextResponse.json({ error: "La photo du promoteur doit être JPG, PNG ou WebP et ne pas dépasser 5 Mo." }, { status: 400 });
    if (!identityTypes.has(identityCard.type) || identityCard.size > identityMaxBytes) return NextResponse.json({ error: "La pièce d’identité doit être une image ou un PDF et ne pas dépasser 8 Mo." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: company, error: companyError } = await admin.from("companies").select("id,owner_user_id").eq("id", tenantId).eq("owner_user_id", user.id).is("deleted_at", null).maybeSingle();
    if (companyError || !company) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });

    const photoPath = `${tenantId}/promoter-photo.${extensionFor(promoterPhoto)}`;
    const identityPath = `${tenantId}/identity-card.${extensionFor(identityCard)}`;
    const { error: photoError } = await admin.storage.from("company-documents").upload(photoPath, promoterPhoto, { contentType: promoterPhoto.type, upsert: true, cacheControl: "3600" });
    if (photoError) return NextResponse.json({ error: "Impossible d’enregistrer la photo du promoteur." }, { status: 500 });
    const { error: identityError } = await admin.storage.from("company-documents").upload(identityPath, identityCard, { contentType: identityCard.type, upsert: true, cacheControl: "3600" });
    if (identityError) return NextResponse.json({ error: "Impossible d’enregistrer la pièce d’identité." }, { status: 500 });

    const { error: updateError } = await admin.from("companies").update({ promoter_photo_path: photoPath, identity_card_path: identityPath, updated_at: new Date().toISOString() }).eq("id", company.id).eq("owner_user_id", user.id);
    if (updateError) return NextResponse.json({ error: "Documents enregistrés, mais l’établissement n’a pas pu être synchronisé." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible de traiter les documents du promoteur." }, { status: 500 });
  }
}
