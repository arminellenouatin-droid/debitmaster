// DebitManager MTN MoMo: couche serveur uniquement, XOF/Bénin configurable, aucun secret ne doit atteindre le navigateur.
import { randomUUID } from "node:crypto";

const DEFAULT_SANDBOX_BASE_URL = "https://sandbox.momodeveloper.mtn.com";

type MtnResponse = Record<string, unknown>;

type MtnConfig = {
  baseUrl: string;
  targetEnvironment: string;
  sandboxCurrency: string;
  collectionSubscriptionKey: string;
  disbursementSubscriptionKey: string;
  apiUser: string;
  apiKey: string;
  callbackUrl: string;
  countryCode: string;
};

export class MtnMomoError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerBody?: unknown,
    readonly providerHttpStatus?: number,
  ) {
    super(message);
    this.name = "MtnMomoError";
  }
}

function required(name: string, value: string | undefined) {
  if (!value?.trim()) throw new MtnMomoError(`Configuration MTN MoMo manquante : ${name}.`, 503);
  return value.trim();
}

function config(): MtnConfig {
  const targetEnvironment = process.env.MTN_MOMO_TARGET_ENVIRONMENT?.trim() || "sandbox";
  const baseUrl = process.env.MTN_MOMO_API_BASE_URL?.trim() || (targetEnvironment === "sandbox" ? DEFAULT_SANDBOX_BASE_URL : "");
  return {
    baseUrl: required("MTN_MOMO_API_BASE_URL", baseUrl).replace(/\/$/, ""),
    targetEnvironment,
    sandboxCurrency: process.env.MTN_MOMO_SANDBOX_CURRENCY?.trim().toUpperCase() || "EUR",
    collectionSubscriptionKey: required("MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY", process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY),
    disbursementSubscriptionKey: process.env.MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY?.trim() || "",
    apiUser: required("MTN_MOMO_API_USER", process.env.MTN_MOMO_API_USER),
    apiKey: required("MTN_MOMO_API_KEY", process.env.MTN_MOMO_API_KEY),
    callbackUrl: required("MTN_MOMO_CALLBACK_URL", process.env.MTN_MOMO_CALLBACK_URL),
    countryCode: process.env.MTN_MOMO_COUNTRY_CODE?.replace(/\D/g, "") || "229",
  };
}

function normalizeMsisdn(raw: string, countryCode: string) {
  let value = raw.replace(/\D/g, "");
  if (value.startsWith("00")) value = value.slice(2);
  if (value.startsWith(countryCode)) return value;
  if (value.length >= 8 && value.length <= 10) return `${countryCode}${value}`;
  throw new MtnMomoError("Numéro MTN MoMo invalide.", 400);
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as MtnResponse; } catch { return { raw: text }; }
}

async function request(path: string, init: RequestInit, expectedStatuses: number[] = [200]) {
  let response: Response;
  try {
    response = await fetch(`${config().baseUrl}${path}`, { ...init, cache: "no-store" });
  } catch (cause) {
    throw new MtnMomoError("MTN MoMo est temporairement indisponible. Réessayez dans quelques instants.", 503, { cause: cause instanceof Error ? cause.message : "network_error" });
  }
  const body = await parseResponse(response);
  if (!expectedStatuses.includes(response.status)) {
    const providerMessage = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "Réponse MTN MoMo inattendue.";
    const clientStatus = response.status === 401 || response.status === 403 ? 503 : response.status === 404 ? 503 : response.status >= 500 ? 503 : 502;
    throw new MtnMomoError(providerMessage, clientStatus, body, response.status);
  }
  return body as MtnResponse | null;
}

async function accessToken(product: "collection" | "disbursement") {
  const current = config();
  if (product === "disbursement" && !current.disbursementSubscriptionKey) throw new MtnMomoError("Le produit MTN MoMo Disbursement n’est pas configuré.", 503);
  const subscriptionKey = product === "collection" ? current.collectionSubscriptionKey : current.disbursementSubscriptionKey;
  const basic = Buffer.from(`${current.apiUser}:${current.apiKey}`, "utf8").toString("base64");
  const body = await request(`/${product}/token/`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Ocp-Apim-Subscription-Key": subscriptionKey, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "",
  });
  const token = body?.access_token;
  if (typeof token !== "string" || !token) throw new MtnMomoError("MTN MoMo n’a pas fourni de jeton d’accès.", 502, body);
  return { token, current, subscriptionKey };
}

