import { NextResponse } from "next/server";
import { canCommerce, canWriteCommerce, getCommerceContext, type CommerceContext } from "@/lib/commerce-auth";
import { requestHasSameOrigin } from "@/lib/request-security";
import { enforceCommerceRateLimit } from "@/lib/commerce-rate-limit";

export type CommerceApiOptions = {
  tenantId?: string;
  permission: string;
  write?: boolean;
  scope: string;
  limit?: number;
  windowSeconds?: number;
  ownerOnly?: boolean;
};

export type CommerceApiResult =
  | { context: CommerceContext; response?: never }
  | { context?: never; response: NextResponse };

export function requireCommerceSameOrigin(request: Request): NextResponse | null {
  return requestHasSameOrigin(request) ? null : NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
}

export async function readCommerceJson(request: Request, maxBytes = 64 * 1024): Promise<{ body?: Record<string, unknown>; response?: NextResponse }> {
  const originError = requireCommerceSameOrigin(request);
  if (originError) return { response: originError };
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { response: NextResponse.json({ error: "Le corps de la requête doit être en JSON." }, { status: 415 }) };
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) return { response: NextResponse.json({ error: "La requête dépasse la taille autorisée." }, { status: 413 }) };
  try {
    const reader = request.body?.getReader();
    if (!reader) return { response: NextResponse.json({ error: "Corps de requête manquant." }, { status: 400 }) };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { response: NextResponse.json({ error: "La requête dépasse la taille autorisée." }, { status: 413 }) };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { response: NextResponse.json({ error: "Un objet JSON est requis." }, { status: 400 }) };
    }
    return { body: parsed as Record<string, unknown> };
  } catch {
    return { response: NextResponse.json({ error: "Requête JSON invalide." }, { status: 400 }) };
  }
}

export async function readCommerceFormData(request: Request, maxBytes: number): Promise<{ form?: FormData; response?: NextResponse }> {
  const originError = requireCommerceSameOrigin(request);
  if (originError) return { response: originError };
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data") || !/boundary=/i.test(contentType)) {
    return { response: NextResponse.json({ error: "Un formulaire multipart valide est requis." }, { status: 415 }) };
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) return { response: NextResponse.json({ error: "Le téléversement dépasse la taille autorisée." }, { status: 413 }) };
  try {
    const reader = request.body?.getReader();
    if (!reader) return { response: NextResponse.json({ error: "Corps de téléversement manquant." }, { status: 400 }) };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { response: NextResponse.json({ error: "Le téléversement dépasse la taille autorisée." }, { status: 413 }) };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const replay = new Request(request.url, { method: request.method, headers, body: bytes });
    return { form: await replay.formData() };
  } catch {
    return { response: NextResponse.json({ error: "Formulaire multipart invalide." }, { status: 400 }) };
  }
}

export async function authorizeCommerceApi(request: Request, options: CommerceApiOptions): Promise<CommerceApiResult> {
  if (options.write && !requestHasSameOrigin(request)) {
    return { response: NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 }) };
  }
  const tenantId = options.tenantId ?? new URL(request.url).searchParams.get("tenantId") ?? undefined;
  const context = await getCommerceContext(tenantId);
  if (!context.user) return { response: NextResponse.json({ error: "Authentification requise." }, { status: 401 }) };
  if (!context.company || !context.tenantId) return { response: NextResponse.json({ error: "Établissement Commerce non autorisé." }, { status: 403 }) };
  if (options.ownerOnly && !context.isOwner) return { response: NextResponse.json({ error: "Seul le promoteur peut effectuer cette action." }, { status: 403 }) };
  if (!canCommerce(context, options.permission)) return { response: NextResponse.json({ error: "Permission insuffisante pour cette opération." }, { status: 403 }) };
  if (options.write && !canWriteCommerce(context)) return { response: NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 }) };
  const limited = await enforceCommerceRateLimit(context, options.scope, options.limit ?? (options.write ? 30 : 60), options.windowSeconds ?? 60);
  if (limited) return { response: limited };
  return { context };
}
