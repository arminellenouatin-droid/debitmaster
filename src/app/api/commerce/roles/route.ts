import { NextResponse } from "next/server";
import { canCommerce, canWriteCommerce, getCommerceContext } from "@/lib/commerce-auth";
import { requestHasSameOrigin } from "@/lib/request-security";
import { commercePermissionCatalog, commercePermissionKeys } from "@/lib/commerce-permissions";
import { writeCommerceAuditEvent } from "@/lib/commerce-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? undefined;
    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !canCommerce(context, "team.view")) return NextResponse.json({ error: "Accès aux rôles non autorisé." }, { status: 403 });
    const admin = createSupabaseAdminClient();
    const { data: roles, error } = await admin.from("commerce_roles").select("id,role_key,name,description,is_system,is_active,created_at").eq("tenant_id", context.tenantId).eq("is_active", true).order("is_system", { ascending: false }).order("name").limit(100);
    if (error) return NextResponse.json({ error: "Impossible de charger les rôles Commerce." }, { status: 500 });
    const roleIds = (roles ?? []).map((role) => role.id);
    const { data: permissions, error: permissionError } = roleIds.length ? await admin.from("commerce_role_permissions").select("role_id,permission_key").eq("tenant_id", context.tenantId).in("role_id", roleIds).limit(500) : { data: [], error: null };
    if (permissionError) return NextResponse.json({ error: "Impossible de charger les droits des rôles." }, { status: 500 });
    return NextResponse.json({ roles: (roles ?? []).map((role) => ({ ...role, permissionKeys: (permissions ?? []).filter((item) => item.role_id === role.id).map((item) => item.permission_key) })), permissionCatalog: commercePermissionCatalog, accessMode: context.accessMode });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Origine de requête non autorisée." }, { status: 403 });
    const body = await request.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const permissionKeys: string[] = Array.isArray(body.permissionKeys) ? Array.from(new Set<string>(body.permissionKeys.filter((key: unknown): key is string => typeof key === "string"))) : [];
    if (name.length < 2 || permissionKeys.length < 1 || permissionKeys.length > 40 || permissionKeys.some((key) => !commercePermissionKeys.has(key))) return NextResponse.json({ error: "Indiquez un nom et des permissions Commerce valides." }, { status: 400 });
    const context = await getCommerceContext(tenantId);
    if (!context.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if (!context.company || !context.isOwner) return NextResponse.json({ error: "Seul le promoteur peut créer un rôle personnalisé." }, { status: 403 });
    if (!canWriteCommerce(context)) return NextResponse.json({ error: "Les modifications sont suspendues pour cet abonnement." }, { status: 402 });

    const roleKey = `CUSTOM_${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32)}`;
    const admin = createSupabaseAdminClient();
    const { data: role, error } = await admin.from("commerce_roles").insert({ tenant_id: context.tenantId, role_key: roleKey, name, description: "Rôle personnalisé par le promoteur.", is_system: false, created_by: context.user.id }).select("id,role_key,name,description,is_system,is_active,created_at").single();
    if (error || !role) return NextResponse.json({ error: error?.code === "23505" ? "Un rôle porte déjà ce nom." : "Impossible de créer le rôle." }, { status: 400 });
    const { error: permissionError } = await admin.from("commerce_role_permissions").insert(permissionKeys.map((permission_key: string) => ({ tenant_id: context.tenantId, role_id: role.id, permission_key })));
    if (permissionError) {
      await admin.from("commerce_roles").delete().eq("id", role.id).eq("tenant_id", context.tenantId);
      return NextResponse.json({ error: "Impossible d’enregistrer les permissions du rôle." }, { status: 400 });
    }
    const audited = await writeCommerceAuditEvent({ tenantId: context.tenantId!, actorUserId: context.user.id, action: "ROLE_CREATED", entityType: "ROLE", entityId: role.id, metadata: { name, permissionKeys, system: false } });
    if (!audited) {
      await admin.from("commerce_roles").delete().eq("id", role.id).eq("tenant_id", context.tenantId);
      return NextResponse.json({ error: "Le rôle n’a pas été enregistré dans le journal d’audit." }, { status: 500 });
    }
    return NextResponse.json({ role: { ...role, permissionKeys } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
