// DebitManager Power: credentials MTN MoMo are encrypted server-side; plaintext never crosses the client boundary or enters logs.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MtnMomoCredentials = {
  apiUser: string;
  apiKey: string;
  collectionSubscriptionKey: string;
  disbursementSubscriptionKey: string;
};

function encryptionKey() {
  const configured = process.env.MTN_MOMO_CREDENTIALS_ENCRYPTION_KEY;
  if (!configured) throw new Error("MTN_MOMO_CREDENTIALS_ENCRYPTION_KEY manquante.");
  return createHash("sha256").update(configured, "utf8").digest();
}

export function encryptMtnMomoCredentials(credentials: MtnMomoCredentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptMtnMomoCredentials(payload: string): MtnMomoCredentials {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Credentials MTN MoMo chiffrés invalides.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plaintext) as Partial<MtnMomoCredentials>;
  if (!parsed.apiUser || !parsed.apiKey || !parsed.collectionSubscriptionKey || !parsed.disbursementSubscriptionKey) throw new Error("Credentials MTN MoMo incomplets.");
  return parsed as MtnMomoCredentials;
}

export function last4(value: string) {
  return value.slice(-4);
}

export async function loadTenantMtnMomoCredentials(supabase: SupabaseClient, tenantId: string) {
  const { data: company } = await supabase.from("companies").select("payment_mode").eq("id", tenantId).maybeSingle();
  if (company?.payment_mode !== "PERSONNEL") return null;
  const { data, error } = await supabase.from("tenant_momo_credentials").select("encrypted_payload").eq("tenant_id", tenantId).maybeSingle();
  if (error || !data?.encrypted_payload) throw new Error("Configuration MTN MoMo Personnel manquante.");
  return decryptMtnMomoCredentials(data.encrypted_payload);
}
