import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { CommerceContext } from "@/lib/commerce-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function enforceCommerceRateLimit(
  context: CommerceContext,
  scope: string,
  limit = 30,
  windowSeconds = 60,
): Promise<NextResponse | null> {
  if (!context.user || !context.tenantId || !/^[a-z0-9:_-]{2,80}$/i.test(scope)) {
    return NextResponse.json({ error: "Requête non autorisée." }, { status: 401 });
  }

  const windowMs = windowSeconds * 1000;
  const bucket = Math.floor(Date.now() / windowMs);
  const expiresAt = new Date((bucket + 1) * windowMs + 60_000).toISOString();
  const keyHash = createHash("sha256")
    .update(`${context.user.id}:${context.tenantId}:${scope}:${bucket}`)
    .digest("hex");

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_commerce_rate_limit", {
      p_key_hash: keyHash,
      p_limit: limit,
      p_expires_at: expiresAt,
    });
    if (error || typeof data !== "boolean") {
      return NextResponse.json({ error: "Protection temporairement indisponible. Réessayez plus tard." }, { status: 503 });
    }
    if (!data) {
      return NextResponse.json({ error: "Trop de requêtes. Veuillez patienter avant de réessayer." }, {
        status: 429,
        headers: { "Retry-After": String(windowSeconds) },
      });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Protection temporairement indisponible. Réessayez plus tard." }, { status: 503 });
  }
}
