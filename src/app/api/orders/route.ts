// DebitManager orders API: commande et lignes vérifiées ensemble sur le même tenant avant insertion.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrderLine = { productId: string; quantity: number; fulfillmentUnit?: "BEVERAGE" | "MEAL" };

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "orders.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les commandes." }, { status: 403 });
    if (tenantId && !tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const readClient = createSupabaseAdminClient();
    let query = readClient.from("orders").select("id,tenant_id,order_number,table_label,location_label,customer_id,server_user_id,server_name,received_by_user_id,received_at,delivered_by_user_id,delivered_at,status,total_amount,currency,created_at,updated_at").order("created_at", { ascending: false }).limit(50);
    query = tenantId ? query.eq("tenant_id", tenantId) : query.in("tenant_id", tenantIds);
    if (context.role === "SERVEUR") query = query.eq("server_user_id", user.id);
    const { data, error } = await query;
    if (error) { console.error("[orders.GET] orders query failed", { code: error.code, message: error.message }); return NextResponse.json({ error: "Impossible de charger les commandes.", diagnostic: "ORDERS_QUERY_FAILED" }, { status: 500 }); }
    const orderRows = data ?? [];
    const orderIds = orderRows.map((order) => order.id);
    if (!orderIds.length) return NextResponse.json({ orders: [] });
    const [itemsResult, allocationsResult] = await Promise.all([readClient.from("order_items").select("id,order_id,product_id,product_name,quantity,unit_price,total_price,fulfillment_unit,preparation_status,prepared_at,received_by_user_id,received_at,delivered_at").in("order_id", orderIds).limit(1000), readClient.from("order_stock_allocations").select("id,order_id,server_user_id,product_id,quantity,status,allocated_at,settled_at").in("order_id", orderIds).limit(1000)]);
    if (itemsResult.error || allocationsResult.error) { console.error("[orders.GET] detail query failed", { items: itemsResult.error?.message, allocations: allocationsResult.error?.message }); return NextResponse.json({ error: "Impossible de charger les commandes.", diagnostic: "ORDERS_DETAIL_QUERY_FAILED" }, { status: 500 }); }
    const itemsByOrder = new Map<string, typeof itemsResult.data>(); for (const item of itemsResult.data ?? []) { const rows = itemsByOrder.get(item.order_id) ?? []; rows.push(item); itemsByOrder.set(item.order_id, rows); }
    const allocationsByOrder = new Map<string, typeof allocationsResult.data>(); for (const allocation of allocationsResult.data ?? []) { const rows = allocationsByOrder.get(allocation.order_id) ?? []; rows.push(allocation); allocationsByOrder.set(allocation.order_id, rows); }
    return NextResponse.json({ orders: orderRows.map((order) => ({ ...order, order_items: itemsByOrder.get(order.id) ?? [], order_stock_allocations: allocationsByOrder.get(order.id) ?? [] })) });
  } catch { return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const tableLabel = typeof body.tableLabel === "string" ? body.tableLabel.trim().slice(0, 80) : null;
    const locationLabel = typeof body.locationLabel === "string" ? body.locationLabel.trim().slice(0, 80) : null;
    const zoneId = typeof body.zoneId === "string" && body.zoneId ? body.zoneId : null;
    const customerId = typeof body.customerId === "string" ? body.customerId : null;
    const lines = Array.isArray(body.lines) ? body.lines as OrderLine[] : [];
    if (!tenantId || !lines.length || lines.length > 50) return NextResponse.json({ error: "Établissement et au moins une ligne de commande sont requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!can(context, "orders.create")) return NextResponse.json({ error: "Permission insuffisante pour créer une commande." }, { status: 403 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data: company, error: companyError } = await supabase.from("companies").select("activity_type,zones_tables_enabled").eq("id", tenantId).maybeSingle();
    if (companyError || !company) return NextResponse.json({ error: "Configuration de l’établissement introuvable." }, { status: 500 });
    const zonesTablesEnabled = company.activity_type === "POWER" ? company.zones_tables_enabled !== false : true;
    if (zonesTablesEnabled && (!tableLabel || !locationLabel)) return NextResponse.json({ error: "Emplacement et numéro de table requis lorsque les zones et tables sont activées." }, { status: 400 });
    const effectiveTableLabel = zonesTablesEnabled ? tableLabel : null;
    const effectiveLocationLabel = zonesTablesEnabled ? locationLabel : null;
    const effectiveZoneId = zonesTablesEnabled ? zoneId : null;
    if (context.role === "SERVEUR" && zonesTablesEnabled) {
      const [{ data: assignments }, { data: zoneAssignments }] = await Promise.all([
        supabase.from("employee_table_assignments").select("dining_tables(label,zone,zone_id)").eq("tenant_id", tenantId).eq("employee_id", context.employeeId).limit(100),
        effectiveZoneId ? supabase.from("employee_zone_assignments").select("zone_id,work_zones(name,is_active)").eq("tenant_id", tenantId).eq("employee_id", context.employeeId).eq("zone_id", effectiveZoneId).limit(1) : Promise.resolve({ data: [] }),
      ]);
      const assignedDiningTables = (assignments ?? []).flatMap((assignment) => Array.isArray(assignment.dining_tables) ? assignment.dining_tables : assignment.dining_tables ? [assignment.dining_tables] : []);
      const directTable = assignedDiningTables.some((table) => table.label === effectiveTableLabel && (table.zone ?? "Emplacement général") === effectiveLocationLabel && (!effectiveZoneId || table.zone_id === effectiveZoneId));
      const assignedZone = (zoneAssignments ?? []).some((assignment) => {
        const zone = Array.isArray(assignment.work_zones) ? assignment.work_zones[0] : assignment.work_zones;
        return zone?.name === effectiveLocationLabel && zone.is_active;
      });
      if (!directTable && !assignedZone) return NextResponse.json({ error: "Cette table ne correspond pas à l’emplacement qui vous est attribué." }, { status: 403 });
    }
    const normalizedLines = lines.map((line) => ({ productId: typeof line.productId === "string" ? line.productId : "", quantity: Number(line.quantity), fulfillmentUnit: line.fulfillmentUnit === "MEAL" || line.fulfillmentUnit === "BEVERAGE" ? line.fulfillmentUnit : undefined })).filter((line) => line.productId && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999);
    if (normalizedLines.length !== lines.length) return NextResponse.json({ error: "Chaque ligne doit contenir un produit et une quantité valide." }, { status: 400 });
    const ids = [...new Set(normalizedLines.map((line) => line.productId))];
    const { data: products, error: productError } = await supabase.from("products").select("id,name,price,product_type,tenant_id,deleted_at").in("id", ids).eq("tenant_id", tenantId).is("deleted_at", null).limit(50);
    if (productError || !products || products.length !== ids.length) return NextResponse.json({ error: "Un ou plusieurs produits ne sont pas disponibles dans cet établissement." }, { status: 400 });
    if (customerId) {
      const { data: customer } = await supabase.from("customers").select("id").eq("id", customerId).eq("tenant_id", tenantId).maybeSingle();
      if (!customer) return NextResponse.json({ error: "Client non autorisé dans cet établissement." }, { status: 403 });
    }
    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderLines = normalizedLines.map((line) => { const product = productMap.get(line.productId)!; const inferredUnit = String(product.product_type ?? "").toUpperCase().includes("FOOD") || String(product.product_type ?? "").toUpperCase().includes("MEAL") ? "MEAL" : "BEVERAGE"; return { tenant_id: tenantId, product_id: product.id, product_name: product.name, quantity: line.quantity, unit_price: product.price, total_price: product.price * line.quantity, fulfillment_unit: line.fulfillmentUnit ?? inferredUnit, preparation_status: "PENDING" }; });
    const totalAmount = orderLines.reduce((total, line) => total + line.total_price, 0);
    const orderNumber = `DM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: order, error: orderError } = await supabase.from("orders").insert({ tenant_id: tenantId, order_number: orderNumber, table_label: effectiveTableLabel, location_label: effectiveLocationLabel, customer_id: customerId, server_user_id: context.employeeId && context.role === "SERVEUR" ? user.id : null, server_name: user.user_metadata?.first_name ?? null, total_amount: totalAmount, currency: "XOF" }).select("id,tenant_id,order_number,table_label,location_label,customer_id,server_user_id,server_name,status,total_amount,currency,created_at").single();
    if (orderError || !order) return NextResponse.json({ error: "Impossible de créer la commande." }, { status: 400 });
    const { data: insertedLines, error: linesError } = await supabase.from("order_items").insert(orderLines.map((line) => ({ ...line, order_id: order.id }))).select("id,product_id,product_name,quantity,unit_price,total_price");
    if (linesError) { await supabase.from("orders").delete().eq("id", order.id).eq("tenant_id", tenantId); return NextResponse.json({ error: "Impossible d’enregistrer les lignes de commande." }, { status: 400 }); }
    return NextResponse.json({ order: { ...order, order_items: insertedLines ?? [] } }, { status: 201 });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}

const orderStatuses = ["PENDING", "IN_PREPARATION", "READY", "HANDED_OFF", "DELIVERED"] as const;

type OrderStatus = (typeof orderStatuses)[number];

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!tenantId || !orderId || !orderStatuses.includes(status as OrderStatus)) return NextResponse.json({ error: "Commande, établissement et statut valide requis." }, { status: 400 });
    const context = await getAuthorizationContext();
    const { supabase, user, tenantIds } = context;
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!tenantIds.includes(tenantId)) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const { data: current, error: currentError } = await supabase.from("orders").select("id,status,server_user_id,received_by_user_id").eq("id", orderId).eq("tenant_id", tenantId).maybeSingle();
    if (currentError || !current) return NextResponse.json({ error: "Commande introuvable dans cet établissement." }, { status: 404 });
    const transitionPermissions: Record<string, string> = {
      "PENDING->IN_PREPARATION": "orders.prepare",
      "IN_PREPARATION->READY": "orders.prepare",
      "READY->HANDED_OFF": "orders.receive",
      "HANDED_OFF->DELIVERED": "orders.deliver",
    };
    const permission = transitionPermissions[`${current.status}->${status}`];
    if (!permission) return NextResponse.json({ error: "Transition de commande non autorisée." }, { status: 400 });
    const canTransition = permission === "orders.receive" ? can(context, "orders.receive") || can(context, "orders.handoff") : can(context, permission);
    if (!canTransition) return NextResponse.json({ error: "Permission insuffisante pour modifier cette étape de commande." }, { status: 403 });
    const orderItemId = typeof body.orderItemId === "string" ? body.orderItemId : "";
    if (!orderItemId && (status === "IN_PREPARATION" || status === "READY")) {
      const fromStatuses = status === "READY" ? ["PENDING", "IN_PREPARATION"] : ["PENDING"];
      const { data: preparedItems, error: preparationError } = await supabase.from("order_items").update({ preparation_status: status, prepared_at: status === "READY" ? new Date().toISOString() : null }).eq("order_id", orderId).eq("tenant_id", tenantId).in("preparation_status", fromStatuses).select("id");
      if (preparationError || !preparedItems?.length) return NextResponse.json({ error: "Impossible de synchroniser la préparation des articles. Vérifiez les permissions de préparation et l’état actuel de la commande." }, { status: 409 });
    }
    if (status === "HANDED_OFF" && !orderItemId) {
      if (current.server_user_id !== user.id) return NextResponse.json({ error: "Cette commande n’est pas attribuée à votre service." }, { status: 403 });
      const { data: handedOffOrder, error: handoffError } = await supabase.rpc("receive_order_for_server", { p_order_id: orderId });
      if (handoffError || !handedOffOrder) return NextResponse.json({ error: handoffError?.message === "INSUFFICIENT_COUNTER_STOCK" ? "Stock insuffisant dans le magasin du Gérant pour cette commande." : "Impossible d’enregistrer la réception de la commande." }, { status: 409 });
      return NextResponse.json({ order: handedOffOrder });
    }
    if (orderItemId && status === "HANDED_OFF") {
      if (current.server_user_id !== user.id) return NextResponse.json({ error: "Cette commande n’est pas attribuée à votre service." }, { status: 403 });
      const { data: handedOffItem, error: handoffError } = await supabase.rpc("receive_order_item_for_server", { p_order_item_id: orderItemId });
      if (handoffError || !handedOffItem) return NextResponse.json({ error: handoffError?.message === "INSUFFICIENT_COUNTER_STOCK" ? "Stock insuffisant dans le magasin du Gérant pour cet article." : "Impossible d’enregistrer la réception de cet article." }, { status: 409 });
      return NextResponse.json({ order: handedOffItem });
    }
    if (orderItemId && (status === "IN_PREPARATION" || status === "READY")) {
      if (!can(context, "orders.prepare")) return NextResponse.json({ error: "Seul le Gérant ou la cuisine peut préparer cet article." }, { status: 403 });
      const { data: item, error: itemError } = await supabase.from("order_items").update({ preparation_status: status, prepared_at: status === "READY" ? new Date().toISOString() : null }).eq("id", orderItemId).eq("order_id", orderId).eq("tenant_id", tenantId).in("preparation_status", status === "IN_PREPARATION" ? ["PENDING"] : ["IN_PREPARATION"]).select("id,order_id,preparation_status,fulfillment_unit,prepared_at").single();
      if (itemError || !item) return NextResponse.json({ error: "Cet article a déjà changé d’état ou n’existe pas." }, { status: 409 });
      return NextResponse.json({ item });
    }
    if (orderItemId && status === "DELIVERED") {
      if (current.server_user_id !== user.id) return NextResponse.json({ error: "Cette commande n’est pas attribuée à votre service." }, { status: 403 });
      const { data: item, error: itemError } = await supabase.from("order_items").update({ preparation_status: "DELIVERED", delivered_at: new Date().toISOString() }).eq("id", orderItemId).eq("order_id", orderId).eq("tenant_id", tenantId).eq("preparation_status", "RECEIVED").select("id,order_id,preparation_status,delivered_at").single();
      if (itemError || !item) return NextResponse.json({ error: "Cet article n’est pas encore reçu ou a déjà été livré." }, { status: 409 });
      const { data: refreshed } = await supabase.rpc("refresh_order_status_from_items", { p_order_id: orderId });
      return NextResponse.json({ item, order: refreshed });
    }
    const auditFields = status === "DELIVERED" ? { delivered_by_user_id: user.id, delivered_at: new Date().toISOString() } : {};
    const { data, error } = await supabase.from("orders").update({ status, ...auditFields, updated_at: new Date().toISOString() }).eq("id", orderId).eq("tenant_id", tenantId).eq("status", current.status).select("id,tenant_id,order_number,table_label,customer_id,server_user_id,server_name,received_by_user_id,received_at,delivered_by_user_id,delivered_at,status,total_amount,currency,created_at,updated_at").single();
    if (error || !data) return NextResponse.json({ error: "La commande a changé entre-temps. Actualisez la file cuisine." }, { status: 409 });
    return NextResponse.json({ order: data });
  } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
}