function providerCurrency(current: MtnConfig, requestedCurrency: string) {
  const normalized = requestedCurrency.trim().toUpperCase() || "XOF";
  // MTN MoMo sandbox accepte EUR uniquement ; XOF reste la devise métier et production du Bénin.
  return current.targetEnvironment.toLowerCase() === "sandbox" ? current.sandboxCurrency : normalized;
}

export function isProviderCurrencyAccepted(providerCurrencyValue: string | undefined, businessCurrency: string) {
  if (!providerCurrencyValue?.trim()) return true;
  const current = config();
  const expected = providerCurrency(current, businessCurrency);
  return providerCurrencyValue.trim().toUpperCase() === expected;
}

function commonHeaders(token: string, subscriptionKey: string, referenceId: string, callbackUrl: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "X-Target-Environment": config().targetEnvironment,
    "X-Reference-Id": referenceId,
    "X-Callback-Url": callbackUrl,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function requestToPay(input: { amount: number; currency: string; customerPhone: string; externalId: string; payerMessage: string; payeeNote: string }) {
  const { token, current, subscriptionKey } = await accessToken("collection");
  const referenceId = randomUUID();
  const customer = normalizeMsisdn(input.customerPhone, current.countryCode);
  const currency = providerCurrency(current, input.currency);
  await request("/collection/v1_0/requesttopay", {
    method: "POST",
    headers: commonHeaders(token, subscriptionKey, referenceId, current.callbackUrl),
    body: JSON.stringify({ amount: String(Math.round(input.amount)), currency, externalId: input.externalId, payer: { partyIdType: "MSISDN", partyId: customer }, payerMessage: input.payerMessage.slice(0, 160), payeeNote: input.payeeNote.slice(0, 160) }),
  }, [202]);
  return { referenceId };
}

const statusRetryableHttpCodes = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function getCollectionStatus(referenceId: string) {
  const { token, current, subscriptionKey } = await accessToken("collection");
  const init = { method: "GET", headers: { Authorization: `Bearer ${token}`, "Ocp-Apim-Subscription-Key": subscriptionKey, "X-Target-Environment": current.targetEnvironment, Accept: "application/json" } } satisfies RequestInit;
  let lastError: MtnMomoError | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await request(`/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`, init);
    } catch (cause) {
      if (!(cause instanceof MtnMomoError)) throw cause;
      lastError = cause;
      if (!cause.providerHttpStatus || !statusRetryableHttpCodes.has(cause.providerHttpStatus) || attempt === 2) break;
      await wait(500 * (attempt + 1));
    }
  }
  throw lastError ?? new MtnMomoError("Statut MTN MoMo indisponible.", 503);
}

export async function transfer(input: { amount: number; currency: string; recipientPhone: string; externalId: string; payerMessage: string; payeeNote: string }) {
  const { token, current, subscriptionKey } = await accessToken("disbursement");
  const referenceId = randomUUID();
  const recipient = normalizeMsisdn(input.recipientPhone, current.countryCode);
  const currency = providerCurrency(current, input.currency);
  await request("/disbursement/v1_0/transfer", {
    method: "POST",
    headers: commonHeaders(token, subscriptionKey, referenceId, current.callbackUrl),
    body: JSON.stringify({ amount: String(Math.round(input.amount)), currency, externalId: input.externalId, payee: { partyIdType: "MSISDN", partyId: recipient }, payerMessage: input.payerMessage.slice(0, 160), payeeNote: input.payeeNote.slice(0, 160) }),
  }, [202]);
  return { referenceId };
}

export async function getTransferStatus(referenceId: string) {
  const { token, current, subscriptionKey } = await accessToken("disbursement");
  if (!subscriptionKey) throw new MtnMomoError("Le produit MTN MoMo Disbursement n’est pas configuré.", 503);
  return request(`/disbursement/v1_0/transfer/${encodeURIComponent(referenceId)}`, { method: "GET", headers: { Authorization: `Bearer ${token}`, "Ocp-Apim-Subscription-Key": subscriptionKey, "X-Target-Environment": current.targetEnvironment, Accept: "application/json" } });
}
