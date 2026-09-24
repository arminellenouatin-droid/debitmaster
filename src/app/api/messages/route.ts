// DebitMaster internal chat API: tenant-scoped direct conversations with private media.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { sendMulticastPush } from "@/lib/firebase/server";

const allowedMime = /^(audio\/(mpeg|mp4|ogg|webm|wav)|image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime)|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|zip))$/i;
const maxMediaSize = 25 * 1024 * 1024;
function errorResponse(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
async function authorizedTenant(tenantId: string) {
  const context = await getAuthorizationContext();
  if (!context.user) throw new Error("AUTH_REQUIRED");
  if (!can(context, "messages.view") && !can(context, "messages.send")) throw new Error("FORBIDDEN");
  if (!context.tenantIds.includes(tenantId)) throw new Error("TENANT_FORBIDDEN");
  return context;
}
async function attachMediaUrls(messages: any[]) {
  const admin = createSupabaseAdminClient();
  return Promise.all(messages.map(async (message) => {
    if (!message.media_path) return message;
    const { data } = await admin.storage.from("internal-message-media").createSignedUrl(message.media_path, 3600);
    return { ...message, media_url: data?.signedUrl ?? null };
  }));
}
export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    if (!tenantId) return errorResponse("Établissement requis.");
    const context = await authorizedTenant(tenantId);
    const userId = context.user!.id;
    const { data, error } = await context.supabase.from("internal_messages").select("id,tenant_id,sender_user_id,recipient_user_id,subject,body,message_type,media_path,media_name,media_mime_type,media_size,delivered_at,read_at,created_at").eq("tenant_id", tenantId).or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId},recipient_user_id.is.null`).order("created_at", { ascending: true }).limit(300);
    if (error) return errorResponse("Impossible de charger la conversation.", 500);
    const incoming = (data ?? []).filter((message) => message.recipient_user_id === userId && !message.delivered_at).map((message) => message.id);
    if (incoming.length) await createSupabaseAdminClient().from("internal_messages").update({ delivered_at: new Date().toISOString() }).in("id", incoming).eq("recipient_user_id", userId);
    return NextResponse.json({ messages: await attachMediaUrls(data ?? []) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message === "AUTH_REQUIRED") return errorResponse("Authentification requise.", 401);
    if (message === "FORBIDDEN") return errorResponse("Permission insuffisante pour consulter la messagerie.", 403);
    if (message === "TENANT_FORBIDDEN") return errorResponse("Établissement non autorisé.", 403);
    return errorResponse("Service temporairement indisponible.", 500);
  }
}
export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let tenantId = "", recipientUserId = "", subject = "", messageBody = "", messageType = "TEXT";
    let file: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      tenantId = String(form.get("tenantId") ?? ""); recipientUserId = String(form.get("recipientUserId") ?? ""); subject = String(form.get("subject") ?? "").trim().slice(0, 160); messageBody = String(form.get("message") ?? "").trim().slice(0, 2000); file = form.get("file") instanceof File ? form.get("file") as File : null;
    } else {
      const body = await request.json();
      tenantId = typeof body.tenantId === "string" ? body.tenantId : ""; recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId : ""; subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 160) : ""; messageBody = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    }
    if (!tenantId || !recipientUserId || (!messageBody && !file)) return errorResponse("Établissement, destinataire et contenu requis.");
    const context = await authorizedTenant(tenantId);
    if (!can(context, "messages.send")) return errorResponse("Permission insuffisante pour envoyer un message.", 403);
    if (recipientUserId === context.user!.id) return errorResponse("Vous ne pouvez pas vous envoyer un message.");
    const { data: recipient } = await context.supabase.from("employees").select("user_id").eq("tenant_id", tenantId).eq("user_id", recipientUserId).eq("status", "ACTIVE").is("deleted_at", null).maybeSingle();
    const { data: company } = await context.supabase.from("companies").select("owner_user_id,subscription_plan").eq("id", tenantId).is("deleted_at", null).maybeSingle();
    if (!recipient && company?.owner_user_id !== recipientUserId) return errorResponse("Destinataire inactif ou extérieur à l’établissement.", 403);
    if (file && file.type.startsWith("video/") && company?.subscription_plan !== "SPECIAL") return errorResponse("L’envoi de vidéos est disponible uniquement avec la formule supérieure.", 403);
    const admin = createSupabaseAdminClient();
    if (file) {
      if (file.size <= 0 || file.size > maxMediaSize) return errorResponse("Le fichier doit faire au maximum 25 Mo.");
      if (!allowedMime.test(file.type)) return errorResponse("Ce type de fichier n’est pas accepté.");
      messageType = file.type.startsWith("audio/") ? "AUDIO" : file.type.startsWith("image/") ? "IMAGE" : file.type.startsWith("video/") ? "VIDEO" : "DOCUMENT";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "fichier";
      uploadedPath = `${tenantId}/${context.user!.id}/${randomUUID()}-${safeName}`;
      const upload = await admin.storage.from("internal-message-media").upload(uploadedPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (upload.error) return errorResponse("Impossible de stocker la pièce jointe.", 500);
    }
    const { data, error } = await context.supabase.from("internal_messages").insert({ tenant_id: tenantId, sender_user_id: context.user!.id, recipient_user_id: recipientUserId, subject: subject || null, body: messageBody || null, message_type: messageType, media_path: uploadedPath, media_name: file?.name ?? null, media_mime_type: file?.type ?? null, media_size: file?.size ?? null }).select("id,tenant_id,sender_user_id,recipient_user_id,subject,body,message_type,media_path,media_name,media_mime_type,media_size,delivered_at,read_at,created_at").single();
    if (error) { if (uploadedPath) await admin.storage.from("internal-message-media").remove([uploadedPath]); return errorResponse("Impossible d’envoyer le message.", 400); }
    void sendMulticastPush(tenantId, [recipientUserId], {
      title: "Nouveau message",
      body: messageBody || (messageType === "VIDEO" ? "Vous avez reçu une vidéo." : messageType === "AUDIO" ? "Vous avez reçu un audio." : file ? "Vous avez reçu une pièce jointe." : "Vous avez reçu un message."),
      actionPath: "/dashboard/messages",
      eventType: "INTERNAL_MESSAGE",
      tag: `internal-message:${data.id}`,
    }).catch(() => undefined);
    return NextResponse.json({ message: (await attachMediaUrls([data]))[0] }, { status: 201 });
  } catch {
    if (uploadedPath) await createSupabaseAdminClient().storage.from("internal-message-media").remove([uploadedPath]);
    return errorResponse("Requête invalide.", 400);
  }
}
