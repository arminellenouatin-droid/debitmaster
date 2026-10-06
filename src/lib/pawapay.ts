// DebitMaster PawaPay API Client Service
// Intégration officielle PawaPay v2 pour dépôts (abonnements, commandes), décaissements (commissions), et remboursements.

export type PawaPayEnv = "sandbox" | "production";

export class PawaPayError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "PawaPayError";
    this.status = status;
    this.code = code;
  }
}

export interface PawaPayPayer {
  type: "MMO";
  accountDetails: {
    phoneNumber: string; // Ex: "22997000000"
    provider: string;    // Ex: "MTN_MOMO_BEN", "MOOV_BEN", etc.
  };
}

export interface PawaPayDepositRequest {
  depositId: string;
  amount: string | number;
  currency: string;
  payer: PawaPayPayer;
  clientReferenceId?: string;
  customerMessage?: string;
  metadata?: Array<Record<string, string | boolean | number>>;
}

export interface PawaPayDepositResponse {
  depositId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  created?: string;
  nextStep?: string;
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}

export interface PawaPayPayoutRequest {
  payoutId: string;
  amount: string | number;
  currency: string;
  recipient: PawaPayPayer;
  clientReferenceId?: string;
  customerMessage?: string;
  metadata?: Array<Record<string, string | boolean | number>>;
}

export interface PawaPayPayoutResponse {
  payoutId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  created?: string;
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}

export interface PawaPayRefundRequest {
  refundId: string;
  depositId: string;
  amount: string | number;
  currency: string;
  clientReferenceId?: string;
  metadata?: Array<Record<string, string | boolean | number>>;
}

export interface PawaPayRefundResponse {
  refundId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  created?: string;
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}

const BASE_URLS: Record<PawaPayEnv, string> = {
  sandbox: "https://api.sandbox.pawapay.io",
  production: "https://api.pawapay.io",
};

