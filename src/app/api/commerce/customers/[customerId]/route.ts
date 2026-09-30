import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,39}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPhone = (value: string) => /^[+\d][\d\s()./-]{4,31}$/.test(value);
type RouteContext = { params: Promise<{ customerId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { customerId } = await params;
    if (!uuidPattern.test(customerId)) return NextResponse.json({ error: "Client invalide." }, { status: 400 });
    const parsed = await readCommerceJson(request);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const access = await authorizeCommerceApi(request, { tenantId, permission: "customers.manage", write: true, scope: "customers:write" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin.from("commerce_customers").select("*").eq("id", customerId).eq("tenant_id", access.context.tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    if (existing.is_walk_in) return NextResponse.json({ error: "Le client comptoir automatique ne peut pas être modifié ou archivé." }, { status: 403 });
    const displayName = body.displayName === undefined ? existing.display_name : typeof body.displayName === "string" ? body.displayName.trim() : "";
    const customerType = body.customerType === undefined ? existing.customer_type : body.customerType;
    const customerCode = body.customerCode === undefined ? existing.customer_code : typeof body.customerCode === "string" ? body.customerCode.trim() || null : null;
    const phone = body.phone === undefined ? existing.phone : typeof body.phone === "string" ? body.phone.trim() || null : null;
    const email = body.email === undefined ? existing.email : typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    const creditLimit = body.creditLimitXof === undefined ? Number(existing.credit_limit_xof) : Number(body.creditLimitXof);
    const paymentTerms = body.paymentTermsDays === undefined ? existing.payment_terms_days : Number(body.paymentTermsDays);
    const priceList = body.priceList === undefined ? existing.price_list : body.priceList;
    const businessName = body.businessName === undefined ? existing.business_name : typeof body.businessName === "string" ? body.businessName.trim() || null : null;
    const status = body.status === undefined ? existing.status : body.status;
    if (!(["INDIVIDUAL", "BUSINESS"].includes(String(customerType))) || displayName.length < 2 || displayName.length > 160 || (customerType === "BUSINESS" && !businessName) || (customerCode && !codePattern.test(customerCode)) || (phone && !validPhone(phone)) || (email && (email.length > 254 || !emailPattern.test(email))) || !Number.isSafeInteger(creditLimit) || creditLimit < 0 || !Number.isInteger(paymentTerms) || paymentTerms < 0 || paymentTerms > 365 || !["RETAIL", "SEMI_WHOLESALE", "WHOLESALE"].includes(String(priceList)) || !["ACTIVE", "ARCHIVED"].includes(String(status))) return NextResponse.json({ error: "Vérifiez les informations du client." }, { status: 400 });
    const optionalFields = ["address", "city", "country", "taxNumber", "customerCategory", "notes"] as const;
    for (const key of optionalFields) if (body[key] !== undefined && typeof body[key] !== "string") return NextResponse.json({ error: "Un champ de la fiche client est invalide." }, { status: 400 });
    const getField = (key: typeof optionalFields[number], max: number, oldValue: string | null) => body[key] === undefined ? oldValue : String(body[key]).trim().slice(0, max) || null;
    const { data, error } = await admin.from("commerce_customers").update({
      customer_code: customerCode, customer_type: customerType, display_name: displayName, business_name: businessName,
      phone, email, address: getField("address", 300, existing.address), city: getField("city", 100, existing.city),
      country: getField("country", 100, existing.country), tax_number: body.taxNumber === undefined ? existing.tax_number : String(body.taxNumber).trim().slice(0, 80) || null,
      customer_category: getField("customerCategory", 80, existing.customer_category), notes: getField("notes", 1000, existing.notes),
      price_list: priceList, credit_limit_xof: creditLimit, payment_terms_days: paymentTerms, status,
      updated_by: access.context.user!.id, updated_at: new Date().toISOString(),
    }).eq("id", customerId).eq("tenant_id", access.context.tenantId).select("id,customer_code,customer_type,display_name,business_name,phone,email,price_list,credit_limit_xof,payment_terms_days,is_walk_in,status,updated_at").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Ce code client est déjà utilisé." : "Impossible de modifier le client." }, { status: error?.code === "23505" ? 409 : 400 });
    return NextResponse.json({ customer: data });
  } catch {
    return NextResponse.json({ error: "Requête Commerce invalide." }, { status: 400 });
  }
}
