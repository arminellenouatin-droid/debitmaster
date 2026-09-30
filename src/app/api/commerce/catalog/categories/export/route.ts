import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { authorizeCommerceApi } from "@/lib/commerce-api";
import { serializeCommerceCsv } from "@/lib/commerce-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = ["chemin_json", "description", "couleur", "icone", "ordre"];
const spreadsheetSafe = (value: unknown) => {
  const text = String(value ?? "");
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? undefined;
    const format = url.searchParams.get("format") ?? "csv";
    const template = url.searchParams.get("template") === "1";
    if (format !== "csv" && format !== "xlsx") return NextResponse.json({ error: "Format d’export invalide." }, { status: 400 });
    const access = await authorizeCommerceApi(request, { tenantId, permission: "catalog.view", scope: template ? "catalog:categories:template" : "catalog:categories:export", limit: template ? 20 : 10 });
    if (access.response) return access.response;
    if (!template && !access.context.isOwner && !access.context.permissions.has("reports.export")) return NextResponse.json({ error: "La permission d’export est requise." }, { status: 403 });

    const rows: Array<Array<string | number | null>> = [headers];
    if (!template) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.from("commerce_categories").select("id,parent_id,name,description,color,icon_key,sort_order")
        .eq("tenant_id", access.context.tenantId).eq("status", "ACTIVE")
        .order("sort_order", { ascending: true }).order("name", { ascending: true }).order("id", { ascending: true }).limit(501);
      if (error) return NextResponse.json({ error: "Impossible de préparer l’export des catégories." }, { status: 500 });
      if ((data ?? []).length > 500) return NextResponse.json({ error: "L’export dépasse 500 catégories." }, { status: 413 });
      const byId = new Map((data ?? []).map((category) => [category.id, category]));
      for (const category of data ?? []) {
        const path: string[] = [];
        const visited = new Set<string>();
        let current: typeof category | undefined = category;
        while (current) {
          if (visited.has(current.id) || path.length >= 8) return NextResponse.json({ error: "La hiérarchie des catégories est invalide." }, { status: 409 });
          visited.add(current.id); path.unshift(current.name);
          if (current.parent_id && !byId.has(current.parent_id)) return NextResponse.json({ error: "Une catégorie parente active est introuvable." }, { status: 409 });
          current = current.parent_id ? byId.get(current.parent_id) : undefined;
        }
        rows.push([JSON.stringify(path), category.description, category.color, category.icon_key, category.sort_order]);
      }
    }

    const filename = `categories-commerce.${template ? "modele." : ""}${format}`;
    if (format === "csv") return new NextResponse(`\uFEFF${serializeCommerceCsv(rows)}`, { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows.map((row) => row.map(spreadsheetSafe))), "Catégories");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    return new NextResponse(output, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "Service Commerce temporairement indisponible." }, { status: 500 });
  }
}
