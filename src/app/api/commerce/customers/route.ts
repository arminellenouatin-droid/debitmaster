import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const codePattern = /^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,39}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPhone = (value: string) => /^[+\d][\d\s()./-]{4,31}$/.test(value);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") ?? "").trim();
    const status = url.searchParams.get("status") ?? "ACTIVE";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = Math.min(100000, Math.max(0, Number(url.searchParams.get("offset") ?? 0)));
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || (search && !/^[\p{L}\p{N} ._@+/-]{1,80}$/u.test(search)) || !["ACTIVE", "ARCHIVED", "ALL"].includes(status)) return NextResponse.json({ error: "Filtres clients invalides." }, { status: 400 });
    const access = await authorizeCommerceApi(request, { permission: "customers.view", scope: "customers:read" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    let query = admin.from("commerce_customers").select("id,customer_code,customer_type,display_name,business_name,phone,email,address,city,country,tax_number,customer_category,price_list,credit_limit_xof,payment_terms_days,loyalty_points,is_walk_in,notes,status,created_at,updated_at", { count: "exact" })
      .eq("tenant_id", access.context.tenantId).order("is_walk_in", { ascending: false }).order("display_name", { ascending: true }).order("id", { ascending: true }).range(offset, offset + limit - 1);
    if (status !== "ALL") query = query.eq("status", status);
    if (search) query = query.or(`display_name.ilike.${search}%,business_name.ilike.${search}%,customer_code.ilike.${search}%,phone.ilike.${search}%,email.ilike.${search}%`);
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les clients." }, { status: 500 });
    return NextResponse.json({ customers: data ?? [], total: count ?? data?.length ?? 0, limit, offset, accessMode: access.context.accessMode });
  } catch {
    return NextResponse.json({ error: "Service Commerce temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await readCommerceJson(request);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const customerType = body.customerType === "BUSINESS" ? "BUSINESS" : body.customerType === undefined || body.customerType === "INDIVIDUAL" ? "INDIVIDUAL" : null;
    const customerCode = typeof body.customerCode === "string" && body.customerCode.trim() ? body.customerCode.trim() : null;
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() || null : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    const priceList = ["RETAIL", "SEMI_WHOLESALE", "WHOLESALE"].includes(String(body.priceList)) ? String(body.priceList) : "RETAIL";
    const creditLimit = Number(body.creditLimitXof ?? 0);
    const paymentTerms = Number(body.paymentTermsDays ?? 0);
    if (!customerType || displayName.length < 2 || displayName.length > 160 || (customerType === "BUSINESS" && !businessName) || (customerCode && !codePattern.test(customerCode)) || (phone && !validPhone(phone)) || (email && (email.length > 254 || !emailPattern.test(email))) || !Number.isSafeInteger(creditLimit) || creditLimit < 0 || !Number.isInteger(paymentTerms) || paymentTerms < 0 || paymentTerms > 365) {
      return NextResponse.json({ error: "Vérifiez le nom, le type, les coordonnées et les conditions du client." }, { status: 400 });
    }
    for (const key of ["address", "city", "country", "taxNumber", "customerCategory", "notes"]) if (body[key] !== undefined && typeof body[key] !== "string") return NextResponse.json({ error: "Un champ de la fiche client est invalide." }, { status: 400 });
    const access = await authorizeCommerceApi(request, { tenantId, permission: "customers.manage", write: true, scope: "customers:write" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("commerce_customers").insert({
      tenant_id: access.context.tenantId, customer_code: customerCode, customer_type: customerType, display_name: displayName,
      business_name: businessName, phone, email, address: typeof body.address === "string" ? body.address.trim().slice(0, 300) || null : null,
      city: typeof body.city === "string" ? body.city.trim().slice(0, 100) || null : null,
      country: typeof body.country === "string" ? body.country.trim().slice(0, 100) || null : null,
      tax_number: typeof body.taxNumber === "string" ? body.taxNumber.trim().slice(0, 80) || null : null,
      customer_category: typeof body.customerCategory === "string" ? body.customerCategory.trim().slice(0, 80) || null : null,
      price_list: priceList, credit_limit_xof: creditLimit, payment_terms_days: paymentTerms,
      notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null,
      created_by: access.context.user!.id, updated_by: access.context.user!.id,
    }).select("id,customer_code,customer_type,display_name,business_name,phone,email,price_list,credit_limit_xof,payment_terms_days,is_walk_in,status,created_at").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Ce code client est déjà utilisé." : "Impossible d’enregistrer le client." }, { status: error?.code === "23505" ? 409 : 400 });
    return NextResponse.json({ customer: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête Commerce invalide." }, { status: 400 });
  }
}
