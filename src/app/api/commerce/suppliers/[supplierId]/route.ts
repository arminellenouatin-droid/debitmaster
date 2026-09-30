import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceJson } from "@/lib/commerce-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,39}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPhone = (value: string) => /^[+\d][\d\s()./-]{4,31}$/.test(value);
type RouteContext = { params: Promise<{ supplierId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { supplierId } = await params;
    if (!uuidPattern.test(supplierId)) return NextResponse.json({ error: "Fournisseur invalide." }, { status: 400 });
    const parsed = await readCommerceJson(request);
    if (parsed.response) return parsed.response;
    const body = parsed.body!;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const access = await authorizeCommerceApi(request, { tenantId, permission: "suppliers.manage", write: true, scope: "suppliers:write" });
    if (access.response) return access.response;
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin.from("commerce_suppliers").select("*").eq("id", supplierId).eq("tenant_id", access.context.tenantId).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });
    const pickText = (key: string, oldValue: string | null, max: number) => {
      if (body[key] === undefined) return oldValue;
      if (typeof body[key] !== "string") throw new Error("Un champ de la fiche fournisseur est invalide.");
      return body[key].trim().slice(0, max) || null;
    };
    const name = body.name === undefined ? existing.name : typeof body.name === "string" ? body.name.trim() : "";
    const supplierCode = body.supplierCode === undefined ? existing.supplier_code : typeof body.supplierCode === "string" ? body.supplierCode.trim() || null : null;
    const phone = body.phone === undefined ? existing.phone : typeof body.phone === "string" ? body.phone.trim() || null : null;
    const email = body.email === undefined ? existing.email : typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    const paymentTermsDays = body.paymentTermsDays === undefined ? existing.payment_terms_days : Number(body.paymentTermsDays);
    const leadTimeDays = body.leadTimeDays === undefined ? existing.lead_time_days : body.leadTimeDays === null || String(body.leadTimeDays).trim() === "" ? null : Number(body.leadTimeDays);
    const deliveryScore = body.deliveryScore === undefined ? existing.delivery_score : body.deliveryScore === null || String(body.deliveryScore).trim() === "" ? null : Number(body.deliveryScore);
    const qualityScore = body.qualityScore === undefined ? existing.quality_score : body.qualityScore === null || String(body.qualityScore).trim() === "" ? null : Number(body.qualityScore);
    const status = body.status === undefined ? existing.status : body.status;
    if (name.length < 2 || name.length > 160 || (supplierCode && !codePattern.test(supplierCode)) || (phone && !validPhone(phone)) || (email && (email.length > 254 || !emailPattern.test(email))) || !Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365 || (leadTimeDays !== null && (!Number.isInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 365)) || [deliveryScore, qualityScore].some((score) => score !== null && (!Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 5)) || !["ACTIVE", "ARCHIVED"].includes(String(status))) return NextResponse.json({ error: "Vérifiez les informations du fournisseur." }, { status: 400 });
    let contactName: string | null;
    let address: string | null;
    let city: string | null;
    let country: string | null;
    let taxNumber: string | null;
    let notes: string | null;
    try {
      contactName = pickText("contactName", existing.contact_name, 160);
      address = pickText("address", existing.address, 300);
      city = pickText("city", existing.city, 100);
      country = pickText("country", existing.country, 100);
      taxNumber = pickText("taxNumber", existing.tax_number, 80);
      notes = pickText("notes", existing.notes, 1000);
    } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Fiche invalide." }, { status: 400 }); }
    const { data, error } = await admin.from("commerce_suppliers").update({
      supplier_code: supplierCode, name, contact_name: contactName, phone, email, address, city, country,
      tax_number: taxNumber, payment_terms_days: paymentTermsDays, lead_time_days: leadTimeDays,
      delivery_score: deliveryScore, quality_score: qualityScore, notes, status,
      updated_by: access.context.user!.id, updated_at: new Date().toISOString(),
    }).eq("id", supplierId).eq("tenant_id", access.context.tenantId).select("id,supplier_code,name,contact_name,phone,email,payment_terms_days,lead_time_days,delivery_score,quality_score,status,updated_at").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Ce code fournisseur est déjà utilisé." : "Impossible de modifier le fournisseur." }, { status: error?.code === "23505" ? 409 : 400 });
    return NextResponse.json({ supplier: data });
  } catch {
    return NextResponse.json({ error: "Requête Commerce invalide." }, { status: 400 });
  }
}
