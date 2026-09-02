// Menu QR public, Design Read: commande lounge mobile-first, données réelles du tenant après vérification du jeton, jamais de confiance dans les prix du navigateur.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emitTenantNotification } from "@/lib/notifications";
import { verifyPublicMenuToken } from "@/lib/public-menu-token";

type Context = { params: Promise<{ token: string }> };
type LineInput = { productId?: unknown; quantity?: unknown };
type ServiceLineInput = { activityCode?: unknown; serviceId?: unknown; roomId?: unknown; label?: unknown; unitPrice?: unknown; quantity?: unknown; detail?: unknown };

async function resolve(token: string) {
  const payload = verifyPublicMenuToken(token);
  if (!payload) return { error: NextResponse.json({ error: "Lien de menu invalide ou expiré." }, { status: 404 }) } as const;
  const admin = createSupabaseAdminClient();
  const [{ data: company, error: companyError }, { data: table, error: tableError }] = await Promise.all([
    admin.from("companies").select("id,name,activity_type,zones_tables_enabled").eq("id", payload.tenantId).is("deleted_at", null).maybeSingle(),
    admin.from("dining_tables").select("id,tenant_id,label,zone,status").eq("id", payload.tableId).eq("tenant_id", payload.tenantId).is("deleted_at", null).maybeSingle(),
  ]);
  if (companyError || tableError || !company || company.activity_type !== "POWER" || !table) return { error: NextResponse.json({ error: "Cette table n’est plus disponible." }, { status: 404 }) } as const;
  return { payload, company, table, admin } as const;
}

