// DebitMaster FCM v1: Envoi push direct via l'API officielle Google Cloud Messaging v1.
// Authentification OAuth2 sans dépendance tierce lourde (crypto RSA-SHA256 native).

import { createSign } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface PushPayload {
  title: string;
  body: string;
  actionPath: string;
  eventType: string;
  tag?: string | null;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function getServiceAccountCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "debitmaster";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  // Si la clé privée contient des retours à la ligne échappés
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  // Nettoyage des éventuels guillemets englobants
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  return { projectId, clientEmail, privateKey };
}

function base64UrlEncode(str: string | Buffer): string {
  const buffer = typeof str === "string" ? Buffer.from(str, "utf8") : str;
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiresAt - 300) {
    return cachedAccessToken;
  }

  try {
    const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const claimSet = JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    });

    const encodedHeader = base64UrlEncode(header);
    const encodedClaimSet = base64UrlEncode(claimSet);
    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

    const signer = createSign("RSA-SHA256");
    signer.update(signatureInput);
    signer.end();
    const signature = signer.sign(privateKey);
    const jwt = `${signatureInput}.${base64UrlEncode(signature)}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[FCM] Erreur obtention jeton OAuth2 Google", response.status);
      return null;
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    cachedAccessToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in ?? 3600);
    return cachedAccessToken;
  } catch (error) {
    console.error("[FCM] Échec d'authentification Google Service Account", error instanceof Error ? error.message : error);
    return null;
  }
}

async function sendFcmV1Message(projectId: string, accessToken: string, token: string, payload: PushPayload) {
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  const messageBody = {
    message: {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        actionPath: payload.actionPath,
        eventType: payload.eventType,
        url: payload.actionPath,
      },
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          requireInteraction: true,
          tag: payload.tag || undefined,
          data: {
            actionPath: payload.actionPath,
            url: payload.actionPath,
          },
        },
        fcm_options: {
          link: payload.actionPath,
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messageBody),
    cache: "no-store",
  });

  return response;
}

export async function sendMulticastPush(
  tenantId: string,
  recipientUserIds: string[],
  payload: PushPayload
): Promise<void> {
  if (!recipientUserIds.length || !tenantId) return;

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    // Les notifications push sont silencieuses si Firebase Admin n'est pas encore configuré
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: tokens, error: tokenError } = await admin
      .from("user_push_tokens")
      .select("id, token, user_id")
      .eq("tenant_id", tenantId)
      .in("user_id", recipientUserIds)
      .eq("is_active", true)
      .limit(100);

    if (tokenError || !tokens || !tokens.length) {
      return;
    }

    const accessToken = await getGoogleAccessToken(credentials.clientEmail, credentials.privateKey);
    if (!accessToken) return;

    const deadTokenIds: string[] = [];

    await Promise.allSettled(
      tokens.map(async ({ id, token }) => {
        try {
          const res = await sendFcmV1Message(credentials.projectId, accessToken, token, payload);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errStatus = (errData as { error?: { status?: string } })?.error?.status;
            if (res.status === 404 || errStatus === "UNREGISTERED" || errStatus === "INVALID_ARGUMENT") {
              deadTokenIds.push(id);
            }
          }
        } catch {
          // Erreur réseau tolérée pour un terminal individuel
        }
      })
    );

    // Nettoyage en arrière-plan des tokens obsolètes / désinstallés
    if (deadTokenIds.length > 0) {
      await admin.from("user_push_tokens").update({ is_active: false }).in("id", deadTokenIds);
    }
  } catch (err) {
    console.error("[FCM] Service push temporairement indisponible", err instanceof Error ? err.message : err);
  }
}
