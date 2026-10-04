// DebitMaster call signaling API: Contrôle serveur et journalisation des appels audio et vidéo WebRTC, réservés à l'Option Avancée.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { companyHasSpecialOption } from "@/lib/subscription-plans";
import { sendMulticastPush } from "@/lib/firebase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId : "";
    const action = typeof body.action === "string" ? body.action.toUpperCase() : "";
    const callType = body.callType === "VIDEO" ? "VIDEO" : "AUDIO";
    const duration = typeof body.duration === "number" && body.duration > 0 ? Math.floor(body.duration) : 0;

    if (!tenantId || !recipientUserId || !action) {
      return NextResponse.json({ error: "Paramètres d'appel manquants." }, { status: 400 });
    }

    const context = await getAuthorizationContext();
    const { user, tenantIds } = context;

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (!can(context, "messages.send")) {
      return NextResponse.json({ error: "Permission insuffisante pour initier un appel." }, { status: 403 });
    }
    if (!tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Vérification Option Avancée obligatoire pour les appels
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id, name, owner_user_id, subscription_plan, activity_type")
      .eq("id", tenantId)
      .single();

    if (compErr || !company) {
      return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    }

    const hasSpecialOption = companyHasSpecialOption(company);
    if (!hasSpecialOption) {
      return NextResponse.json(
        {
          error: "Les appels audio et vidéo sont réservés aux établissements bénéficiant de l'Option Avancée (+50%).",
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    // 2. Vérification que le destinataire appartient bien au même établissement (isolation étanche)
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

    // 3. Récupération du profil de l'appelant
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const callerName = [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(" ") || "Un collègue";

    // 4. Si c'est un appel entrant (RINGING ou OFFER), alerter le destinataire par push
    if (action === "RINGING" || action === "OFFER") {
      const callIcon = callType === "VIDEO" ? "📹" : "📞";
      const callLabel = callType === "VIDEO" ? "vidéo" : "audio";
      void sendMulticastPush(tenantId, [recipientUserId], {
        title: `${callIcon} Appel ${callLabel} entrant`,
        body: `${callerName} vous appelle en direct...`,
        actionPath: `/dashboard/messages?contactId=${user.id}&incomingCall=1`,
        eventType: "CALL_INCOMING",
      }).catch((e) => console.error("[call-signal] Push warning:", e));
    }

    // 5. Journaliser l'événement d'appel dans la conversation si l'appel se termine, est refusé ou manqué
    if (["END", "DECLINE", "MISSED"].includes(action)) {
      let eventBody = "";
      const callLabel = callType === "VIDEO" ? "vidéo" : "audio";
      if (action === "MISSED") {
        eventBody = `Appel ${callLabel} sans réponse`;
      } else if (action === "DECLINE") {
        eventBody = `Appel ${callLabel} refusé`;
      } else {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        eventBody = `Appel ${callLabel} terminé (${durStr})`;
      }

      await admin.from("internal_messages").insert({
        tenant_id: tenantId,
        sender_user_id: user.id,
        recipient_user_id: recipientUserId,
        subject: `Appel ${callLabel}`,
        body: eventBody,
        message_type: "TEXT",
        event_type: callType === "VIDEO" ? "CALL_VIDEO" : "CALL_AUDIO",
        metadata: {
          callType,
          action,
          duration,
        },
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("[call-signal] Erreur:", error);
    return NextResponse.json({ error: "Erreur lors du traitement du signal d'appel." }, { status: 500 });
  }
}
