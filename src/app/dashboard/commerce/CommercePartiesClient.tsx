"use client";

import { useEffect, useState, type FormEvent } from "react";

type Resource = "customers" | "suppliers";
type Party = Record<string, unknown> & { id: string; status: string; name?: string; display_name?: string; is_walk_in?: boolean };
type FormState = Record<string, string>;
const emptyCustomer: FormState = { customerType: "INDIVIDUAL", customerCode: "", displayName: "", businessName: "", phone: "", email: "", address: "", city: "", country: "", taxNumber: "", customerCategory: "", priceList: "RETAIL", creditLimitXof: "0", paymentTermsDays: "0", notes: "" };
const emptySupplier: FormState = { supplierCode: "", name: "", contactName: "", phone: "", email: "", address: "", city: "", country: "", taxNumber: "", paymentTermsDays: "0", leadTimeDays: "", deliveryScore: "", qualityScore: "", notes: "" };
const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--primary)] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
const labelClass = "block text-xs font-bold text-[var(--muted)]";
const money = (value: unknown) => `${Number(value ?? 0).toLocaleString("fr-FR")} XOF`;

export function CommercePartiesClient({ tenantId, resource, canManage, canEdit }: { tenantId: string; resource: Resource; canManage: boolean; canEdit: boolean }) {
  const isCustomers = resource === "customers";
  const [items, setItems] = useState<Party[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(isCustomers ? emptyCustomer : emptySupplier);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(nextOffset = offset, nextQuery = appliedQuery) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ tenantId, limit: "50", offset: String(nextOffset), status: "ALL" });
      if (nextQuery) params.set("q", nextQuery);
      const response = await fetch(`/api/commerce/${resource}?${params}`, { cache: "no-store" });
      const result = await response.json() as { customers?: Party[]; suppliers?: Party[]; total?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger la liste.");
      setItems(isCustomers ? result.customers ?? [] : result.suppliers ?? []);
      setTotal(result.total ?? 0);
      setOffset(nextOffset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger les données."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(0, ""); }, [tenantId, resource]);

  function startCreate() {
    setEditingId(null); setForm(isCustomers ? { ...emptyCustomer } : { ...emptySupplier }); setFormOpen(true); setError(""); setMessage("");
  }
  function startEdit(item: Party) {
    const formValues: FormState = isCustomers ? {
      customerType: String(item.customer_type ?? "INDIVIDUAL"), customerCode: String(item.customer_code ?? ""), displayName: String(item.display_name ?? ""), businessName: String(item.business_name ?? ""),
      phone: String(item.phone ?? ""), email: String(item.email ?? ""), address: String(item.address ?? ""), city: String(item.city ?? ""), country: String(item.country ?? ""), taxNumber: String(item.tax_number ?? ""),
      customerCategory: String(item.customer_category ?? ""), priceList: String(item.price_list ?? "RETAIL"), creditLimitXof: String(item.credit_limit_xof ?? 0), paymentTermsDays: String(item.payment_terms_days ?? 0), notes: String(item.notes ?? ""),
    } : {
      supplierCode: String(item.supplier_code ?? ""), name: String(item.name ?? ""), contactName: String(item.contact_name ?? ""), phone: String(item.phone ?? ""), email: String(item.email ?? ""),
      address: String(item.address ?? ""), city: String(item.city ?? ""), country: String(item.country ?? ""), taxNumber: String(item.tax_number ?? ""), paymentTermsDays: String(item.payment_terms_days ?? 0),
      leadTimeDays: String(item.lead_time_days ?? ""), deliveryScore: String(item.delivery_score ?? ""), qualityScore: String(item.quality_score ?? ""), notes: String(item.notes ?? ""),
    };
    setForm(formValues); setEditingId(item.id); setFormOpen(true); setError(""); setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const payload = { ...form, tenantId };
      const response = await fetch(editingId ? `/api/commerce/${resource}/${editingId}` : `/api/commerce/${resource}`, {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer cette fiche.");
      setFormOpen(false); setMessage(isCustomers ? "Client enregistré et journalisé." : "Fournisseur enregistré et journalisé.");
      await load(0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer."); }
    finally { setSaving(false); }
  }

  async function changeStatus(item: Party) {
    const status = item.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/commerce/${resource}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, status }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de changer le statut.");
      setMessage(status === "ACTIVE" ? "Fiche réactivée." : "Fiche archivée sans suppression des données.");
      await load(offset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de modifier le statut."); }
    finally { setSaving(false); }
  }

  const heading = isCustomers ? "Clients" : "Fournisseurs";
  const nameOf = (item: Party) => String(isCustomers ? item.display_name ?? "" : item.name ?? "");
  const canWrite = canManage && canEdit;
  const field = (key: string, label: string, type = "text", required = false) => <label key={key} className={labelClass}>{label}<input type={type} required={required} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} /></label>;
  const selectField = (key: string, label: string, options: Array<[string, string]>) => <label key={key} className={labelClass}>{label}<select value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className={inputClass}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const textarea = (key: string, label: string) => <label key={key} className={`${labelClass} sm:col-span-2`}>{label}<textarea rows={3} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--primary)] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" /></label>;

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 rounded-[1.5rem] bg-gradient-to-br from-[#063327] to-[#0b7658] p-6 text-white sm:flex-row sm:items-end sm:p-8">
      <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Référentiels Commerce</p><h1 className="mt-2 text-3xl font-black">{heading}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80">{isCustomers ? "Gérez vos clients particuliers et entreprises, leurs coordonnées et leurs conditions commerciales." : "Gérez les partenaires d’approvisionnement, leurs coordonnées, délais et indicateurs de service."}</p></div>
      {canWrite && <button type="button" onClick={startCreate} className="min-h-11 shrink-0 rounded-xl bg-amber-300 px-4 text-sm font-black text-slate-950">+ Ajouter {isCustomers ? "un client" : "un fournisseur"}</button>}
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{message}</p>}

    {formOpen && <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[var(--secondary)]">{editingId ? "Mise à jour" : "Nouvelle fiche"}</p><h2 className="mt-1 text-xl font-black">{isCustomers ? "Informations client" : "Informations fournisseur"}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Fermer le formulaire" className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-bold">Fermer</button></div>
      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isCustomers ? <>
          {selectField("customerType", "Type de client", [["INDIVIDUAL", "Particulier"], ["BUSINESS", "Entreprise"]])}
          {field("displayName", "Nom affiché", "text", true)}
          {field("customerCode", "Code client")}
          {form.customerType === "BUSINESS" && field("businessName", "Raison sociale", "text", true)}
          {field("phone", "Téléphone", "tel")}{field("email", "E-mail", "email")}
          {selectField("priceList", "Tarif par défaut", [["RETAIL", "Détail"], ["SEMI_WHOLESALE", "Semi-gros"], ["WHOLESALE", "Gros"]])}
          {field("creditLimitXof", "Plafond de crédit (XOF)", "number")}{field("paymentTermsDays", "Délai de paiement (jours)", "number")}
          {field("customerCategory", "Catégorie client")}{field("taxNumber", "N° fiscal")}{field("country", "Pays")}{field("city", "Ville")}
          {field("address", "Adresse")}{textarea("notes", "Notes internes")}
        </> : <>
          {field("name", "Nom du fournisseur", "text", true)}{field("supplierCode", "Code fournisseur")}{field("contactName", "Personne à contacter")}
          {field("phone", "Téléphone", "tel")}{field("email", "E-mail", "email")}{field("taxNumber", "N° fiscal")}
          {field("paymentTermsDays", "Délai de paiement (jours)", "number")}{field("leadTimeDays", "Délai de livraison (jours)", "number")}
          {field("deliveryScore", "Score de livraison (0–5)", "number")}{field("qualityScore", "Score qualité (0–5)", "number")}
          {field("country", "Pays")}{field("city", "Ville")}{field("address", "Adresse")}{textarea("notes", "Notes internes")}
        </>}
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3"><button disabled={saving} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white disabled:opacity-60">{saving ? "Enregistrement…" : editingId ? "Enregistrer les changements" : "Créer la fiche"}</button><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 rounded-xl border border-[var(--line)] px-5 text-sm font-bold">Annuler</button></div>
      </form>
    </section>}

    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <form onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); void load(0, query.trim()); }} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={`${resource}-search`}>Rechercher {heading.toLowerCase()}</label><input id={`${resource}-search`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isCustomers ? "Nom, code, téléphone ou e-mail" : "Nom, code, contact ou téléphone"} className="min-h-11 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold" />
        <button className="min-h-11 rounded-xl border border-[var(--line)] px-4 text-sm font-black">Rechercher</button>
        {appliedQuery && <button type="button" onClick={() => { setQuery(""); setAppliedQuery(""); void load(0, ""); }} className="min-h-11 rounded-xl px-3 text-sm font-bold text-[var(--secondary)]">Effacer</button>}
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold text-[var(--muted)]">{total.toLocaleString("fr-FR")} fiche(s) · les données sont propres à cet établissement.</p><p className="text-xs font-semibold text-[var(--muted)]">Les suppressions sont remplacées par l’archivage pour préserver l’historique.</p></div>
      {loading ? <p className="py-12 text-center text-sm font-bold text-[var(--muted)]">Chargement…</p> : items.length === 0 ? <div className="py-12 text-center"><p className="text-lg font-black">Aucun résultat</p><p className="mt-1 text-sm text-[var(--muted)]">Modifiez la recherche ou ajoutez une fiche.</p></div> : <div className="mt-4 space-y-3">{items.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.is_walk_in ? "border-amber-200 bg-amber-50/70" : "border-[var(--line)] bg-[var(--background)]"}`}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-[var(--primary)]">{nameOf(item)}</h3>{item.is_walk_in && <span className="rounded-full bg-amber-200 px-2 py-1 text-[10px] font-black text-amber-950">CLIENT COMPTOIR</span>}<span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>{item.status === "ACTIVE" ? "Actif" : "Archivé"}</span></div>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{isCustomers ? `${item.customer_type === "BUSINESS" ? "Entreprise" : "Particulier"}${item.customer_code ? ` · ${item.customer_code}` : ""}${item.price_list ? ` · Tarif ${item.price_list}` : ""}` : `${item.supplier_code ? `${item.supplier_code} · ` : ""}${item.contact_name ? `Contact : ${item.contact_name}` : "Fournisseur Commerce"}`}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{[item.phone, item.email, item.city, item.country].filter(Boolean).map(String).join(" · ") || "Aucune coordonnée ajoutée"}</p>
          {isCustomers && <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Crédit : {money(item.credit_limit_xof)} · Paiement : {Number(item.payment_terms_days ?? 0)} jour(s)</p>}
          {!isCustomers && <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Délai : {item.lead_time_days == null ? "Non défini" : `${String(item.lead_time_days)} jour(s)`} · Livraison : {item.delivery_score == null ? "—" : String(item.delivery_score)}/5 · Qualité : {item.quality_score == null ? "—" : String(item.quality_score)}/5</p>}
        </div>
        {canWrite && !item.is_walk_in && <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => startEdit(item)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black">Modifier</button><button type="button" disabled={saving} onClick={() => void changeStatus(item)} className="min-h-10 rounded-lg px-3 text-xs font-black text-[var(--secondary)] disabled:opacity-50">{item.status === "ACTIVE" ? "Archiver" : "Réactiver"}</button></div>}
        </div>
      </article>)}</div>}
      <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><button type="button" disabled={offset === 0 || loading} onClick={() => void load(Math.max(0, offset - 50))} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:opacity-40">Précédent</button><span className="text-xs font-bold text-[var(--muted)]">{total === 0 ? 0 : offset + 1}–{Math.min(total, offset + 50)} sur {total}</span><button type="button" disabled={offset + 50 >= total || loading} onClick={() => void load(offset + 50)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:opacity-40">Suivant</button></div>
    </section>
  </div>;
}
