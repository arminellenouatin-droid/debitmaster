import { NextResponse } from "next/server";
import { canCommerce, canWriteCommerce, getCommerceContext } from "@/lib/commerce-auth";
import { requestHasSameOrigin } from "@/lib/request-security";
import { writeCommerceAuditEvent } from "@/lib/commerce-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const storeTypes = ["RETAIL", "WAREHOUSE", "POINT_OF_SALE"] as const;

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? undefined;
    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !canCommerce(context, "stores.view")) return NextResponse.json({ error: "Accès aux magasins non autorisé." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    let query = admin.from("commerce_stores").select("id,tenant_id,name,store_type,address,city,status,created_at").eq("tenant_id", context.tenantId).order("created_at", { ascending: true }).limit(100);
    if (!context.isOwner) query = context.storeIds.length ? query.in("id", context.storeIds) : query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les magasins." }, { status: 500 });
    return NextResponse.json({ stores: data ?? [], accessMode: context.accessMode });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const storeType = typeof body.storeType === "string" && storeTypes.includes(body.storeType as (typeof storeTypes)[number]) ? body.storeType : "RETAIL";
    const address = typeof body.address === "string" ? body.address.trim().slice(0, 240) : null;
    const city = typeof body.city === "string" ? body.city.trim().slice(0, 100) : null;
    if (name.length < 2) return NextResponse.json({ error: "Le nom du magasin doit contenir au moins 2 caractères." }, { status: 400 });
    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !canCommerce(context, "stores.manage")) return NextResponse.json({ error: "Permission insuffisante pour gérer les magasins." }, { status: 403 });
    if (!canWriteCommerce(context)) return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement. Consultez le statut de l’établissement." }, { status: 402 });

    const admin = createSupabaseAdminClient();
    const { data: store, error } = await admin.from("commerce_stores").insert({ tenant_id: context.tenantId, name, store_type: storeType, address: address || null, city: city || null, created_by: context.user.id }).select("id,tenant_id,name,store_type,address,city,status,created_at").single();
    if (error || !store) return NextResponse.json({ error: error?.code === "23505" ? "Un magasin porte déjà ce nom dans l’établissement." : "Impossible de créer le magasin." }, { status: 400 });

    if (!context.isOwner && context.employee) {
      const { error: scopeError } = await admin.from("commerce_employee_stores").insert({ tenant_id: context.tenantId, employee_id: context.employee.id, store_id: store.id, assigned_by: context.user.id });
      if (scopeError) {
        await admin.from("commerce_stores").delete().eq("id", store.id).eq("tenant_id", context.tenantId);
        return NextResponse.json({ error: "Impossible d’attribuer le magasin au compte actif." }, { status: 500 });
      }
    }
    const audited = await writeCommerceAuditEvent({ tenantId: context.tenantId!, actorUserId: context.user.id, action: "STORE_CREATED", entityType: "STORE", entityId: store.id, metadata: { name, storeType } });
    if (!audited) {
      await admin.from("commerce_stores").delete().eq("id", store.id).eq("tenant_id", context.tenantId);
      return NextResponse.json({ error: "Le magasin n’a pas été enregistré dans le journal d’audit." }, { status: 500 });
    }
    return NextResponse.json({ store }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