export async function GET(request: Request, { params }: Context) {
  try {
    const token = (await params).token;
    const resolved = await resolve(token);
    if ("error" in resolved) return resolved.error;
    const { admin, company, table, payload } = resolved;
    const [{ data: products, error: productsError }, { data: categories, error: categoriesError }, { data: activities }, { data: services }, { data: rooms }] = await Promise.all([
      admin.from("products").select("id,name,price,product_type,stock_family,unit,packaging_label,category_id,image_url").eq("tenant_id", payload.tenantId).is("deleted_at", null).in("stock_family", ["BEVERAGE", "KITCHEN"]).order("stock_family").order("name").limit(300),
      admin.from("categories").select("id,name,parent_id").eq("tenant_id", payload.tenantId).is("deleted_at", null).order("name").limit(100),
      admin.from("company_activities").select("id,activity_code,name").eq("tenant_id", payload.tenantId).eq("is_active", true).order("name").limit(20),
      admin.from("company_services").select("id,activity_id,name,description,price_xof,billing_unit").eq("tenant_id", payload.tenantId).eq("is_active", true).order("name").limit(100),
      admin.from("power_lodging_rooms").select("id,room_number,pass_price_xof,pass_duration_minutes,night_price_xof,night_duration_nights,occupied_until").eq("tenant_id", payload.tenantId).eq("is_active", true).order("room_number").limit(50),
    ]);
    if (productsError || categoriesError) return NextResponse.json({ error: "Le menu est momentanément indisponible." }, { status: 500 });
    const wifiTickets = [{ ticket_code: "3_HOURS", label: "Wi-Fi 3 heures", duration_label: "3 heures", unit_price_xof: 100 }, { ticket_code: "72_HOURS", label: "Wi-Fi 72 heures", duration_label: "72 heures", unit_price_xof: 500 }, { ticket_code: "1_MONTH", label: "Wi-Fi 1 mois", duration_label: "1 mois", unit_price_xof: 2500 }];
    return NextResponse.json({ company: { id: company.id, name: company.name }, table: { id: table.id, label: table.label, zone: table.zone }, products: products ?? [], categories: categories ?? [], activities: activities ?? [], services: services ?? [], rooms: rooms ?? [], wifiTickets }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Le menu est momentanément indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const token = (await params).token;
    const resolved = await resolve(token);
    if ("error" in resolved) return resolved.error;
    const { admin, company, table, payload } = resolved;
    const body = await request.json() as { lines?: LineInput[]; serviceLines?: ServiceLineInput[]; customerName?: unknown; note?: unknown };
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const serviceLines = Array.isArray(body.serviceLines) ? body.serviceLines : [];
    if ((!lines.length && !serviceLines.length) || lines.length + serviceLines.length > 50) return NextResponse.json({ error: "Ajoutez au moins un article au panier." }, { status: 400 });

    const normalized = lines.map((line) => ({ productId: typeof line.productId === "string" ? line.productId : "", quantity: Number(line.quantity) })).filter((line) => line.productId && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99);
    if (normalized.length !== lines.length) return NextResponse.json({ error: "Une quantité de commande est invalide." }, { status: 400 });
    const normalizedServices = serviceLines.map((line) => ({ activityCode: String(line.activityCode ?? "").toUpperCase(), serviceId: typeof line.serviceId === "string" ? line.serviceId : null, roomId: typeof line.roomId === "string" ? line.roomId : null, label: typeof line.label === "string" ? line.label.trim().slice(0, 160) : "", unitPrice: Number(line.unitPrice), quantity: Number(line.quantity), detail: typeof line.detail === "string" ? line.detail.trim().slice(0, 160) : null })).filter((line) => ["GYM", "LAVAGE", "LAUNDRY", "LODGING", "WIFI"].includes(line.activityCode) && line.label && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99);
    if (normalizedServices.length !== serviceLines.length) return NextResponse.json({ error: "Une prestation sélectionnée est invalide." }, { status: 400 });

    const productIds = [...new Set(normalized.map((line) => line.productId))];
    const { data: products, error: productsError } = productIds.length ? await admin.from("products").select("id,name,price,product_type,stock_family,tenant_id").eq("tenant_id", payload.tenantId).is("deleted_at", null).in("id", productIds).limit(50) : { data: [], error: null };
    if (productsError || !products || products.length !== productIds.length) return NextResponse.json({ error: "Un article n’est plus disponible dans ce menu." }, { status: 409 });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderLines = normalized.map((line) => {
      const product = productMap.get(line.productId)!;
      const family = product.stock_family === "KITCHEN" || String(product.product_type ?? "").toUpperCase().includes("MEAL") || String(product.product_type ?? "").toUpperCase().includes("FOOD") ? "MEAL" : "BEVERAGE";
      return { tenant_id: payload.tenantId, product_id: product.id, product_name: product.name, quantity: line.quantity, unit_price: Number(product.price), total_price: Number(product.price) * line.quantity, fulfillment_unit: family, preparation_status: "PENDING" };
    });

    const serviceIds = [...new Set(normalizedServices.map((line) => line.serviceId).filter(Boolean))] as string[];
    const { data: services } = serviceIds.length ? await admin.from("company_services").select("id,name,description,price_xof,activity_id,company_activities!inner(activity_code)").eq("tenant_id", payload.tenantId).eq("is_active", true).in("id", serviceIds).limit(50) : { data: [] };
    const serviceMap = new Map((services ?? []).map((service: any) => [service.id, service]));
    const { data: rooms } = normalizedServices.some((line) => line.roomId) ? await admin.from("power_lodging_rooms").select("id,room_number,pass_price_xof,pass_duration_minutes,occupied_until").eq("tenant_id", payload.tenantId).eq("is_active", true).in("id", normalizedServices.map((line) => line.roomId).filter(Boolean) as string[]).limit(50) : { data: [] };
    const roomMap = new Map((rooms ?? []).map((room: any) => [room.id, room]));
    const wifiPrices: Record<string, number> = { "3_HOURS": 100, "72_HOURS": 500, "1_MONTH": 2500 };
    const serviceRows = normalizedServices.map((line) => {
      const normalizedActivity = line.activityCode === "LAUNDRY" ? "LAVAGE" : line.activityCode;
      const service = line.serviceId ? serviceMap.get(line.serviceId) : null;
      const room = line.roomId ? roomMap.get(line.roomId) : null;
      if (normalizedActivity === "LODGING" && (!room || (room.occupied_until && new Date(room.occupied_until).getTime() > Date.now()))) return null;
      const serverPrice = room ? Number(room.pass_price_xof) : service ? Number(service.price_xof) : normalizedActivity === "WIFI" && line.detail ? wifiPrices[line.detail] : NaN;
      if (!Number.isFinite(serverPrice) || serverPrice < 0 || (line.unitPrice !== serverPrice && normalizedActivity !== "WIFI")) return null;
      return { tenant_id: payload.tenantId, activity_code: normalizedActivity, service_id: service?.id ?? null, room_id: room?.id ?? null, label: room ? `Chambre ${room.room_number} · Pass` : service?.name ?? line.label, quantity: line.quantity, unit_price_xof: serverPrice, customer_name: typeof body.customerName === "string" ? body.customerName.trim().slice(0, 160) || null : null, note: line.detail ?? null };
    }).filter(Boolean) as Array<{ tenant_id: string; activity_code: string; service_id: string | null; room_id: string | null; label: string; quantity: number; unit_price_xof: number; customer_name: string | null; note: string | null }>;
    if (serviceRows.length !== normalizedServices.length) return NextResponse.json({ error: "Une prestation n’est plus disponible ou son tarif a changé." }, { status: 409 });

    const totalAmount = orderLines.reduce((sum, line) => sum + line.total_price, 0) + serviceRows.reduce((sum, line) => sum + line.unit_price_xof * line.quantity, 0);
    const orderNumber = `QR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const customerName = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 80) : "Client QR";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 250) : null;
    const { data: order, error: orderError } = await admin.from("orders").insert({ tenant_id: payload.tenantId, order_number: orderNumber, table_label: table.label, location_label: table.zone, server_user_id: null, server_name: customerName || "Client QR", total_amount: totalAmount, currency: "XOF" }).select("id,tenant_id,order_number,table_label,location_label,status,total_amount,currency,created_at").single();
    if (orderError || !order) return NextResponse.json({ error: "Impossible d’enregistrer la commande." }, { status: 400 });
    if (orderLines.length) {
      const { error: linesError } = await admin.from("order_items").insert(orderLines.map((line) => ({ ...line, order_id: order.id })));
      if (linesError) { await admin.from("orders").delete().eq("id", order.id).eq("tenant_id", payload.tenantId); return NextResponse.json({ error: "Impossible d’enregistrer les articles de la commande." }, { status: 400 }); }
    }
    if (serviceRows.length) {
      const { error: servicesError } = await admin.from("order_service_items").insert(serviceRows.map((line) => ({ ...line, order_id: order.id })));
      if (servicesError) { await admin.from("orders").delete().eq("id", order.id).eq("tenant_id", payload.tenantId); return NextResponse.json({ error: "Impossible d’enregistrer les prestations de la commande." }, { status: 400 }); }
    }
    const units = [...new Set(orderLines.map((line) => line.fulfillment_unit))];
    const serviceActivities = [...new Set(serviceRows.map((line) => line.activity_code))];
    const operatorPositions = [...new Set([...units.flatMap((unit) => unit === "MEAL" ? ["CHEF_CUISINE", "CUISINIER"] : ["GERANT"]), ...serviceActivities.flatMap((activity) => activity === "GYM" ? ["SECRETAIRE_GYM"] : activity === "LODGING" ? ["RESPONSABLE_AUBERGE"] : activity === "LAVAGE" ? ["CHARGE_LAVAGE"] : ["GERANT"])])];
    await emitTenantNotification({ tenantId: payload.tenantId, actorUserId: null, subject: `Commande client ${order.order_number}`, body: `${customerName || "Un client"} a commandé ${totalAmount.toLocaleString("fr-FR")} XOF à la ${table.label}.`, eventType: "PUBLIC_ORDER_CREATED", entityId: order.id, actionPath: `/dashboard/orders?orderId=${encodeURIComponent(order.id)}`, actionPermission: "orders.view", operatorPositions, dedupeKey: `public-order-created:${order.id}`, metadata: { source: "QR_MENU", tableId: table.id, tableLabel: table.label, note, units, serviceActivities, orderNumber: order.order_number } });
    return NextResponse.json({ order: { ...order, order_items: orderLines, service_items: serviceRows }, message: `Commande ${order.order_number} envoyée.` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Impossible d’enregistrer la commande." }, { status: 400 });
  }
}
