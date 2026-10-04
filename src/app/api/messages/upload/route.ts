// DebitMaster messages media upload: Upload sécurisé d'audio, photo et vidéo, strictement conditionné à l'Option Avancée.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { companyHasSpecialOption } from "@/lib/subscription-plans";

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  AUDIO: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a", "audio/aac"],
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  VIDEO: ["video/mp4", "video/webm", "video/quicktime"],
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo max

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const tenantId = (formData.get("tenantId") as string) || "";
    const rawType = (formData.get("type") as string) || "";
    const file = formData.get("file") as File | null;

    if (!tenantId || !file) {
      return NextResponse.json({ error: "Établissement et fichier requis." }, { status: 400 });
    }

    const type = rawType.toUpperCase() as "AUDIO" | "IMAGE" | "VIDEO";
    if (!["AUDIO", "IMAGE", "VIDEO"].includes(type)) {
      return NextResponse.json({ error: "Type de média non supporté." }, { status: 400 });
    }

    const context = await getAuthorizationContext();
    const { user, tenantIds } = context;

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (!can(context, "messages.send")) {
      return NextResponse.json({ error: "Permission insuffisante pour envoyer des messages." }, { status: 403 });
    }
    if (!tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Contrôle d'éligibilité Option Avancée
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id, name, subscription_plan, activity_type")
      .eq("id", tenantId)
      .single();

    if (compErr || !company) {
      return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    }

    const hasSpecialOption = companyHasSpecialOption(company);
    if (!hasSpecialOption) {
      return NextResponse.json(
        {
          error: "L'envoi de notes vocales, photos et vidéos est réservé aux établissements bénéficiant de l'Option Avancée (+50%).",
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    // 2. Validation de taille et de type MIME
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Le fichier dépasse la limite autorisée de 25 Mo." }, { status: 400 });
    }

    const allowedMimes = ALLOWED_MIME_TYPES[type] ?? [];
    const mimeNormalized = file.type.toLowerCase().split(";")[0]?.trim() || "";
    const isAllowed = allowedMimes.some((m) => mimeNormalized.startsWith(m) || m.startsWith(mimeNormalized));

    if (!isAllowed && mimeNormalized) {
      return NextResponse.json({ error: `Format de fichier non autorisé pour ${type} (${file.type}).` }, { status: 400 });
    }

    // 3. Détermination de l'extension sécurisée
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const safeExt = extMatch ? extMatch[1].toLowerCase() : type === "AUDIO" ? "webm" : type === "IMAGE" ? "jpg" : "mp4";
    const storagePath = `${tenantId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

    // 4. Upload vers le bucket Supabase privé internal-message-media
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await admin.storage
      .from("internal-message-media")
      .upload(storagePath, buffer, {
        contentType: file.type || (type === "AUDIO" ? "audio/webm" : type === "IMAGE" ? "image/jpeg" : "video/mp4"),
        upsert: false,
      });

    if (uploadErr) {
      console.error("[messages/upload] Erreur upload Supabase Storage:", uploadErr);
      return NextResponse.json({ error: "Impossible de téléverser le fichier." }, { status: 500 });
    }

    // 5. Génération de l'URL signée temporaire (1 heure)
    const { data: signedData, error: signErr } = await admin.storage
      .from("internal-message-media")
      .createSignedUrl(storagePath, 3600);

    if (signErr || !signedData) {
      return NextResponse.json({ error: "Erreur de génération du lien sécurisé." }, { status: 500 });
    }

    return NextResponse.json({
      path: storagePath,
      url: signedData.signedUrl,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      messageType: type,
    });
  } catch (error) {
    console.error("[messages/upload] Erreur:", error);
    return NextResponse.json({ error: "Erreur lors du traitement du fichier." }, { status: 500 });
  }
}
