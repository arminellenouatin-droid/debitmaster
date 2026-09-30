"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

type Product = {
  id: string; category_id: string; category_name: string; primary_supplier_id: string | null; supplier_name: string | null;
  internal_code: string; barcode: string | null; supplier_reference: string | null; name: string; description: string | null; brand: string | null; base_unit: string;
  packages: Array<{ label: string; quantity: number }>; variants: Array<{ name: string; options: string[] }>;
  photo_paths: string[]; photo_urls: string[]; purchase_price_xof?: number | string | null; weighted_avg_cost_xof?: number | string | null; margin_retail_xof?: number | null;
  price_retail_xof: number | string; price_semi_wholesale_xof: number | string | null; price_wholesale_xof: number | string | null;
  tax_rate_basis_points: number; min_stock: number; max_stock: number | null; reorder_point: number; track_serial: boolean; track_lot: boolean; track_expiry: boolean; status: "ACTIVE" | "ARCHIVED";
};
type Category = { id: string; parent_id: string | null; name: string; description: string | null; color: string; icon_key: string; sort_order: number; status: "ACTIVE" | "ARCHIVED" };
type Supplier = { id: string; name: string; supplier_code: string | null; status: string };
type PriceHistoryEntry = { id: string; actorUserId: string | null; before: Record<string, unknown>; after: Record<string, unknown>; createdAt: string };
type Draft = { internalCode: string; name: string; categoryId: string; primarySupplierId: string; barcode: string; supplierReference: string; brand: string; baseUnit: string; description: string; packagesText: string; variantsText: string; photoPaths: string[]; photoUrls: string[]; purchasePriceXof: string; priceRetailXof: string; priceSemiWholesaleXof: string; priceWholesaleXof: string; taxRatePercent: string; minStock: string; maxStock: string; reorderPoint: string; trackSerial: boolean; trackLot: boolean; trackExpiry: boolean };
type Permission = "catalog.view" | "catalog.manage" | "costs.view" | "suppliers.view" | "reports.export";
const emptyDraft = (): Draft => ({ internalCode: "", name: "", categoryId: "", primarySupplierId: "", barcode: "", supplierReference: "", brand: "", baseUnit: "unité", description: "", packagesText: "", variantsText: "", photoPaths: [], photoUrls: [], purchasePriceXof: "", priceRetailXof: "", priceSemiWholesaleXof: "", priceWholesaleXof: "", taxRatePercent: "0", minStock: "0", maxStock: "", reorderPoint: "0", trackSerial: false, trackLot: false, trackExpiry: false });
const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--primary)] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
const labelClass = "block text-xs font-bold text-[var(--muted)]";
const categoryIconLabels: Record<string, string> = { tag: "Étiquette", box: "Boîte", food: "Alimentation", drink: "Boisson", clothing: "Vêtement", tool: "Outil", other: "Autre" };
const priceFieldLabels: Record<string, string> = { purchase_price_xof: "Prix d’achat", weighted_avg_cost_xof: "Coût moyen pondéré", price_retail_xof: "Prix détail", price_semi_wholesale_xof: "Prix semi-gros", price_wholesale_xof: "Prix gros", tax_rate_basis_points: "TVA" };
const money = (value: unknown) => `${Number(value ?? 0).toLocaleString("fr-FR")} XOF`;
const numberValue = (value: string) => value.trim() === "" ? null : value.trim().replace(/\s/g, "").replace(/,/g, ".");
const historyValue = (key: string, value: unknown) => key === "tax_rate_basis_points" ? `${(Number(value ?? 0) / 100).toLocaleString("fr-FR")} %` : money(value);

function toPackages(text: string) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(.+?)\s*=\s*(\d+(?:[.,]\d+)?)$/);
    if (!match) throw new Error("Conditionnements : utilisez une ligne par format, par exemple carton=12.");
    return { label: match[1].trim(), quantity: Number(match[2].replace(",", ".")) };
  });
}
function toVariants(text: string) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const split = line.indexOf(":");
    if (split < 1) throw new Error("Variantes : utilisez une ligne par option, par exemple Couleur: rouge | bleu.");
    return { name: line.slice(0, split).trim(), options: line.slice(split + 1).split("|").map((value) => value.trim()).filter(Boolean) };
  });
}
const toPackagesText = (items: Array<{ label: string; quantity: number }>) => items.map((item) => `${item.label}=${item.quantity}`).join("\n");
const toVariantsText = (items: Array<{ name: string; options: string[] }>) => items.map((item) => `${item.name}: ${item.options.join(" | ")}`).join("\n");

