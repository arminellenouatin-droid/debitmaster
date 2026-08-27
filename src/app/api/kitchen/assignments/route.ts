// DebitManager Power Cuisine: affectations multi-cuisiniers, séparées du flux Boissons.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emitTenantNotification } from "@/lib/notifications";

const statuses = ["ASSIGNED", "IN_PREPARATION", "READY", "HANDED_OFF"] as const;
type AssignmentStatus = (typeof statuses)[number];

async function contextForTenant(tenantId: string) {
  const context = await getAuthorizationContext();
  if (!context.user) return { context, response: NextResponse.json({ error: "Authentification requise." }, { status: 401 }) };
  if (!tenantId || !context.tenantIds.includes(tenantId)) return { context, response: NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 }) };
  return { context, response: null };
}

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
    const { context, response } = await contextForTenant(tenantId);
    if (response) return response;
    if (!can(context, "orders.view")) return NextResponse.json({ error: "Permission insuffisante pour consulter les préparations repas." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    let query = admin.from("kitchen_order_assignments").select("id,tenant_id,order_id,order_item_id,cook_employee_id,quantity,status,assigned_by,assigned_at,prepared_at,handed_off_at,notes,order_items(product_name,fulfillment_unit),employees!kitchen_order_assignments_cook_employee_id_fkey(first_name,last_name)").eq("tenant_id", tenantId).neq("status", "CANCELLED").order("created_at", { ascending: false }).limit(500);
    if (context.role === "CUISINIER" && context.employeeId) query = query.eq("cook_employee_id", context.employeeId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Impossible de charger les affectations cuisine." }, { status: 500 });
    const { data: cooks, error: cooksError } = await admin.from("employees").select("id,first_name,last_name").eq("tenant_id", tenantId).eq("position", "CUISINIER").eq("status", "ACTIVE").is("deleted_at", null).order("first_name").limit(100);
    if (cooksError) return NextResponse.json({ error: "Impossible de charger les Cuisiniers." }, { status: 500 });
    return NextResponse.json({ assignments: data ?? [], cooks: cooks ?? [] });
  } catch (error) {
    console.error("[kitchen/assignments.GET]", error);
    return NextResponse.json({ error: "Service cuisine temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const orderItemId = typeof body.orderItemId === "string" ? body.orderItemId : "";
    const cookEmployeeId = typeof body.cookEmployeeId === "string" ? body.cookEmployeeId : "";
    const quantity = Number(body.quantity);
    if (!tenantId || !orderId || !orderItemId || !cookEmployeeId || !Number.isInteger(quantity) || quantity < 1) return NextResponse.json({ error: "Commande, repas, cuisinier et quantité valides requis." }, { status: 400 });
    const { context, response } = await contextForTenant(tenantId);
    if (response) return response;
    if (!can(context, "orders.prepare")) return NextResponse.json({ error: "Seul le Chef cuisine peut affecter une préparation." }, { status: 403 });
    const { data: item } = await context.supabase.from("order_items").select("id,order_id,tenant_id,quantity,fulfillment_unit,product_name").eq("id", orderItemId).eq("order_id", orderId).eq("tenant_id", tenantId).maybeSingle();
    if (!item || item.fulfillment_unit !== "MEAL") return NextResponse.json({ error: "Cette ligne n’est pas une préparation repas de cet établissement." }, { status: 400 });
    const { data: cook } = await context.supabase.from("employees").select("id,first_name,last_name").eq("id", cookEmployeeId).eq("tenant_id", tenantId).eq("position", "CUISINIER").eq("status", "ACTIVE").is("deleted_at", null).maybeSingle();
    if (!cook) return NextResponse.json({ error: "Cuisinier introuvable ou inactif dans cet établissement." }, { status: 400 });
    const { data: existing } = await context.supabase.from("kitchen_order_assignments").select("quantity").eq("tenant_id", tenantId).eq("order_item_id", orderItemId).neq("status", "CANCELLED").limit(500);
    const assigned = (existing ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    if (assigned + quantity > Number(item.quantity)) return NextResponse.json({ error: `La quantité restante pour ${item.product_name} est de ${Math.max(Number(item.quantity) - assigned, 0)}.` }, { status: 409 });
    const { data: assignment, error } = await context.supabase.from("kitchen_order_assignments").insert({ tenant_id: tenantId, order_id: orderId, order_item_id: orderItemId, cook_employee_id: cookEmployeeId, quantity, assigned_by: context.user!.id }).select("id,tenant_id,order_id,order_item_id,cook_employee_id,quantity,status,assigned_at,prepared_at,handed_off_at,notes").single();
    if (error || !assignment) return NextResponse.json({ error: "Impossible d’enregistrer l’affectation cuisine." }, { status: 400 });
    await emitTenantNotification({ tenantId, actorUserId: context.user!.id, subject: `Préparation affectée · ${item.product_name}`, body: `${quantity} unité(s) de ${item.product_name} sont affectées à ${cook.first_name} ${cook.last_name}.`, eventType: "MEAL_ASSIGNMENT_CREATED", entityId: orderId, actionPath: `/dashboard/meals?orderId=${encodeURIComponent(orderId)}`, actionPermission: "orders.prepare", operatorPositions: ["CUISINIER"], dedupeKey: `meal-assignment:${assignment.id}`, metadata: { assignmentId: assignment.id, orderItemId, cookEmployeeId, quantity } });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error("[kitchen/assignments.POST]", error);
    return NextResponse.json({ error: "Requête cuisine invalide." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : "";
    const status = typeof body.status === "string" ? body.status as AssignmentStatus : "";
    if (!tenantId || !assignmentId || !status || !statuses.includes(status)) return NextResponse.json({ error: "Affectation et statut valides requis." }, { status: 400 });
    const { context, response } = await contextForTenant(tenantId);
    if (response) return response;
    const { data: assignment } = await context.supabase.from("kitchen_order_assignments").select("id,order_id,order_item_id,cook_employee_id,status,quantity").eq("id", assignmentId).eq("tenant_id", tenantId).maybeSingle();
    if (!assignment) return NextResponse.json({ error: "Affectation introuvable." }, { status: 404 });
    const isChef = can(context, "orders.prepare");
    if (!isChef && assignment.cook_employee_id !== context.employeeId) return NextResponse.json({ error: "Cette affectation ne vous est pas attribuée." }, { status: 403 });
    if (!isChef && status !== "READY" && status !== "IN_PREPARATION") return NextResponse.json({ error: "Le Cuisinier peut uniquement faire évoluer sa préparation." }, { status: 403 });
    const patch: Record<string, unknown> = { status };
    if (status === "READY") patch.prepared_at = new Date().toISOString();
    if (status === "HANDED_OFF") patch.handed_off_at = new Date().toISOString();
    const { data: updated, error } = await context.supabase.from("kitchen_order_assignments").update(patch).eq("id", assignmentId).eq("tenant_id", tenantId).select("id,order_id,order_item_id,cook_employee_id,quantity,status,assigned_at,prepared_at,handed_off_at").single();
    if (error || !updated) return NextResponse.json({ error: "Impossible de mettre à jour la préparation." }, { status: 409 });
    await emitTenantNotification({ tenantId, actorUserId: context.user!.id, subject: `Préparation repas ${status === "READY" ? "prête" : "mise à jour"}`, body: `La préparation de la commande est passée à ${status}.`, eventType: "MEAL_ASSIGNMENT_STATUS_CHANGED", entityId: assignment.order_id, actionPath: `/dashboard/meals?orderId=${encodeURIComponent(assignment.order_id)}`, actionPermission: "orders.prepare", operatorPositions: ["CHEF_CUISINE"], dedupeKey: `meal-assignment-status:${assignment.id}:${status}`, metadata: { assignmentId: assignment.id, status } });
    return NextResponse.json({ assignment: updated });
  } catch (error) {
    console.error("[kitchen/assignments.PATCH]", error);
    return NextResponse.json({ error: "Requête cuisine invalide." }, { status: 400 });
  }
}
