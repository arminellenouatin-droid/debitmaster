"use client";

// DebitManager Power Repas: catalogue de repas réservé au Chef cuisine, isolé de la famille Boissons.
import { FormEvent, useEffect, useState } from "react";

type Category = { id: string; tenant_id: string; parent_id: string | null; name: string };
type Meal = { id: string; name: string; price: number; packaging_label: string | null; category_id: string | null; current_stock: number; product_type: string; stock_family: string };

type FormState = { name: string; price: string; categoryId: string; label: string };
const emptyForm: FormState = { name: "", price: "", categoryId: "", label: "" };
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;

export function MealCatalogClient({ tenantId }: { tenantId: string }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [productsResponse, categoriesResponse] = await Promise.all([
      fetch(`/api/products?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      fetch(`/api/categories?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
    ]);
    const productsResult = await productsResponse.json();
    const categoriesResult = await categoriesResponse.json();
    if (!productsResponse.ok) throw new Error(productsResult.error ?? "Impossible de charger les repas.");
    if (!categoriesResponse.ok) throw new Error(categoriesResult.error ?? "Impossible de charger les catégories.");
    setMeals((productsResult.products ?? []).filter((product: Meal) => product.stock_family === "KITCHEN" && product.product_type === "MENU"));
    setCategories(categoriesResult.categories ?? []);
  }

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Impossible de charger la liste des repas.")); }, [tenantId]);

  function resetForm() { setForm(emptyForm); setEditingMealId(null); }
  function beginEdit(meal: Meal) { setEditingMealId(meal.id); setForm({ name: meal.name, price: String(meal.price), categoryId: meal.category_id ?? "", label: meal.packaging_label ?? "" }); setError(""); setNotice(""); }

  async function submitMeal(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/products", { method: editingMealId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, productId: editingMealId ?? undefined, name: form.name, price: Number(form.price), categoryId: form.categoryId || null, packagingLabel: form.label || null, productType: "MENU", stockFamily: "KITCHEN", currentStock: 0, unit: "portion", alertThreshold: 0, safetyThreshold: 0 }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer le repas.");
      await load(); resetForm(); setNotice(editingMealId ? "Repas modifié." : "Repas ajouté à la liste.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer le repas."); }
    finally { setBusy(false); }
  }

  async function removeMeal(meal: Meal) {
    if (!window.confirm(`Supprimer « ${meal.name} » ? Le repas doit être sans stock ni mouvement actif.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, productId: meal.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de supprimer le repas.");
      setMeals((current) => current.filter((item) => item.id !== meal.id)); setNotice("Repas supprimé.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de supprimer le repas."); }
    finally { setBusy(false); }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/categories", { method: editingCategoryId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, categoryId: editingCategoryId ?? undefined, name: editingCategoryId ? editingCategoryName : categoryName }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer la catégorie.");
      await load(); setCategoryName(""); setEditingCategoryId(null); setEditingCategoryName(""); setNotice(editingCategoryId ? "Catégorie modifiée." : "Catégorie ajoutée.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la catégorie."); }
    finally { setBusy(false); }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, categoryId: category.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de supprimer la catégorie.");
      setCategories((current) => current.filter((item) => item.id !== category.id)); setNotice("Catégorie supprimée.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de supprimer la catégorie."); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 space-y-6" aria-labelledby="meal-catalog-title">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Catalogue cuisine</p><h2 id="meal-catalog-title" className="mt-2 text-2xl font-black text-[var(--primary)]">Liste des repas</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Le Chef cuisine gère les repas vendus, leurs catégories, leurs étiquettes et leurs prix. Les intrants restent suivis séparément dans le Magasin cuisine.</p></div>
    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || notice}</p>}
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <form onSubmit={submitMeal} className="rounded-2xl bg-[var(--primary)] p-6 text-white"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">{editingMealId ? "Modifier" : "Nouveau"}</p><h3 className="mt-2 text-xl font-black">Repas</h3></div>{editingMealId && <button type="button" onClick={resetForm} className="text-xs font-black text-white/70 underline">Annuler</button>}</div><label className="mt-5 block text-sm font-bold text-white/80">Nom du repas<input required minLength={2} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-white placeholder:text-white/45" placeholder="Ex. Riz au poulet" /></label><label className="mt-4 block text-sm font-bold text-white/80">Catégorie<select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-white"><option value="" className="text-black">Sans catégorie</option>{categories.map((category) => <option key={category.id} value={category.id} className="text-black">{category.name}</option>)}</select></label><label className="mt-4 block text-sm font-bold text-white/80">Étiquette<input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-white placeholder:text-white/45" placeholder="Ex. Portion, menu midi" /></label><label className="mt-4 block text-sm font-bold text-white/80">Prix de vente<input required min="0" type="number" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-white" /></label><button disabled={busy} className="mt-6 h-11 w-full rounded-lg bg-[var(--secondary-container)] text-sm font-black text-[var(--primary)] disabled:opacity-50">{busy ? "Enregistrement…" : editingMealId ? "Enregistrer les modifications" : "Créer le repas"}</button></form>
        <form onSubmit={saveCategory} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Organisation</p><h3 className="mt-2 text-lg font-black text-[var(--primary)]">Catégories</h3><div className="mt-4 flex gap-2"><input required minLength={2} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nouvelle catégorie" className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" /><button disabled={busy} className="rounded-lg bg-[var(--primary)] px-3 text-xs font-black text-white">Ajouter</button></div><div className="mt-4 space-y-2">{categories.map((category) => <div key={category.id} className="flex items-center gap-2 rounded-lg bg-[var(--background)] px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-bold text-[var(--primary)]">{category.name}</span><button type="button" onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }} className="text-xs font-black text-[var(--secondary)]">Modifier</button><button type="button" onClick={() => void removeCategory(category)} className="text-xs font-black text-[var(--danger)]">Supprimer</button></div>)}</div>{editingCategoryId && <div className="mt-4 flex gap-2"><input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" /><button type="button" onClick={(event) => void saveCategory(event as unknown as FormEvent)} className="rounded-lg bg-[var(--secondary)] px-3 text-xs font-black text-white">Enregistrer</button></div>}</form>
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-5"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Repas configurés</p><h3 className="mt-2 text-xl font-black text-[var(--primary)]">Catalogue de vente</h3></div><button type="button" onClick={() => void load()} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-black text-[var(--primary)]">Actualiser</button></div>{meals.length ? <div className="divide-y divide-[var(--line)]">{meals.map((meal) => <article key={meal.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><p className="font-black text-[var(--primary)]">{meal.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{categories.find((category) => category.id === meal.category_id)?.name ?? "Sans catégorie"}{meal.packaging_label ? ` · ${meal.packaging_label}` : ""} · {money(meal.price)}</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => beginEdit(meal)} className="text-xs font-black text-[var(--secondary)]">Modifier</button><button type="button" disabled={busy} onClick={() => void removeMeal(meal)} className="text-xs font-black text-[var(--danger)]">Supprimer</button></div></article>)}</div> : <div className="py-16 text-center text-sm text-[var(--muted)]">Aucun repas configuré pour le moment.</div>}</div>
    </div>
  </section>;
}
