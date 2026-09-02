"use client";

/* Design DebitManager Inventaire: atelier de contrôle clair, KPI réels, tableaux d’audit, ambre réservé aux alertes et aucune donnée simulée. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

type Product = { id: string; name: string; stock_family: "BEVERAGE" | "KITCHEN"; unit: string | null; price: number; current_stock: number; alert_threshold: number; safety_threshold: number; weighted_purchase_price: number | null; stock_value: number | null; category_name?: string | null };
type Store = { id: string; name: string; store_type: string; store_inventory?: { product_id: string; quantity: number; reserved_quantity?: number }[] };
type AuditItem = { id: string; product_id: string; theoretical_quantity: number; physical_quantity: number; unit_cost: number; variance_quantity: number; variance_value: number; cause?: string | null; justification?: string | null; products?: { id: string; name: string; unit: string | null; stock_family: string } | null };
type Audit = { id: string; title: string; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "CLOSED"; counted_at: string; submitted_at?: string | null; validated_at?: string | null; closed_at?: string | null; inventory_audit_items?: AuditItem[] };
type Purchase = { id: string; product_id: string; quantity: number; purchase_unit_price: number; purchased_at: string; invoice_number?: string | null; products?: { name: string } | null; inventory_stores?: { name: string } | null };
type Props = { tenantId: string; companyName: string; firstName: string };
type Tab = "dashboard" | "stocks" | "mouvements" | "inventaires" | "ecarts" | "seuils" | "rapports";

const tabs: Array<[Tab, string]> = [["dashboard", "Dashboard"], ["stocks", "Vue des stocks"], ["mouvements", "Mouvements"], ["inventaires", "Inventaire physique"], ["ecarts", "Écarts"], ["seuils", "Seuils & alertes"], ["rapports", "Rapports"]];
const statusLabels: Record<Audit["status"], string> = { DRAFT: "Brouillon", SUBMITTED: "Soumis au Propriétaire", APPROVED: "Validé", CLOSED: "Clôturé" };
const money = (value: number) => `${Math.round(value).toLocaleString("fr-FR")} XOF`;
const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function InventoryManagerClient({ tenantId, companyName, firstName }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [activeAuditId, setActiveAuditId] = useState("");
  const [auditTitle, setAuditTitle] = useState("");
  const [savingAudit, setSavingAudit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<"ALL" | "BEVERAGE" | "KITCHEN">("ALL");

  async function load() {
    if (!tenantId) return;
    setError("");
    setNotice("");
    const requests = await Promise.all([
      fetch(`/api/stock?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      fetch(`/api/stock/stores?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      fetch(`/api/stock/purchases?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      fetch(`/api/inventory-audits?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
    ]);
    const results = await Promise.all(requests.map((response) => response.json()));
    const failed = requests.findIndex((response) => !response.ok);
    if (failed >= 0) throw new Error(results[failed].error ?? "Impossible de charger la situation des stocks.");
    setProducts(results[0].stock ?? []); setStores(results[1].stores ?? []); setPurchases(results[2].purchases ?? []); setAudits(results[3].audits ?? []);
    if (!activeAuditId && results[3].audits?.[0]) setActiveAuditId(results[3].audits[0].id);
  }

  useEffect(() => { let active = true; setLoading(true); load().catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger les stocks.")).finally(() => active && setLoading(false)); return () => { active = false; }; }, [tenantId]);
  useLiveRefresh(() => load());

  const stockByProduct = useMemo(() => {
    const values = new Map<string, number>();
    stores.forEach((store) => {
      (store.store_inventory ?? []).forEach((line) => {
        values.set(line.product_id, (values.get(line.product_id) ?? 0) + Number(line.quantity || 0));
      });
    });
    return values;
  }, [stores]);
  const visibleProducts = useMemo(() => products.filter((item) => (family === "ALL" || item.stock_family === family) && item.name.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))), [products, family, query]);
  const quantity = (item: Product) => stockByProduct.has(item.id) ? stockByProduct.get(item.id) ?? 0 : Number(item.current_stock || 0);
  const alertProducts = products.filter((item) => quantity(item) <= Number(item.alert_threshold || 0));
  const criticalProducts = products.filter((item) => quantity(item) <= Number(item.safety_threshold || 0));
  const totalValue = products.reduce((sum, item) => sum + Number(item.stock_value ?? quantity(item) * Number(item.weighted_purchase_price ?? 0)), 0);
  const reserved = stores.reduce((sum, store) => sum + (store.store_inventory ?? []).reduce((inner, line) => inner + Number(line.reserved_quantity ?? 0), 0), 0);
  const recentPurchases = [...purchases].sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()).slice(0, 8);
  const activeAudit = audits.find((audit) => audit.id === activeAuditId) ?? null;
  const auditItems = activeAudit?.inventory_audit_items ?? [];
  const status = (item: Product) => quantity(item) <= Number(item.safety_threshold || 0) ? ["Critique", "inventory-status-critical"] : quantity(item) <= Number(item.alert_threshold || 0) ? ["Alerte", "inventory-status-alert"] : "Normal";
  async function auditAction(action: "CREATE" | "SAVE_ITEMS" | "SUBMIT", items?: Array<{ productId: string; theoreticalQuantity: number; physicalQuantity: number; unitCost: number; justification?: string }>) {
    setSavingAudit(true); setError("");
    try {
      const response = await fetch("/api/inventory-audits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, action, auditId: activeAuditId || undefined, title: auditTitle, items }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Opération d’inventaire impossible.");
      if (action === "CREATE") { setAuditTitle(""); setActiveAuditId(result.audit.id); }
      await load(); setNotice(action === "SUBMIT" ? "Inventaire soumis au Propriétaire." : action === "CREATE" ? "Session d’inventaire créée." : "Comptage enregistré.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Opération d’inventaire impossible."); } finally { setSavingAudit(false); }
  }

  return <section className="inventory-workspace"><header className="inventory-header"><div><p className="inventory-eyebrow">Contrôle des stocks · {companyName}</p><h1>Bonjour {firstName}, gardez une vue exacte.</h1><p>Un espace séparé des ventes : constater, comparer, justifier et soumettre. La validation finale appartient au Propriétaire.</p></div><Link href="/dashboard" className="inventory-return">Retour au tableau de bord</Link></header>
    <nav className="inventory-tabs" aria-label="Navigation inventaire">{tabs.map(([key, label]) => <button type="button" key={key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {(error || notice) && <div className={error ? "inventory-alert" : "inventory-notice"} role={error ? "alert" : "status"}>{error || notice}{error && <button type="button" onClick={() => void load()}>Réessayer</button>}</div>}
    {loading ? <div className="inventory-loading">Chargement des données réelles du tenant…</div> : <>
      {tab === "dashboard" && <div className="inventory-content"><div className="inventory-kpis"><article><span>Valeur théorique</span><strong>{money(totalValue)}</strong><small>Prix d’achat pondéré disponible</small></article><article><span>Articles en alerte</span><strong>{alertProducts.length}</strong><small>{criticalProducts.length} critique(s)</small></article><article><span>Produits suivis</span><strong>{products.length}</strong><small>{reserved} unité(s) réservée(s)</small></article><article><span>Dernières entrées</span><strong>{purchases.length}</strong><small>Historique disponible</small></article></div><div className="inventory-grid-two"><section className="inventory-card"><div className="inventory-card-heading"><div><p className="inventory-eyebrow">Priorité opérationnelle</p><h2>À contrôler maintenant</h2></div><button type="button" onClick={() => setTab("stocks")}>Voir le stock →</button></div>{alertProducts.length ? <div className="inventory-list">{alertProducts.slice(0, 8).map((item) => <div className="inventory-list-row" key={item.id}><div><strong>{item.name}</strong><span>{item.stock_family === "BEVERAGE" ? "Boisson" : "Cuisine"} · seuil {item.alert_threshold}</span></div><b className={status(item)[1] ?? "inventory-status-normal"}>{quantity(item)} {item.unit || "unités"}</b></div>)}</div> : <div className="inventory-empty"><strong>Aucune alerte active</strong><span>Les produits seront signalés dès qu’ils atteindront leur seuil.</span></div>}</section><section className="inventory-card"><div className="inventory-card-heading"><div><p className="inventory-eyebrow">Formule de référence</p><h2>Calcul traçable</h2></div></div><div className="inventory-formula"><span>Stock initial</span><b>+</b><span>Achats</span><b>−</b><span>Sorties</span><b>=</b><strong>Stock théorique</strong></div><p className="inventory-note">Les ventes, pertes, casses et transferts sont suivis dans les mouvements. Le responsable inventaire ne modifie pas les historiques.</p></section></div><section className="inventory-card"><div className="inventory-card-heading"><div><p className="inventory-eyebrow">Journal récent</p><h2>Dernières entrées de stock</h2></div><button type="button" onClick={() => setTab("mouvements")}>Tout l’historique →</button></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Date</th><th>Produit</th><th>Magasin</th><th>Quantité</th><th>Valeur</th></tr></thead><tbody>{recentPurchases.map((purchase) => <tr key={purchase.id}><td>{date(purchase.purchased_at)}</td><td>{purchase.products?.name ?? "Produit"}</td><td>{purchase.inventory_stores?.name ?? "—"}</td><td>+{purchase.quantity}</td><td>{money(purchase.quantity * purchase.purchase_unit_price)}</td></tr>)}</tbody></table></div></section></div>}
      {tab === "stocks" && <div className="inventory-content"><div className="inventory-toolbar"><div><p className="inventory-eyebrow">Vue par produit</p><h2>Situation des stocks</h2></div><div className="inventory-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher sans accent…" aria-label="Rechercher un produit" /><select value={family} onChange={(event) => setFamily(event.target.value as typeof family)}><option value="ALL">Toutes les familles</option><option value="BEVERAGE">Boissons</option><option value="KITCHEN">Cuisine</option></select></div></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Produit</th><th>Famille</th><th>Stock théorique</th><th>Prix achat</th><th>Valeur stock</th><th>Seuils</th><th>État</th></tr></thead><tbody>{visibleProducts.map((item) => { const state = status(item); return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.unit || "unité"}</small></td><td>{item.stock_family === "BEVERAGE" ? "Boissons" : "Cuisine"}</td><td>{quantity(item)}</td><td>{item.weighted_purchase_price == null ? "—" : money(item.weighted_purchase_price)}</td><td>{item.stock_value == null ? "—" : money(item.stock_value)}</td><td>{item.safety_threshold} / {item.alert_threshold}</td><td><span className={state[1] ?? "inventory-status-normal"}>{state[0] ?? state}</span></td></tr>; })}</tbody></table></div></div>}
      {tab === "mouvements" && <div className="inventory-content"><div className="inventory-card"><p className="inventory-eyebrow">Journal détaillé</p><h2>Mouvements disponibles</h2><p className="inventory-note">Les entrées d’achat et les transferts actuellement accessibles sont affichés ici. Les ventes et pertes seront raccordées au journal consolidé dans l’étape d’audit suivante.</p><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Quantité</th><th>Prix unitaire</th><th>Référence</th></tr></thead><tbody>{recentPurchases.map((purchase) => <tr key={purchase.id}><td>{date(purchase.purchased_at)}</td><td><span className="inventory-status-normal">Entrée achat</span></td><td>{purchase.products?.name ?? "Produit"}</td><td>+{purchase.quantity}</td><td>{money(purchase.purchase_unit_price)}</td><td>{purchase.invoice_number ?? purchase.id.slice(0, 8)}</td></tr>)}</tbody></table></div></div></div>}
      {tab === "inventaires" && <div className="inventory-content"><div className="inventory-card"><div className="inventory-card-heading"><div><p className="inventory-eyebrow">Session persistante</p><h2>Inventaire physique</h2></div><span className="inventory-status-normal">Validation Propriétaire</span></div><div className="inventory-audit-create"><input value={auditTitle} onChange={(event) => setAuditTitle(event.target.value)} placeholder="Nom de l’inventaire (facultatif)" aria-label="Nom de l’inventaire" /><button type="button" className="inventory-primary" disabled={savingAudit} onClick={() => void auditAction("CREATE")}>Nouvelle session</button></div>{audits.length > 0 && <label className="inventory-audit-select">Session active<select value={activeAuditId} onChange={(event) => setActiveAuditId(event.target.value)}>{audits.map((audit) => <option key={audit.id} value={audit.id}>{audit.title} · {statusLabels[audit.status]}</option>)}</select></label>}{activeAudit && <><div className="inventory-audit-meta"><span>État : <strong>{statusLabels[activeAudit.status]}</strong></span><span>Créé le {date(activeAudit.counted_at)}</span><span>{auditItems.length} ligne(s)</span></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Produit</th><th>Théorique</th><th>Physique compté</th><th>Écart</th><th>Justification</th></tr></thead><tbody>{products.map((item) => { const existing = auditItems.find((line) => line.product_id === item.id); return <tr key={item.id}><td>{item.name}</td><td>{quantity(item)}</td><td><input className="inventory-count-input" type="number" min="0" defaultValue={existing?.physical_quantity ?? quantity(item)} data-product-id={item.id} data-theoretical={quantity(item)} data-cost={Math.round(item.weighted_purchase_price ?? 0)} disabled={activeAudit.status !== "DRAFT"} /></td><td>{existing ? existing.variance_quantity : "—"}</td><td><input className="inventory-justification-input" placeholder={existing?.justification ?? "Obligatoire si écart"} data-justification-for={item.id} disabled={activeAudit.status !== "DRAFT"} /></td></tr>; })}</tbody></table></div><div className="inventory-audit-actions">{activeAudit.status === "DRAFT" && <><button type="button" className="inventory-secondary" disabled={savingAudit} onClick={() => { const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(".inventory-count-input")); const items = inputs.map((input) => ({ productId: input.dataset.productId ?? "", theoreticalQuantity: Number(input.dataset.theoretical ?? 0), physicalQuantity: Number(input.value || 0), unitCost: Number(input.dataset.cost ?? 0), justification: document.querySelector<HTMLInputElement>(`[data-justification-for="${input.dataset.productId}"]`)?.value })); void auditAction("SAVE_ITEMS", items); }}>Enregistrer le comptage</button><button type="button" className="inventory-primary" disabled={savingAudit} onClick={() => void auditAction("SUBMIT")}>Soumettre au Propriétaire</button></>}{activeAudit.status === "SUBMITTED" && <span className="inventory-note">En attente de la validation finale du Propriétaire.</span>}</div></>}</div></div>}
      {tab === "ecarts" && <div className="inventory-content"><div className="inventory-card inventory-hero-card"><p className="inventory-eyebrow">Écarts</p><h2>Comparer le physique au théorique.</h2><p>Aucun écart physique n’est inventé. Dès qu’une session de comptage sera clôturée par le Propriétaire, cette vue affichera les manquants, excédents, causes, statuts et régularisations.</p><button type="button" className="inventory-primary" disabled>Écarts après le premier inventaire</button></div></div>}
      {tab === "seuils" && <div className="inventory-content"><div className="inventory-card"><p className="inventory-eyebrow">Paramétrage existant</p><h2>Seuils d’alerte et de sécurité</h2><p className="inventory-note">Les seuils sont consultables ici. Leur modification reste réservée au rôle habilité de gestion des produits afin de respecter la séparation des tâches.</p><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Produit</th><th>Seuil sécurité</th><th>Seuil alerte</th><th>Stock actuel</th><th>État</th></tr></thead><tbody>{visibleProducts.map((item) => { const state = status(item); return <tr key={item.id}><td>{item.name}</td><td>{item.safety_threshold}</td><td>{item.alert_threshold}</td><td>{quantity(item)}</td><td><span className={state[1] ?? "inventory-status-normal"}>{state[0] ?? state}</span></td></tr>; })}</tbody></table></div></div></div>}
      {tab === "rapports" && <div className="inventory-content"><div className="inventory-card inventory-hero-card"><p className="inventory-eyebrow">Audit et historique</p><h2>Rapports d’inventaire</h2><p>Les rapports utiliseront les sessions clôturées, la valorisation d’achat et les écarts validés. Aucun chiffre de fiabilité ou de rotation n’est affiché avant qu’une source réelle ne soit disponible.</p><button type="button" className="inventory-primary" disabled>Exporter après clôture d’un inventaire</button></div></div>}
    </>}
  </section>;
}
