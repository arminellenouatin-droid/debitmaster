// DebitMaster company documents: uploads et données sensibles du promoteur (IFU, RCCM, Photo, CNI), réservé au propriétaire du tenant.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestHasSameOrigin } from "@/lib/request-security";

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

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || "";
    if (!tenantId) return NextResponse.json({ error: "Paramètre tenantId manquant." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id,name,ifu_number,trade_register,promoter_photo_path,identity_card_path,owner_user_id")
      .eq("id", tenantId)
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json({ error: "Établissement non trouvé ou accès non autorisé." }, { status: 403 });
    }

    return NextResponse.json({
      companyId: company.id,
      companyName: company.name,
      ifuNumber: company.ifu_number ?? "",
      tradeRegister: company.trade_register ?? "",
      hasPromoterPhoto: Boolean(company.promoter_photo_path),
      hasIdentityCard: Boolean(company.identity_card_path),
    });
  } catch {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) {
      return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    }
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const formData = await request.formData();
    const tenantId = typeof formData.get("tenantId") === "string" ? String(formData.get("tenantId")) : "";
    const ifuNumber = typeof formData.get("ifuNumber") === "string" ? String(formData.get("ifuNumber")).trim().slice(0, 80) : undefined;
    const tradeRegister = typeof formData.get("tradeRegister") === "string" ? String(formData.get("tradeRegister")).trim().slice(0, 120) : undefined;
    const promoterPhoto = formData.get("promoterPhoto");
    const identityCard = formData.get("identityCard");

    if (!tenantId) {
      return NextResponse.json({ error: "Identifiant d'établissement manquant." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id,owner_user_id,promoter_photo_path,identity_card_path,ifu_number,trade_register")
      .eq("id", tenantId)
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (ifuNumber !== undefined) updateFields.ifu_number = ifuNumber;
    if (tradeRegister !== undefined) updateFields.trade_register = tradeRegister;

    // Optional photo upload
    if (promoterPhoto instanceof File && promoterPhoto.size > 0) {
      if (!photoTypes.has(promoterPhoto.type) || promoterPhoto.size > photoMaxBytes) {
        return NextResponse.json({ error: "La photo du promoteur doit être JPG, PNG ou WebP et ne pas dépasser 5 Mo." }, { status: 400 });
      }
      const photoPath = `${tenantId}/promoter-photo.${extensionFor(promoterPhoto)}`;
      const { error: photoError } = await admin.storage
        .from("company-documents")
        .upload(photoPath, promoterPhoto, { contentType: promoterPhoto.type, upsert: true, cacheControl: "3600" });
      if (photoError) return NextResponse.json({ error: "Impossible d’enregistrer la photo du promoteur." }, { status: 500 });
      updateFields.promoter_photo_path = photoPath;
    }

    // Optional identity card upload
    if (identityCard instanceof File && identityCard.size > 0) {
      if (!identityTypes.has(identityCard.type) || identityCard.size > identityMaxBytes) {
        return NextResponse.json({ error: "La pièce d’identité doit être une image ou un PDF et ne pas dépasser 8 Mo." }, { status: 400 });
      }
      const identityPath = `${tenantId}/identity-card.${extensionFor(identityCard)}`;
      const { error: identityError } = await admin.storage
        .from("company-documents")
        .upload(identityPath, identityCard, { contentType: identityCard.type, upsert: true, cacheControl: "3600" });
      if (identityError) return NextResponse.json({ error: "Impossible d’enregistrer la pièce d’identité." }, { status: 500 });
      updateFields.identity_card_path = identityPath;
    }

    const { error: updateError } = await admin
      .from("companies")
      .update(updateFields)
      .eq("id", company.id)
      .eq("owner_user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Impossible de mettre à jour les données du promoteur." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      ifuNumber: updateFields.ifu_number ?? company.ifu_number ?? "",
      tradeRegister: updateFields.trade_register ?? company.trade_register ?? "",
      hasPromoterPhoto: Boolean(updateFields.promoter_photo_path ?? company.promoter_photo_path),
      hasIdentityCard: Boolean(updateFields.identity_card_path ?? company.identity_card_path),
    });
  } catch {
    return NextResponse.json({ error: "Impossible de traiter les documents du promoteur." }, { status: 500 });
  }
}