export function cleanPhoneNumber(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/**
 * Détermine le code d'opérateur PawaPay selon le numéro de téléphone et le pays
 */
export function resolvePawaPayProvider(
  phoneRaw: string,
  countryCode = "BJ",
  preferredOperator?: string
): string {
  const phone = cleanPhoneNumber(phoneRaw);
  const operator = (preferredOperator || "").toUpperCase();

  // 1. Si l'opérateur est explicitement fourni
  if (operator === "MOOV") {
    if (countryCode === "BF" || phone.startsWith("226")) return "MOOV_BFA";
    if (countryCode === "CI" || phone.startsWith("225")) return "MOOV_CIV";
    return "MOOV_BEN";
  }
  if (operator === "ORANGE") {
    if (countryCode === "CI" || phone.startsWith("225")) return "ORANGE_CIV";
    if (countryCode === "CM" || phone.startsWith("237")) return "ORANGE_CMR";
    if (countryCode === "SN" || phone.startsWith("221")) return "ORANGE_SEN";
  }
  if (operator === "MTN" || operator === "MTN_MOMO") {
    if (countryCode === "CI" || phone.startsWith("225")) return "MTN_MOMO_CIV";
    if (countryCode === "CM" || phone.startsWith("237")) return "MTN_MOMO_CMR";
    return "MTN_MOMO_BEN";
  }
  if (operator === "FREE" || operator === "WAVE") {
    if (countryCode === "SN" || phone.startsWith("221")) return "FREE_SEN";
  }

  // 2. Détection par pays / préfixes
  // Bénin (+229)
  if (countryCode === "BJ" || phone.startsWith("229")) {
    const national = phone.startsWith("229") ? phone.slice(3) : phone;
    const moovPrefixes = ["95", "94", "64", "65", "55", "56", "57", "58", "60", "68", "69", "98", "99"];
    if (moovPrefixes.some((p) => national.startsWith(p))) {
      return "MOOV_BEN";
    }
    return "MTN_MOMO_BEN";
  }

  // Côte d'Ivoire (+225)
  if (countryCode === "CI" || phone.startsWith("225")) {
    const national = phone.startsWith("225") ? phone.slice(3) : phone;
    if (national.startsWith("05") || national.startsWith("04")) return "MTN_MOMO_CIV";
    if (national.startsWith("01")) return "MOOV_CIV";
    if (national.startsWith("07")) return "ORANGE_CIV";
    return "MTN_MOMO_CIV";
  }

  // Burkina Faso (+226)
  if (countryCode === "BF" || phone.startsWith("226")) {
    return "MOOV_BFA";
  }

  // Cameroun (+237)
  if (countryCode === "CM" || phone.startsWith("237")) {
    const national = phone.startsWith("237") ? phone.slice(3) : phone;
    if (national.startsWith("69") || national.startsWith("655")) return "ORANGE_CMR";
    return "MTN_MOMO_CMR";
  }

  // Sénégal (+221)
  if (countryCode === "SN" || phone.startsWith("221")) {
    const national = phone.startsWith("221") ? phone.slice(3) : phone;
    if (national.startsWith("76")) return "FREE_SEN";
    return "ORANGE_SEN";
  }

  // Défaut : Bénin MTN
  return "MTN_MOMO_BEN";
}

export function getPawaPayConfig() {
  const env: PawaPayEnv = (process.env.PAWAPAY_ENV as PawaPayEnv) || "sandbox";
  const token =
    env === "production"
      ? process.env.PAWAPAY_API_TOKEN_PROD || process.env.PAWAPAY_API_TOKEN || ""
      : process.env.PAWAPAY_API_TOKEN_SANDBOX || process.env.PAWAPAY_API_TOKEN || "";

  const baseUrl = BASE_URLS[env] || BASE_URLS.sandbox;
  const callbackUrl =
    process.env.PAWAPAY_CALLBACK_URL || "https://debitmaster.vercel.app/api/webhooks/pawapay";

  return { env, token, baseUrl, callbackUrl };
}

async function pawapayFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { baseUrl, token } = getPawaPayConfig();
  if (!token) {
    throw new PawaPayError("Jeton API PawaPay manquant dans les variables d'environnement.", 503);
  }

  const url = `${baseUrl}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let parsedMessage = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      parsedMessage =
        parsed.failureReason?.failureMessage ||
        parsed.message ||
        parsed.error ||
        errorBody;
    } catch {
      // keep raw errorBody
    }
    throw new PawaPayError(`Erreur PawaPay (${response.status}): ${parsedMessage}`, response.status);
  }

  return response.json();
}

/**
 * Initie un paiement / encaissement Mobile Money (Abonnement SaaS ou Commande)
 */
export async function initiateDeposit(
  payload: PawaPayDepositRequest
): Promise<PawaPayDepositResponse> {
  // PawaPay contraint customerMessage à 22 caractères max
  const safeMessage = (payload.customerMessage || "Paiement SaaS").slice(0, 22);
  const safeAmount = String(Math.round(Number(payload.amount)));

  const body = {
    ...payload,
    amount: safeAmount,
    customerMessage: safeMessage,
    payer: {
      type: "MMO",
      accountDetails: {
        phoneNumber: cleanPhoneNumber(payload.payer.accountDetails.phoneNumber),
        provider: payload.payer.accountDetails.provider,
      },
    },
  };

  return pawapayFetch<PawaPayDepositResponse>("/v2/deposits", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Initie un décaissement Mobile Money (Commission d'affilié ou retrait marchand)
 */
export async function initiatePayout(
  payload: PawaPayPayoutRequest
): Promise<PawaPayPayoutResponse> {
  const safeMessage = (payload.customerMessage || "Commission affilié").slice(0, 22);
  const safeAmount = String(Math.round(Number(payload.amount)));

  const body = {
    ...payload,
    amount: safeAmount,
    customerMessage: safeMessage,
    recipient: {
      type: "MMO",
      accountDetails: {
        phoneNumber: cleanPhoneNumber(payload.recipient.accountDetails.phoneNumber),
        provider: payload.recipient.accountDetails.provider,
      },
    },
  };

  return pawapayFetch<PawaPayPayoutResponse>("/v2/payouts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Initie un remboursement Mobile Money vers le client
 */
export async function initiateRefund(
  payload: PawaPayRefundRequest
): Promise<PawaPayRefundResponse> {
  const safeAmount = String(Math.round(Number(payload.amount)));
  const body = {
    ...payload,
    amount: safeAmount,
  };

  return pawapayFetch<PawaPayRefundResponse>("/v2/refunds", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

type PawaPayStatusData = Record<string, unknown> & { status?: string };
type PawaPayStatusResponse = PawaPayStatusData & { data?: PawaPayStatusData };

/**
 * Vérifie le statut d'un dépôt avec extraction unifiée du statut
 */
export async function getDepositStatus(depositId: string): Promise<{
  status: string;
  depositId: string;
  data: PawaPayStatusData;
  raw: PawaPayStatusResponse;
}> {
  const res = await pawapayFetch<PawaPayStatusResponse>(`/v2/deposits/${encodeURIComponent(depositId)}`, {
    method: "GET",
  });

  const payloadData = res.data || res;
  const status = (payloadData.status || res.status || "PENDING").toUpperCase();

  return {
    status,
    depositId,
    data: payloadData,
    raw: res,
  };
}

/**
 * Vérifie le statut d'un virement (décaissement)
 */
export async function getPayoutStatus(payoutId: string): Promise<{
  status: string;
  payoutId: string;
  data: PawaPayStatusData;
  raw: PawaPayStatusResponse;
}> {
  const res = await pawapayFetch<PawaPayStatusResponse>(`/v2/payouts/${encodeURIComponent(payoutId)}`, {
    method: "GET",
  });

  const payloadData = res.data || res;
  const status = (payloadData.status || res.status || "PENDING").toUpperCase();

  return {
    status,
    payoutId,
    data: payloadData,
    raw: res,
  };
}

/**
 * Vérifie le statut d'un remboursement
 */
export async function getRefundStatus(refundId: string): Promise<{
  status: string;
  refundId: string;
  data: PawaPayStatusData;
  raw: PawaPayStatusResponse;
}> {
  const res = await pawapayFetch<PawaPayStatusResponse>(`/v2/refunds/${encodeURIComponent(refundId)}`, {
    method: "GET",
  });

  const payloadData = res.data || res;
  const status = (payloadData.status || res.status || "PENDING").toUpperCase();

  return {
    status,
    refundId,
    data: payloadData,
    raw: res,
  };
}
