import { NextResponse } from "next/server";
import { authorizeCommerceApi, readCommerceFormData } from "@/lib/commerce-api";
import { maxCommerceImportBytes, normalizeImportHeader, parseCommerceCsv } from "@/lib/commerce-catalog";
import { readCommerceWorkbookRows } from "@/lib/commerce-xlsx";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CategoryImportRow = { path: string[]; description: string | null; color: string; iconKey: string; sortOrder: number };
type RowError = { row: number; message: string };
const allowedHeaders = new Set(["chemin_json", "description", "couleur", "icone", "ordre"]);

export async function POST(request: Request) {
  try {
    const access = await authorizeCommerceApi(request, { permission: "catalog.manage", write: true, scope: "catalog:categories:import", limit: 3, windowSeconds: 60 });
    if (access.response) return access.response;
    const parsed = await readCommerceFormData(request, maxCommerceImportBytes + 64 * 1024);
    if (parsed.response) return parsed.response;
    const form = parsed.form!;
    const requestedTenantId = typeof form.get("tenantId") === "string" ? String(form.get("tenantId")) : access.context.tenantId;
    if (requestedTenantId !== access.context.tenantId) return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choisissez un fichier CSV ou Excel (.xlsx)." }, { status: 400 });
    if (file.size < 1 || file.size > maxCommerceImportBytes) return NextResponse.json({ error: "Le fichier doit peser au maximum 5 Mo." }, { status: 413 });

    let rows: string[][];
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "xlsx") return NextResponse.json({ error: "Formats acceptés : CSV UTF-8 ou Excel .xlsx sans macros." }, { status: 415 });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      rows = extension === "csv"
        ? parseCommerceCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes), 501)
        : readCommerceWorkbookRows(bytes, 500, 5);
    }
    catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Le CSV ne peut pas être lu." }, { status: 400 }); }
    if (rows.length < 2 || rows.length > 501) return NextResponse.json({ error: "Le fichier doit contenir de 1 à 500 catégories sous la ligne d’en-tête." }, { status: 400 });
    const headers = rows[0].map(normalizeImportHeader);
    if (new Set(headers).size !== headers.length || headers.some((header) => !allowedHeaders.has(header)) || !headers.includes("chemin_json")) return NextResponse.json({ error: "En-têtes acceptés : chemin_json, description, couleur, icone, ordre." }, { status: 400 });
    const columns = new Map(headers.map((header, index) => [header, index]));
    const get = (row: string[], key: string) => { const index = columns.get(key); return index === undefined ? "" : String(row[index] ?? "").trim(); };
    const imports: CategoryImportRow[] = [];
    const errors: RowError[] = [];
    const seenPaths = new Set<string>();
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.some((value) => value.trim())) continue;
      const rowNumber = index + 1;
      try {
        let path: unknown;
        try { path = JSON.parse(get(row, "chemin_json")); } catch { throw new Error("chemin_json doit être un tableau JSON, exemple : [\"Électronique\",\"Téléphones\"]."); }
        if (!Array.isArray(path) || path.length < 1 || path.length > 8 || path.some((name) => typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80)) throw new Error("Le chemin doit contenir de 1 à 8 noms de catégorie de 2 à 80 caractères.");
        path = path.map((name: string) => name.trim());
        const normalizedPath = (path as string[]).map(normalizeImportHeader).join("\u0000");
        if (seenPaths.has(normalizedPath)) throw new Error("Ce chemin de catégorie apparaît plusieurs fois dans le fichier.");
        seenPaths.add(normalizedPath);
        const description = get(row, "description");
        const color = get(row, "couleur") || "#0f766e";
        const iconKey = get(row, "icone") || "tag";
        const sortOrderText = get(row, "ordre");
        const sortOrder = sortOrderText ? Number(sortOrderText) : 0;
        if (description.length > 500 || !/^#[0-9a-f]{6}$/i.test(color) || !/^[a-z][a-z0-9_-]{0,39}$/.test(iconKey) || !Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) throw new Error("Description, couleur, icône ou ordre d’affichage invalide.");
        imports.push({ path: path as string[], description: description || null, color, iconKey, sortOrder });
      } catch (cause) {
        errors.push({ row: rowNumber, message: cause instanceof Error ? cause.message : "Ligne invalide." });
        if (errors.length >= 25) break;
      }
    }
    if (errors.length) return NextResponse.json({ error: "Aucune catégorie n’a été importée. Corrigez les lignes signalées puis réessayez.", rowErrors: errors }, { status: 422 });
    if (!imports.length) return NextResponse.json({ error: "Le fichier ne contient aucune catégorie." }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("import_commerce_categories", {
      p_tenant_id: access.context.tenantId!, p_actor_user_id: access.context.user!.id, p_rows: imports,
    });
    if (error) return NextResponse.json({ error: "Import annulé. Vérifiez les permissions, l’abonnement et les chemins des catégories." }, { status: 400 });
    return NextResponse.json({ imported: Number(data ?? 0) }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Service Commerce temporairement indisponible." }, { status: 500 });
  }
}
