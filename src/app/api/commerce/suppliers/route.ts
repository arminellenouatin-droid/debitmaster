import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const codePattern = /^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,39}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPhone = (value: string) => /^[+\d][\d\s()./-]{4,31}$/.test(value);
const nullableScore = (value: unknown) => value === undefined || value === null || String(value).trim() === "" ? null : Number(value);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") ?? "").trim();
    const status = url.searchParams.get("status") ?? "ACTIVE";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = Math.min(100000, Math.max(0, Number(url.searchParams.get("offset") ?? 0)));
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || (search && !/^[\p{L}\p{N} ._@+/-]{1,80}$/u.test(search)) || !["ACTIVE", "ARCHIVED", "ALL"].includes(status)) return NextResponse.json({ error: "Filtres fournisseurs invalides." }, { status: 400 });
    const access = await authorizeCommerceApi(request, { permission: "suppliers.view", scope: "suppliers:read" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    let query = admin.from("commerce_suppliers").select("id,supplier_code,name,contact_name,phone,email,address,city,country,tax_number,payment_terms_days,lead_time_days,delivery_score,quality_score,notes,status,created_at,updated_at", { count: "exact" })
      .eq("tenant_id", access.context.tenantId).order("name", { ascending: true }).order("id", { ascending: true }).range(offset, offset + limit - 1);
    if (status !== "ALL") query = query.eq("status", status);
    if (search) query = query.or(`name.ilike.${search}%,supplier_code.ilike.${search}%,contact_name.ilike.${search}%,phone.ilike.${search}%,email.ilike.${search}%`);
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les fournisseurs." }, { status: 500 });
    return NextResponse.json({ suppliers: data ?? [], total: count ?? data?.length ?? 0, limit, offset, accessMode: access.context.accessMode });
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const supplierCode = typeof body.supplierCode === "string" && body.supplierCode.trim() ? body.supplierCode.trim() : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    const paymentTermsDays = Number(body.paymentTermsDays ?? 0);
    const leadTimeDays = body.leadTimeDays === undefined || body.leadTimeDays === null || String(body.leadTimeDays).trim() === "" ? null : Number(body.leadTimeDays);
    const deliveryScore = nullableScore(body.deliveryScore);
    const qualityScore = nullableScore(body.qualityScore);
    if (name.length < 2 || name.length > 160 || (supplierCode && !codePattern.test(supplierCode)) || (phone && !validPhone(phone)) || (email && (email.length > 254 || !emailPattern.test(email))) || !Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365 || (leadTimeDays !== null && (!Number.isInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 365)) || [deliveryScore, qualityScore].some((score) => score !== null && (!Number.isFinite(score) || score < 0 || score > 5))) {
      return NextResponse.json({ error: "Vérifiez le nom, les coordonnées, les délais et les scores du fournisseur." }, { status: 400 });
    }
    for (const key of ["contactName", "address", "city", "country", "taxNumber", "notes"]) if (body[key] !== undefined && typeof body[key] !== "string") return NextResponse.json({ error: "Un champ de la fiche fournisseur est invalide." }, { status: 400 });
    const access = await authorizeCommerceApi(request, { tenantId, permission: "suppliers.manage", write: true, scope: "suppliers:write" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("commerce_suppliers").insert({
      tenant_id: access.context.tenantId, supplier_code: supplierCode, name,
      contact_name: typeof body.contactName === "string" ? body.contactName.trim().slice(0, 160) || null : null,
      phone, email, address: typeof body.address === "string" ? body.address.trim().slice(0, 300) || null : null,
      city: typeof body.city === "string" ? body.city.trim().slice(0, 100) || null : null,
      country: typeof body.country === "string" ? body.country.trim().slice(0, 100) || null : null,
      tax_number: typeof body.taxNumber === "string" ? body.taxNumber.trim().slice(0, 80) || null : null,
      payment_terms_days: paymentTermsDays, lead_time_days: leadTimeDays, delivery_score: deliveryScore, quality_score: qualityScore,
      notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null,
      created_by: access.context.user!.id, updated_by: access.context.user!.id,
    }).select("id,supplier_code,name,contact_name,phone,email,payment_terms_days,lead_time_days,delivery_score,quality_score,status,created_at").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Ce code fournisseur est déjà utilisé." : "Impossible d’enregistrer le fournisseur." }, { status: error?.code === "23505" ? 409 : 400 });
    return NextResponse.json({ supplier: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête Commerce invalide." }, { status: 400 });
  }
}