export function CommerceCatalogClient({ tenantId, isOwner, permissions, accessMode }: { tenantId: string; isOwner: boolean; permissions: string[]; accessMode: "ACTIVE" | "GRACE" | "READ_ONLY" | "BLOCKED" }) {
  const permissionSet = useMemo(() => new Set(permissions as Permission[]), [permissions]);
  const can = (permission: Permission) => isOwner || permissionSet.has(permission);
  const canEdit = can("catalog.manage") && accessMode === "ACTIVE";
  const canSeeCosts = can("costs.view");
  const canExport = isOwner || permissionSet.has("reports.export");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [canSeeCostsFromApi, setCanSeeCostsFromApi] = useState(canSeeCosts);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#0f766e");
  const [newCategoryIcon, setNewCategoryIcon] = useState("tag");
  const [newCategorySortOrder, setNewCategorySortOrder] = useState("0");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCategoryFile, setSelectedCategoryFile] = useState<File | null>(null);

  async function loadProducts(nextOffset = offset, search = appliedQuery, nextCategory = categoryFilter, nextStatus = statusFilter) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ tenantId, limit: "50", offset: String(nextOffset), status: nextStatus });
      if (search) params.set("q", search);
      if (nextCategory) params.set("categoryId", nextCategory);
      const response = await fetch(`/api/commerce/catalog/products?${params}`, { cache: "no-store" });
      const result = await response.json() as { products?: Product[]; total?: number; canSeeCosts?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger le catalogue.");
      setProducts(result.products ?? []); setTotal(result.total ?? 0); setOffset(nextOffset); setCanSeeCostsFromApi(Boolean(result.canSeeCosts));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger le catalogue."); }
    finally { setLoading(false); }
  }
  async function loadReferences() {
    const [categoryResponse, supplierResponse] = await Promise.all([
      fetch(`/api/commerce/catalog/categories?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      can("suppliers.view") ? fetch(`/api/commerce/suppliers?tenantId=${encodeURIComponent(tenantId)}&status=ACTIVE&limit=100`, { cache: "no-store" }) : Promise.resolve(null),
    ]);
    const categoryData = await categoryResponse.json() as { categories?: Category[] };
    if (categoryResponse.ok) setCategories(categoryData.categories ?? []);
    if (supplierResponse) {
      const supplierData = await supplierResponse.json() as { suppliers?: Supplier[] };
      if (supplierResponse.ok) setSuppliers(supplierData.suppliers ?? []);
    }
  }
  useEffect(() => { void Promise.all([loadProducts(0), loadReferences()]); }, [tenantId]);

  function beginCreate() { setEditingId(null); setDraft(emptyDraft()); setFormOpen(true); setError(""); setMessage(""); }
  function beginEdit(product: Product) {
    setEditingId(product.id);
    setDraft({
      internalCode: product.internal_code, name: product.name, categoryId: product.category_id, primarySupplierId: product.primary_supplier_id ?? "",
      barcode: product.barcode ?? "", supplierReference: product.supplier_reference ?? "", brand: product.brand ?? "", baseUnit: product.base_unit,
      description: product.description ?? "", packagesText: toPackagesText(product.packages ?? []), variantsText: toVariantsText(product.variants ?? []), photoPaths: product.photo_paths ?? [], photoUrls: product.photo_urls ?? [],
      purchasePriceXof: product.purchase_price_xof == null ? "" : String(product.purchase_price_xof), priceRetailXof: String(product.price_retail_xof),
      priceSemiWholesaleXof: product.price_semi_wholesale_xof == null ? "" : String(product.price_semi_wholesale_xof), priceWholesaleXof: product.price_wholesale_xof == null ? "" : String(product.price_wholesale_xof),
      taxRatePercent: String(Number(product.tax_rate_basis_points ?? 0) / 100), minStock: String(product.min_stock ?? 0), maxStock: product.max_stock == null ? "" : String(product.max_stock), reorderPoint: String(product.reorder_point ?? 0),
      trackSerial: product.track_serial, trackLot: product.track_lot, trackExpiry: product.track_expiry,
    });
    setFormOpen(true); setError(""); setMessage("");
  }
  const updateDraft = (key: keyof Draft, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const packages = toPackages(draft.packagesText);
      const variants = toVariants(draft.variantsText);
      const payload: Record<string, unknown> = {
        tenantId, internalCode: draft.internalCode, name: draft.name, categoryId: draft.categoryId, primarySupplierId: draft.primarySupplierId || null,
        barcode: draft.barcode || null, supplierReference: draft.supplierReference || null, brand: draft.brand || null, baseUnit: draft.baseUnit,
        description: draft.description || null, packages, variants, photoPaths: draft.photoPaths, priceRetailXof: numberValue(draft.priceRetailXof),
        priceSemiWholesaleXof: numberValue(draft.priceSemiWholesaleXof), priceWholesaleXof: numberValue(draft.priceWholesaleXof),
        taxRatePercent: numberValue(draft.taxRatePercent), minStock: numberValue(draft.minStock), maxStock: numberValue(draft.maxStock), reorderPoint: numberValue(draft.reorderPoint),
        trackSerial: draft.trackSerial, trackLot: draft.trackLot, trackExpiry: draft.trackExpiry,
      };
      if (canSeeCostsFromApi) payload.purchasePriceXof = numberValue(draft.purchasePriceXof);
      const response = await fetch(editingId ? `/api/commerce/catalog/products/${editingId}` : "/api/commerce/catalog/products", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer le produit.");
      setMessage(editingId ? "Produit modifié et journalisé." : "Produit créé et journalisé."); setFormOpen(false); await Promise.all([loadProducts(0), loadReferences()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Vérifiez les informations du produit."); }
    finally { setBusy(false); }
  }

  async function uploadPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (draft.photoPaths.length + files.length > 5) { setError("Vous pouvez associer au maximum cinq photos à un produit."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const paths: string[] = []; const urls: string[] = [];
      for (const file of files) {
        const formData = new FormData(); formData.set("tenantId", tenantId); formData.set("photo", file);
        const response = await fetch("/api/commerce/catalog/product-images", { method: "POST", body: formData });
        const result = await response.json() as { photoPath?: string; photoUrl?: string; error?: string };
        if (!response.ok || !result.photoPath || !result.photoUrl) throw new Error(result.error ?? "Impossible de téléverser une photo.");
        paths.push(result.photoPath); urls.push(result.photoUrl);
      }
      setDraft((current) => ({ ...current, photoPaths: [...current.photoPaths, ...paths], photoUrls: [...current.photoUrls, ...urls] }));
      setMessage("Photos privées téléversées. Enregistrez le produit pour les associer à sa fiche.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Le téléversement a échoué."); }
    finally { setBusy(false); }
  }

  async function changeProductStatus(product: Product) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/commerce/catalog/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, status: product.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de changer le statut.");
      setMessage(product.status === "ACTIVE" ? "Produit archivé sans suppression de son historique." : "Produit réactivé."); await loadProducts(offset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de modifier le produit."); }
    finally { setBusy(false); }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = { tenantId, name: newCategoryName, description: newCategoryDescription, color: newCategoryColor, iconKey: newCategoryIcon, sortOrder: newCategorySortOrder, ...(!editingCategoryId ? { parentId: newCategoryParent || null } : {}) };
      const response = await fetch(editingCategoryId ? `/api/commerce/catalog/categories/${editingCategoryId}` : "/api/commerce/catalog/categories", { method: editingCategoryId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de créer la catégorie.");
      setNewCategoryName(""); setNewCategoryParent(""); setNewCategoryDescription(""); setNewCategoryColor("#0f766e"); setNewCategoryIcon("tag"); setNewCategorySortOrder("0");
      setMessage(editingCategoryId ? "Catégorie modifiée." : "Catégorie créée."); setEditingCategoryId(null); await loadReferences();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de créer la catégorie."); }
    finally { setBusy(false); }
  }

  function beginEditCategory(category: Category) {
    setEditingCategoryId(category.id); setNewCategoryName(category.name); setNewCategoryParent(category.parent_id ?? "");
    setNewCategoryDescription(category.description ?? ""); setNewCategoryColor(category.color || "#0f766e"); setNewCategoryIcon(category.icon_key || "tag"); setNewCategorySortOrder(String(category.sort_order));
    setError(""); setMessage("");
  }

  async function archiveCategory(category: Category) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/commerce/catalog/categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, status: category.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier la catégorie.");
      setMessage(category.status === "ACTIVE" ? "Catégorie archivée sans supprimer ses produits." : "Catégorie réactivée."); await loadReferences(); await loadProducts(0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de modifier la catégorie."); }
    finally { setBusy(false); }
  }

  async function mergeCategories(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/commerce/catalog/categories/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, sourceCategoryId: mergeSource, targetCategoryId: mergeTarget }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Fusion impossible.");
      setMergeSource(""); setMergeTarget(""); setMessage("Catégories fusionnées; les produits ont été réaffectés de façon atomique."); await loadReferences(); await loadProducts(0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fusion impossible."); }
    finally { setBusy(false); }
  }

  async function importProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedFile) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const formData = new FormData(); formData.set("tenantId", tenantId); formData.set("file", selectedFile);
      const response = await fetch("/api/commerce/catalog/products/import", { method: "POST", body: formData });
      const result = await response.json() as { imported?: number; error?: string; rowErrors?: Array<{ row: number; message: string }> };
      if (!response.ok) {
        const details = result.rowErrors?.map((item) => `Ligne ${item.row} : ${item.message}`).join("\n");
        throw new Error([result.error ?? "Import impossible.", details].filter(Boolean).join("\n"));
      }
      setMessage(`${result.imported ?? 0} produit(s) importé(s).`); setSelectedFile(null); await loadProducts(0); await loadReferences();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import impossible."); }
    finally { setBusy(false); }
  }

  async function importCategories(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedCategoryFile) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const formData = new FormData(); formData.set("tenantId", tenantId); formData.set("file", selectedCategoryFile);
      const response = await fetch("/api/commerce/catalog/categories/import", { method: "POST", body: formData });
      const result = await response.json() as { imported?: number; error?: string; rowErrors?: Array<{ row: number; message: string }> };
      if (!response.ok) {
        const details = result.rowErrors?.map((item) => `Ligne ${item.row} : ${item.message}`).join("\n");
        throw new Error([result.error ?? "Import impossible.", details].filter(Boolean).join("\n"));
      }
      setMessage(`${result.imported ?? 0} catégorie(s) créée(s) ou mise à jour(s).`); setSelectedCategoryFile(null); await loadReferences(); await loadProducts(0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import de catégories impossible."); }
    finally { setBusy(false); }
  }

  async function togglePriceHistory(product: Product) {
    if (historyProductId === product.id) { setHistoryProductId(null); return; }
    setHistoryProductId(product.id); setHistoryLoading(true); setError(""); setPriceHistory([]);
    try {
      const response = await fetch(`/api/commerce/catalog/products/${product.id}/price-history?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const result = await response.json() as { history?: PriceHistoryEntry[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger l’historique.");
      setPriceHistory(result.history ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger l’historique."); }
    finally { setHistoryLoading(false); }
  }

  const topCategories = categories.filter((category) => !category.parent_id);
  const activeCategories = categories.filter((category) => category.status === "ACTIVE");
  const categoryPath = (category: Category) => {
    const names = [category.name]; const visited = new Set([category.id]); let parentId = category.parent_id;
    while (parentId && names.length < 8 && !visited.has(parentId)) { visited.add(parentId); const parent = categories.find((item) => item.id === parentId); if (!parent) break; names.unshift(parent.name); parentId = parent.parent_id; }
    return names.join(" / ");
  };
  const childrenOf = (parentId: string) => activeCategories.filter((category) => category.parent_id === parentId);
  const input = (key: keyof Draft, label: string, type = "text", required = false) => <label className={labelClass}>{label}<input type={type} required={required} value={draft[key] as string} onChange={(event) => updateDraft(key, event.target.value)} className={inputClass} /></label>;
  const checkbox = (key: "trackSerial" | "trackLot" | "trackExpiry", label: string) => <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-[var(--primary)]"><input type="checkbox" checked={draft[key]} onChange={(event) => updateDraft(key, event.target.checked)} className="h-4 w-4 accent-emerald-700" />{label}</label>;

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 rounded-[1.5rem] bg-gradient-to-br from-[#063327] to-[#0b7658] p-6 text-white sm:flex-row sm:items-end sm:p-8"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Commerce achat-vente · Référentiel dédié</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Catalogue produits</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80">Produits, catégories, conditionnements, variantes et tarifs propres à cet établissement. Les données d’inventaire et de ventes seront rattachées aux modules prévus dans les prochains sprints.</p></div>{canEdit && <button type="button" onClick={beginCreate} className="min-h-11 shrink-0 rounded-xl bg-amber-300 px-4 text-sm font-black text-slate-950">+ Nouveau produit</button>}</header>
    {accessMode !== "ACTIVE" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">{accessMode === "GRACE" ? "Période de grâce : le catalogue est consultable, mais les modifications sont suspendues." : "Accès en lecture seule : réactivez l’abonnement pour modifier le catalogue."}</p>}
    {error && <p role="alert" className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{message}</p>}

    <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[var(--secondary)]">Import et export</p><h2 className="mt-1 text-xl font-black">CSV UTF-8 · Excel XLSX</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Import strict, 1 000 produits maximum par fichier, 5 Mo maximum. Les formules Excel sont refusées.</p></div></div>
        <div className="mt-4 flex flex-wrap gap-2"><a href={`/api/commerce/catalog/products/export?${new URLSearchParams({ tenantId, format: "csv", template: "1" })}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] px-3 text-xs font-black">Télécharger le modèle CSV</a><a href={`/api/commerce/catalog/products/export?${new URLSearchParams({ tenantId, format: "xlsx", template: "1" })}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] px-3 text-xs font-black">Modèle Excel</a>
          {canExport && <><a href={`/api/commerce/catalog/products/export?${new URLSearchParams({ tenantId, format: "csv" })}`} className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-black text-white">Exporter CSV</a><a href={`/api/commerce/catalog/products/export?${new URLSearchParams({ tenantId, format: "xlsx" })}`} className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-black text-white">Exporter Excel</a></>}
        </div>
        {canEdit && <form onSubmit={importProducts} className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-end"><label className={`${labelClass} flex-1`}>Importer un catalogue<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="mt-2 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-white p-2 text-xs" /></label><button disabled={!selectedFile || busy} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50">{busy ? "Traitement…" : "Importer"}</button></form>}
      </article>
      <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div><p className="text-[10px] font-black uppercase tracking-widest text-[var(--secondary)]">Taxonomie</p><h2 className="mt-1 text-xl font-black">Catégories</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Catégories et sous-catégories structurent uniquement le catalogue Commerce.</p></div>
        <div className="mt-4 flex flex-wrap gap-2"><a href={`/api/commerce/catalog/categories/export?${new URLSearchParams({ tenantId, format: "csv", template: "1" })}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] px-3 text-xs font-black">Modèle CSV catégories</a><a href={`/api/commerce/catalog/categories/export?${new URLSearchParams({ tenantId, format: "xlsx", template: "1" })}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] px-3 text-xs font-black">Modèle Excel catégories</a>{canExport && <><a href={`/api/commerce/catalog/categories/export?${new URLSearchParams({ tenantId, format: "csv" })}`} className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-black text-white">Exporter CSV</a><a href={`/api/commerce/catalog/categories/export?${new URLSearchParams({ tenantId, format: "xlsx" })}`} className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-black text-white">Exporter Excel</a></>}</div>
        {canEdit && <form onSubmit={importCategories} className="mt-3 flex flex-col gap-2 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end"><label className={`${labelClass} flex-1`}>Importer des catégories (CSV ou Excel)<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setSelectedCategoryFile(event.target.files?.[0] ?? null)} className="mt-2 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-white p-2 text-xs" /></label><button disabled={!selectedCategoryFile || busy} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50">Importer</button></form>}
        {canEdit && <form onSubmit={createCategory} className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4 sm:grid-cols-2"><p className="text-xs font-black sm:col-span-2">{editingCategoryId ? "Modifier la catégorie" : "Créer une catégorie"}</p><label className={labelClass}>Nom<input required minLength={2} maxLength={80} value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Nom de la catégorie" className={inputClass} /></label>{editingCategoryId ? <p className={`${labelClass} self-end pb-3`}>Parent actuel : {categories.find((item) => item.id === categories.find((entry) => entry.id === editingCategoryId)?.parent_id)?.name ?? "Catégorie principale"}</p> : <label className={labelClass}>Parent (facultatif)<select value={newCategoryParent} onChange={(event) => setNewCategoryParent(event.target.value)} className={inputClass}><option value="">Catégorie principale</option>{activeCategories.map((item) => <option key={item.id} value={item.id}>{categoryPath(item)}</option>)}</select></label>}<label className={labelClass}>Icône<select value={newCategoryIcon} onChange={(event) => setNewCategoryIcon(event.target.value)} className={inputClass}>{Object.entries(categoryIconLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className={labelClass}>Couleur<input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} className="mt-1 h-11 w-full cursor-pointer rounded-xl border border-[var(--line)] bg-white p-1" /></label><label className={labelClass}>Ordre d’affichage<input type="number" min={-100000} max={100000} value={newCategorySortOrder} onChange={(event) => setNewCategorySortOrder(event.target.value)} className={inputClass} /></label><label className={`${labelClass} sm:col-span-2`}>Description<textarea maxLength={500} rows={2} value={newCategoryDescription} onChange={(event) => setNewCategoryDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold" /></label><div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-xs font-black text-white disabled:opacity-50">{editingCategoryId ? "Enregistrer" : "Ajouter"}</button>{editingCategoryId && <button type="button" onClick={() => { setEditingCategoryId(null); setNewCategoryName(""); setNewCategoryDescription(""); setNewCategoryParent(""); setNewCategoryColor("#0f766e"); setNewCategoryIcon("tag"); setNewCategorySortOrder("0"); }} className="min-h-10 rounded-lg border border-[var(--line)] px-4 text-xs font-black">Annuler</button>}</div></form>}
        <div className="mt-4 max-h-60 space-y-2 overflow-auto">{categories.map((category) => <div key={category.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2"><p className="flex min-w-0 items-center gap-2 truncate text-xs font-bold"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color || "#0f766e" }} /><span className="truncate">{category.parent_id ? <span className="text-[var(--muted)]">↳ {categoryPath(categories.find((parent) => parent.id === category.parent_id) ?? category)} / </span> : ""}{category.name}<span className={`ml-2 ${category.status === "ACTIVE" ? "text-emerald-700" : "text-slate-500"}`}>{category.status === "ACTIVE" ? "· active" : "· archivée"}</span></span></p>{canEdit && <div className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={() => beginEditCategory(category)} className="min-h-9 rounded-md px-2 text-[10px] font-black text-[var(--primary)] disabled:opacity-50">Modifier</button><button type="button" disabled={busy} onClick={() => void archiveCategory(category)} className="min-h-9 rounded-md px-2 text-[10px] font-black text-[var(--secondary)] disabled:opacity-50">{category.status === "ACTIVE" ? "Archiver" : "Réactiver"}</button></div>}</div>)}{categories.length === 0 && <p className="text-xs text-[var(--muted)]">Aucune catégorie pour le moment.</p>}</div>
        {isOwner && canEdit && topCategories.length > 1 && <form onSubmit={mergeCategories} className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4 sm:grid-cols-2"><label className={labelClass}>Catégorie source<select required value={mergeSource} onChange={(event) => setMergeSource(event.target.value)} className={inputClass}><option value="">Choisir</option>{activeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={labelClass}>Catégorie cible<select required value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value)} className={inputClass}><option value="">Choisir</option>{activeCategories.filter((item) => item.id !== mergeSource).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="text-[10px] leading-4 text-[var(--muted)] sm:col-span-2">Les produits et sous-catégories sont réaffectés; la catégorie source vide est archivée dans la même transaction.</p><button disabled={!mergeSource || !mergeTarget || busy} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black sm:col-span-2">Fusionner (promoteur)</button></form>}
      </article>
    </section>

    {formOpen && <section className="rounded-2xl border border-emerald-200 bg-[var(--surface)] p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[var(--secondary)]">{editingId ? "Modifier la fiche" : "Nouveau produit"}</p><h2 className="mt-1 text-2xl font-black">Informations produit</h2></div><button type="button" onClick={() => setFormOpen(false)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black">Fermer</button></div>
      <form onSubmit={saveProduct} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {input("internalCode", "Code interne", "text", true)}{input("name", "Nom du produit", "text", true)}
        <label className={labelClass}>Catégorie<select required value={draft.categoryId} onChange={(event) => updateDraft("categoryId", event.target.value)} className={inputClass}><option value="">Choisir une catégorie active</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? `↳ ${categories.find((parent) => parent.id === category.parent_id)?.name} / ` : ""}{category.name}</option>)}</select></label>
        {input("brand", "Marque")}{input("baseUnit", "Unité de base", "text", true)}{input("barcode", "Code-barres")}{can("suppliers.view") && input("supplierReference", "Référence fournisseur")}
        {can("suppliers.view") && <label className={labelClass}>Fournisseur principal<select value={draft.primarySupplierId} onChange={(event) => updateDraft("primarySupplierId", event.target.value)} className={inputClass}><option value="">Aucun fournisseur principal</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.supplier_code ? ` · ${supplier.supplier_code}` : ""}</option>)}</select></label>}
        <label className={`${labelClass} sm:col-span-2 xl:col-span-3`}>Description<textarea rows={3} maxLength={2000} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-600" /></label>
        <h3 className="text-sm font-black text-[var(--primary)] sm:col-span-2 xl:col-span-3">Prix de vente et coût · XOF</h3>
        {canSeeCostsFromApi && input("purchasePriceXof", "Prix d’achat (coût)", "number")}{input("priceRetailXof", "Prix de vente détail", "number", true)}{input("priceSemiWholesaleXof", "Prix de vente semi-gros", "number")}{input("priceWholesaleXof", "Prix de vente gros", "number")}{input("taxRatePercent", "TVA (%)", "number")}
        <h3 className="text-sm font-black text-[var(--primary)] sm:col-span-2 xl:col-span-3">Stock de référence</h3>
        {input("minStock", "Stock minimum", "number")}{input("maxStock", "Stock maximum", "number")}{input("reorderPoint", "Seuil de réapprovisionnement", "number")}
        <div className="grid gap-2 sm:col-span-2 xl:col-span-3 sm:grid-cols-3">{checkbox("trackSerial", "Suivre les numéros de série")}{checkbox("trackLot", "Suivre les lots")}{checkbox("trackExpiry", "Suivre les dates d’expiration")}</div>
        <label className={`${labelClass} sm:col-span-2 xl:col-span-3`}>Conditionnements (un par ligne, format <code>carton=12</code>)<textarea rows={3} value={draft.packagesText} onChange={(event) => updateDraft("packagesText", event.target.value)} placeholder="carton=12\npack=6" className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold" /></label>
        <label className={`${labelClass} sm:col-span-2 xl:col-span-3`}>Variantes (une ligne par type, format <code>Couleur: rouge | bleu</code>)<textarea rows={3} value={draft.variantsText} onChange={(event) => updateDraft("variantsText", event.target.value)} placeholder="Couleur: rouge | bleu\nTaille: S | M | L" className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold" /></label>
        <div className="sm:col-span-2 xl:col-span-3"><label className={labelClass}>Photos produit privées (JPEG, PNG ou WebP; 5 Mo maximum par photo)<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || draft.photoPaths.length >= 5} onChange={(event) => void uploadPhotos(event)} className="mt-2 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-white p-2 text-xs" /></label><div className="mt-3 flex flex-wrap gap-3">{draft.photoPaths.map((path, index) => <div key={path} className="relative"><img src={draft.photoUrls[index]} alt={`Photo produit ${index + 1}`} className="h-20 w-20 rounded-lg border border-[var(--line)] object-cover" /><button type="button" aria-label={`Retirer la photo ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, photoPaths: current.photoPaths.filter((_, i) => i !== index), photoUrls: current.photoUrls.filter((_, i) => i !== index) }))} className="absolute -right-2 -top-2 min-h-7 min-w-7 rounded-full bg-slate-900 text-sm font-black text-white">×</button></div>)}</div></div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3"><button disabled={busy || activeCategories.length === 0} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white disabled:opacity-50">{busy ? "Enregistrement…" : editingId ? "Enregistrer le produit" : "Créer le produit"}</button><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 rounded-xl border border-[var(--line)] px-5 text-sm font-black">Annuler</button></div>
      </form>
    </section>}

    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-[10px] font-black uppercase tracking-widest text-[var(--secondary)]">Établissement Commerce courant</p><h2 className="mt-1 text-2xl font-black">Produits</h2><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{total.toLocaleString("fr-FR")} produit(s) · l’inventaire réel sera rattaché au module stock dédié.</p></div><form onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); void loadProducts(0, query.trim()); }} className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,0.8fr)_auto]"><label className={labelClass}><span className="sr-only">Rechercher un produit</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, code ou code-barres" className={inputClass} /></label><label className={labelClass}><span className="sr-only">Filtrer par catégorie</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); void loadProducts(0, appliedQuery, event.target.value); }} className={inputClass}><option value="">Toutes les catégories</option>{activeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={labelClass}><span className="sr-only">Filtrer par statut</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); void loadProducts(0, appliedQuery, categoryFilter, event.target.value); }} className={inputClass}><option value="ACTIVE">Actifs</option><option value="ARCHIVED">Archivés</option><option value="ALL">Tous</option></select></label><button className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-xs font-black text-white sm:col-span-3 lg:col-span-1">Rechercher</button></form></div>
      {loading ? <p className="py-14 text-center text-sm font-bold text-[var(--muted)]">Chargement du catalogue…</p> : products.length === 0 ? <div className="py-14 text-center"><p className="text-lg font-black">Aucun produit trouvé</p><p className="mt-1 text-sm text-[var(--muted)]">Créez un produit ou adaptez vos filtres.</p>{canEdit && <button type="button" onClick={beginCreate} className="mt-4 min-h-10 rounded-lg bg-emerald-700 px-4 text-xs font-black text-white">Créer un produit</button>}</div> : <div className="mt-5 space-y-3">{products.map((product) => <article key={product.id} className={`rounded-xl border p-4 ${product.status === "ARCHIVED" ? "border-slate-200 bg-slate-50" : "border-[var(--line)] bg-[var(--background)]"}`}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex min-w-0 gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">{product.photo_urls?.[0] ? <img src={product.photo_urls[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">PHOTO</div>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-[var(--primary)]">{product.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-black ${product.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>{product.status === "ACTIVE" ? "Actif" : "Archivé"}</span></div><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{product.internal_code} · {product.category_name}{product.brand ? ` · ${product.brand}` : ""}{product.barcode ? ` · ${product.barcode}` : ""}</p><p className="mt-2 text-sm font-black">Détail : {money(product.price_retail_xof)}{product.price_semi_wholesale_xof != null ? ` · Semi-gros : ${money(product.price_semi_wholesale_xof)}` : ""}{product.price_wholesale_xof != null ? ` · Gros : ${money(product.price_wholesale_xof)}` : ""}</p><p className="mt-1 text-xs text-[var(--muted)]">Unité : {product.base_unit} · Seuil mini : {Number(product.min_stock).toLocaleString("fr-FR")} · Réappro. : {Number(product.reorder_point).toLocaleString("fr-FR")}{product.supplier_name ? ` · Fournisseur : ${product.supplier_name}` : ""}</p>{canSeeCostsFromApi && <p className="mt-1 text-xs font-bold text-amber-900">Achat : {product.purchase_price_xof == null ? "non renseigné" : money(product.purchase_price_xof)}{product.margin_retail_xof != null ? ` · Marge au détail : ${money(product.margin_retail_xof)}` : ""}</p>}</div></div>{canEdit && <div className="flex shrink-0 gap-2"><button type="button" onClick={() => beginEdit(product)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black">Modifier</button><button type="button" aria-expanded={historyProductId === product.id} onClick={() => void togglePriceHistory(product)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black">Historique des prix</button><button type="button" disabled={busy} onClick={() => void changeProductStatus(product)} className="min-h-10 rounded-lg px-3 text-xs font-black text-[var(--secondary)] disabled:opacity-50">{product.status === "ACTIVE" ? "Archiver" : "Réactiver"}</button></div>}</div>{historyProductId === product.id && <div className="mt-4 border-t border-[var(--line)] pt-4"><h4 className="text-xs font-black uppercase tracking-wider">Historique des prix · 50 derniers changements</h4>{historyLoading ? <p className="mt-3 text-xs text-[var(--muted)]">Chargement…</p> : priceHistory.length === 0 ? <p className="mt-3 text-xs text-[var(--muted)]">Aucun historique tarifaire pour ce produit.</p> : <ol className="mt-3 space-y-3">{priceHistory.map((entry) => { const changed = Object.keys(entry.after).filter((key) => key in priceFieldLabels && !Object.is(entry.before[key], entry.after[key])); return <li key={entry.id} className="rounded-lg bg-white p-3"><p className="text-[10px] font-bold text-[var(--muted)]">{new Date(entry.createdAt).toLocaleString("fr-FR")} · utilisateur {entry.actorUserId ? entry.actorUserId.slice(0, 8) : "système"}</p>{changed.length ? <ul className="mt-2 space-y-1">{changed.map((key) => <li key={key} className="text-xs font-semibold">{priceFieldLabels[key]} : {entry.before[key] == null ? "—" : historyValue(key, entry.before[key])} → {historyValue(key, entry.after[key])}</li>)}</ul> : <p className="mt-2 text-xs text-[var(--muted)]">Aucun montant accessible à votre rôle pour cet événement.</p>}</li>; })}</ol>}</div>}</article>)}</div>}
      <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><button type="button" disabled={offset === 0 || loading} onClick={() => void loadProducts(Math.max(0, offset - 50))} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:opacity-40">Précédent</button><span className="text-xs font-bold text-[var(--muted)]">{total === 0 ? 0 : offset + 1}–{Math.min(total, offset + 50)} sur {total}</span><button type="button" disabled={offset + 50 >= total || loading} onClick={() => void loadProducts(offset + 50)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:opacity-40">Suivant</button></div>
    </section>
  </div>;
}
