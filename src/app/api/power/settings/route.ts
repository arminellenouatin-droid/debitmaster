// DebitManager Power settings: owner-only preferences and encrypted MTN MoMo credentials, never returned in plaintext.
import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/authorization";
import { encryptMtnMomoCredentials, last4 } from "@/lib/mtn-momo-credentials";

const credentialFields = ["apiUser", "apiKey", "collectionSubscriptionKey", "disbursementSubscriptionKey"] as const;
type CredentialField = (typeof credentialFields)[number];

async function isPowerOwner(context: Awaited<ReturnType<typeof getAuthorizationContext>>, tenantId: string) {
  if (!context.user || context.employeeId !== null || context.role !== "ADMINISTRATEUR" || !context.tenantIds.includes(tenantId)) return false;
  const { data } = await context.supabase.from("companies").select("id").eq("id", tenantId).eq("owner_user_id", context.user.id).eq("activity_type", "POWER").is("deleted_at", null).maybeSingle();
  return Boolean(data?.id);
}

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    if (!(await isPowerOwner(context, tenantId))) return NextResponse.json({ error: "Seul le propriétaire d’un établissement Power peut consulter ces réglages." }, { status: 403 });
    const [{ data: company, error: companyError }, { data: credentials, error: credentialsError }] = await Promise.all([
      context.supabase.from("companies").select("zones_tables_enabled,payment_mode").eq("id", tenantId).single(),
      context.supabase.from("tenant_momo_credentials").select("last4_api_user,last4_api_key,last4_collection_key,last4_disbursement_key,updated_at").eq("tenant_id", tenantId).maybeSingle(),
    ]);
    if (companyError || credentialsError) return NextResponse.json({ error: "Impossible de charger les réglages Power." }, { status: 500 });
    return NextResponse.json({ settings: { zonesTablesEnabled: company?.zones_tables_enabled ?? true, paymentMode: company?.payment_mode ?? "SIMPLE", personalMtnConfigured: Boolean(credentials), personalMtnUpdatedAt: credentials?.updated_at ?? null, personalMtnLast4: credentials ? { apiUser: credentials.last4_api_user, apiKey: credentials.last4_api_key, collection: credentials.last4_collection_key, disbursement: credentials.last4_disbursement_key } : null } });
  } catch {
    return NextResponse.json({ error: "Réglages Power temporairement indisponibles." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { tenantId?: unknown; zonesTablesEnabled?: unknown; paymentMode?: unknown; credentials?: Partial<Record<CredentialField, unknown>> };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const context = await getAuthorizationContext();
    if (!(await isPowerOwner(context, tenantId))) return NextResponse.json({ error: "Seul le propriétaire d’un établissement Power peut modifier ces réglages." }, { status: 403 });
    const updates: { zones_tables_enabled?: boolean; payment_mode?: "SIMPLE" | "PERSONNEL" } = {};
    if (typeof body.zonesTablesEnabled === "boolean") updates.zones_tables_enabled = body.zonesTablesEnabled;
    if (body.paymentMode === "SIMPLE" || body.paymentMode === "PERSONNEL") updates.payment_mode = body.paymentMode;
    if (!Object.keys(updates).length && !body.credentials) return NextResponse.json({ error: "Aucun réglage valide à enregistrer." }, { status: 400 });
    if (Object.keys(updates).length) {
      const { error } = await context.supabase.from("companies").update(updates).eq("id", tenantId);
      if (error) return NextResponse.json({ error: "Impossible d’enregistrer les réglages Power." }, { status: 400 });
    }
    if (body.credentials) {
      const values = Object.fromEntries(credentialFields.map((field) => [field, typeof body.credentials?.[field] === "string" ? body.credentials[field].trim() : ""])) as Record<CredentialField, string>;
      if (credentialFields.some((field) => values[field].length < 8)) return NextResponse.json({ error: "Les quatre paramètres MTN MoMo sont requis pour une nouvelle configuration." }, { status: 400 });
      const encryptedPayload = encryptMtnMomoCredentials({ apiUser: values.apiUser, apiKey: values.apiKey, collectionSubscriptionKey: values.collectionSubscriptionKey, disbursementSubscriptionKey: values.disbursementSubscriptionKey });
      const { error } = await context.supabase.from("tenant_momo_credentials").upsert({ tenant_id: tenantId, encrypted_payload: encryptedPayload, key_version: "v1", last4_api_user: last4(values.apiUser), last4_api_key: last4(values.apiKey), last4_collection_key: last4(values.collectionSubscriptionKey), last4_disbursement_key: last4(values.disbursementSubscriptionKey), updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
      if (error) return NextResponse.json({ error: "Impossible d’enregistrer la configuration MTN MoMo Personnel." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "Réglages Power enregistrés. Les secrets complets ne sont jamais renvoyés." });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Réglages Power temporairement indisponibles.";
    return NextResponse.json({ error: message.includes("ENCRYPTION_KEY") ? "Le chiffrement serveur n’est pas encore configuré." : "Réglages Power temporairement indisponibles." }, { status: 500 });
  }
}
