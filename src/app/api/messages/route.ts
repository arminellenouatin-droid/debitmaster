// DebitMaster messages API: Messagerie interne WhatsApp avec isolation stricte par tenant,
// gating Option Avancée sur l'audio/photos/vidéos, génération de liens signés pour les médias,
// et notification push instantanée du destinataire.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { companyHasSpecialOption } from "@/lib/subscription-plans";
import { sendMulticastPush } from "@/lib/firebase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const contactId = url.searchParams.get("contactId") ?? "team";
    const context = await getAuthorizationContext();
    const { user, tenantIds } = context;

    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.view")) {
      return NextResponse.json({ error: "Permission insuffisante pour consulter la messagerie." }, { status: 403 });
    }
    if (!tenantId || !tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("internal_messages")
      .select("id, tenant_id, sender_user_id, recipient_user_id, subject, body, read_at, created_at, event_type, message_type, media_path, media_name, media_mime_type, media_size, metadata")
      .eq("tenant_id", tenantId);

    if (contactId === "team") {
      // Canal équipe général : messages sans destinataire spécifique
      query = query.is("recipient_user_id", null);
    } else {
      // Conversation directe 1-à-1 entre l'utilisateur courant et le contactId
      // Sécurité : vérifier que contactId appartient au même tenant
      query = query.or(
        `and(sender_user_id.eq.${user.id},recipient_user_id.eq.${contactId}),and(sender_user_id.eq.${contactId},recipient_user_id.eq.${user.id})`
      );

      // Marquer comme lus les messages reçus de ce contact
      void admin
        .from("internal_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("sender_user_id", contactId)
        .eq("recipient_user_id", user.id)
        .is("read_at", null);
    }

    const { data: messages, error } = await query
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("[messages] Erreur select:", error);
      return NextResponse.json({ error: "Impossible de charger les messages." }, { status: 500 });
    }

    // Récupérer les noms des expéditeurs pour un affichage convivial
    const senderIds = Array.from(new Set((messages ?? []).map((m) => m.sender_user_id)));
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, first_name, last_name, role")
      .in("id", senderIds);

    const namesById = new Map<string, string>();
    for (const p of profiles ?? []) {
      namesById.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Collègue");
    }

    // Générer des URLs signées pour tous les médias
    const enrichedMessages = await Promise.all(
      (messages ?? []).map(async (msg) => {
        let mediaUrl: string | null = null;
        if (msg.media_path) {
          const { data: signed } = await admin.storage
            .from("internal-message-media")
            .createSignedUrl(msg.media_path, 3600);
          mediaUrl = signed?.signedUrl ?? null;
        }

        return {
          id: msg.id,
          tenant_id: msg.tenant_id,
          sender_user_id: msg.sender_user_id,
          sender_name: namesById.get(msg.sender_user_id) || "Collègue",
          recipient_user_id: msg.recipient_user_id,
          subject: msg.subject,
          body: msg.body,
          message_type: msg.message_type || "TEXT",
          event_type: msg.event_type,
          media_path: msg.media_path,
          media_url: mediaUrl,
          media_name: msg.media_name,
          media_mime_type: msg.media_mime_type,
          media_size: msg.media_size,
          metadata: msg.metadata,
          read_at: msg.read_at,
          created_at: msg.created_at,
          is_me: msg.sender_user_id === user.id,
        };
      })
    );

    return NextResponse.json({ messages: enrichedMessages });
  } catch (err) {
    console.error("[messages/GET] Erreur:", err);
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const rawRecipient = typeof body.recipientUserId === "string" && body.recipientUserId ? body.recipientUserId : null;
    const recipientUserId = rawRecipient === "team" ? null : rawRecipient;
    const messageText = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
    const messageType = ["TEXT", "AUDIO", "IMAGE", "VIDEO"].includes(body.messageType) ? body.messageType : "TEXT";
    const mediaPath = typeof body.mediaPath === "string" && body.mediaPath ? body.mediaPath : null;
    const mediaName = typeof body.mediaName === "string" && body.mediaName ? body.mediaName.slice(0, 255) : null;
    const mediaMimeType = typeof body.mediaMimeType === "string" && body.mediaMimeType ? body.mediaMimeType : null;
    const mediaSize = typeof body.mediaSize === "number" && body.mediaSize > 0 ? body.mediaSize : null;
    const subject = typeof body.subject === "string" && body.subject ? body.subject.trim().slice(0, 160) : null;
    const eventType = typeof body.eventType === "string" && body.eventType ? body.eventType : "CHAT_MESSAGE";
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!tenantId) {
      return NextResponse.json({ error: "Établissement requis." }, { status: 400 });
    }
    if (messageType === "TEXT" && !messageText) {
      return NextResponse.json({ error: "Le contenu du message ne peut pas être vide." }, { status: 400 });
    }
    if (messageType !== "TEXT" && !mediaPath) {
      return NextResponse.json({ error: "Chemin de média requis pour ce type de message." }, { status: 400 });
    }

    const context = await getAuthorizationContext();
    const { user, tenantIds } = context;

    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "messages.send")) {
      return NextResponse.json({ error: "Permission insuffisante pour envoyer un message." }, { status: 403 });
    }
    if (!tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Récupération de l'établissement
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id, name, owner_user_id, subscription_plan, activity_type")
      .eq("id", tenantId)
      .single();

    if (compErr || !company) {
      return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    }

    // 2. Contrôle de l'Option Avancée pour tout média
    const hasSpecialOption = companyHasSpecialOption(company);
    if (messageType !== "TEXT" && !hasSpecialOption) {
      return NextResponse.json(
        {
          error: "L'envoi de notes vocales, photos et vidéos est réservé aux établissements bénéficiant de l'Option Avancée (+50%).",
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    // 3. Vérification du destinataire dans le même établissement (si direct)
    if (recipientUserId) {
      const isRecipientOwner = company.owner_user_id === recipientUserId;
      const { data: recipientEmployee } = await admin
        .from("employees")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", recipientUserId)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!isRecipientOwner && !recipientEmployee) {
        return NextResponse.json({ error: "Destinataire introuvable dans cet établissement." }, { status: 403 });
      }
    }

    // 4. Insertion du message
    const fallbackText =
      messageText ||
      (messageType === "AUDIO" ? "Note vocale" : messageType === "IMAGE" ? "Photo partagée" : "Vidéo partagée");

    const { data: inserted, error: insertError } = await admin
      .from("internal_messages")
      .insert({
        tenant_id: tenantId,
        sender_user_id: user.id,
        recipient_user_id: recipientUserId,
        subject,
        body: fallbackText,
        message_type: messageType,
        media_path: mediaPath,
        media_name: mediaName,
        media_mime_type: mediaMimeType,
        media_size: mediaSize,
        event_type: eventType,
        metadata,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error("[messages/POST] Erreur insert:", insertError);
      return NextResponse.json({ error: "Impossible d'enregistrer le message." }, { status: 500 });
    }

    // 5. Génération de l'URL signée pour la réponse immédiate
    let mediaUrl: string | null = null;
    if (inserted.media_path) {
      const { data: signed } = await admin.storage
        .from("internal-message-media")
        .createSignedUrl(inserted.media_path, 3600);
      mediaUrl = signed?.signedUrl ?? null;
    }

    // 6. Notification Push du destinataire (ou de l'équipe)
    const { data: senderProf } = await admin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const senderName = [senderProf?.first_name, senderProf?.last_name].filter(Boolean).join(" ") || "Un collègue";

    const pushPreview =
      messageType === "AUDIO"
        ? "🎵 Note vocale"
        : messageType === "IMAGE"
        ? "📷 Photo"
        : messageType === "VIDEO"
        ? "🎥 Vidéo"
        : fallbackText.slice(0, 100);

    if (recipientUserId) {
      void sendMulticastPush(tenantId, [recipientUserId], {
        title: `💬 Message de ${senderName}`,
        body: pushPreview,
        actionPath: `/dashboard/messages?contactId=${user.id}`,
        eventType: "CHAT_MESSAGE",
      }).catch((e) => console.error("[messages] Push recipient error:", e));
    }

    return NextResponse.json(
      {
        message: {
          ...inserted,
          sender_name: senderName,
          media_url: mediaUrl,
          is_me: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[messages/POST] Erreur générale:", error);
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
