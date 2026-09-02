// Design Read: outil de gestion interne, actions explicites, états toujours textuels et auditables, sans secret dans les logs.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthorizationContext } from "@/lib/authorization";

const errorResponse = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
const randomCode = () => `AFF${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
const temporaryPassword = () => `Dm!${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}a9`;

export async function GET() {
  const context = await getAuthorizationContext();
  if (!context.user) return errorResponse("Authentification requise", 401);
  if (!context.isPlatformAdmin) return errorResponse("Accès super-administration requis", 403);
  const { data, error } = await context.supabase.from("platform_affiliates").select("id,user_id,code,display_name,commission_rate,payout_threshold_xof,status,created_at").order("created_at", { ascending: false }).limit(500);
  if (error) return errorResponse("Lecture des affiliés impossible", 500);
  return NextResponse.json({ affiliates: data ?? [] });
}

export async function POST(request: Request) {
  const context = await getAuthorizationContext();
  if (!context.user) return errorResponse("Authentification requise", 401);
  if (!context.isPlatformAdmin) return errorResponse("Accès super-administration requis", 403);
  const body = await request.json().catch(() => null) as { displayName?: string; email?: string; phone?: string; code?: string } | null;
  const displayName = body?.displayName?.trim();
  const email = body?.email?.trim().toLowerCase();
  const phone = body?.phone?.trim() || null;
  if (!displayName || !email || !email.includes("@")) return errorResponse("Nom et e-mail valides requis");
  const code = normalizeCode(body?.code || "") || randomCode();
  const password = temporaryPassword();
  const admin = createSupabaseAdminClient();
  const created = await admin.auth.admin.createUser({ email, phone: phone || undefined, password, email_confirm: true, phone_confirm: Boolean(phone), user_metadata: { first_name: displayName, user_type: "AFFILIATE", role: "AFFILIATE" } });
  if (created.error || !created.data.user) return errorResponse(created.error?.message || "Création du compte affilié impossible", 400);
  const userId = created.data.user.id;
  const profile = await admin.from("profiles").upsert({ id: userId, tenant_id: null, first_name: displayName, last_name: null, phone, email, user_type: "AFFILIATE", role: "AFFILIATE", status: "ACTIVE", must_change_password: true, deleted_at: null }, { onConflict: "id" });
  if (profile.error) {
    await admin.auth.admin.deleteUser(userId);
    return errorResponse("Création du profil affilié impossible", 500);
  }
  const affiliate = await admin.from("platform_affiliates").insert({ user_id: userId, code, display_name: displayName, commission_rate: 15, payout_threshold_xof: 20000, status: "ACTIVE" }).select("id,user_id,code,display_name,commission_rate,payout_threshold_xof,status,created_at").single();
  if (affiliate.error) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return errorResponse(affiliate.error.code === "23505" ? "Ce code affilié existe déjà" : "Création de l’affilié impossible", 400);
  }
  return NextResponse.json({ affiliate: affiliate.data, temporaryPassword: password }, { status: 201 });
}
