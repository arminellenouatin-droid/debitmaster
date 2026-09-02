"use client";

/* Design DebitManager Inventaire: atelier de contrôle clair, KPI réels, tableaux d’audit, ambre réservé aux alertes et aucune donnée simulée. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

type Product = { id: string; name: string; stock_family: "BEVERAGE" | "KITCHEN"; unit: string | null; price: number; current_stock: number; alert_threshold: number; safety_threshold: number; weighted_purchase_price: number | null; stock_value: number | null; category_name?: string | null };
type Store = { id: string; name: string; store_type: string; store_inventory?: { product_id: string; quantity: number; reserved_quantity?: number }[] };
type Purchase = { id: string; product_id: string; quantity: number; purchase_unit_price: number; purchased_at: string; invoice_number?: string | null; products?: { name: string } | null; inventory_stores?: { name: string } | null };
type Props = { tenantId: string; companyName: string; firstName: string };
type Tab = "dashboard" | "stocks" | "mouvements" | "inventaires" | "ecarts" | "seuils" | "rapports";

const tabs: Array<[Tab, string]> = [["dashboard", "Dashboard"], ["stocks", "Vue des stocks"], ["mouvements", "Mouvements"], ["inventaires", "Inventaire physique"], ["ecarts", "Écarts"], ["seuils", "Seuils & alertes"], ["rapports", "Rapports"]];
const money = (value: number) => `${Math.round(value).toLocaleString("fr-FR")} XOF`;
const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function InventoryManagerClient({ tenantId, companyName, firstName }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<"ALL" | "BEVERAGE" | "KITCHEN">("ALL");

  async function load() {
    if (!tenantId) return;
    setError("");
    const requests = await Promise.all([
      fetch(`/api/stock?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      fetch(`/api/stock/stores?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      fetch(`/api/stock/purchases?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
    ]);
    const results = await Promise.all(requests.map((response) => response.json()));
    const failed = requests.findIndex((response) => !response.ok);
    if (failed >= 0) throw new Error(results[failed].error ?? "Impossible de charger la situation des stocks.");
    setProducts(results[0].stock ?? []); setStores(results[1].stores ?? []); setPurchases(results[2].purchases ?? []);
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
  const status = (item: Product) => quantity(item) <= Number(item.safety_threshold || 0) ? ["Critique", "inventory-status-critical"] : quantity(item) <= Number(item.alert_threshold || 0) ? ["Alerte", "inventory-status-alert"] : "Normal";

  return <section className="inventory-workspace"><header className="inventory-header"><div><p className="inventory-eyebrow">Contrôle des stocks · {companyName}</p><h1>Bonjour {firstName}, gardez une vue exacte.</h1><p>Un espace séparé des ventes : constater, comparer, justifier et soumettre. La validation finale appartient au Propriétaire.</p></div><Link href="/dashboard" className="inventory-return">Retour au tableau de bord</Link></header>
    <nav className="inventory-tabs" aria-label="Navigation inventaire">{tabs.map(([key, label]) => <button type="button" key={key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {error && <div className="inventory-alert" role="alert">{error}<button type="button" onClick={() => void load()}>Réessayer</button></div>}
    {loading ? <div className="inventory-loading">Chargement des données réelles du tenant…</div> : <>
      {tab === "dashboard" && <div className="inventory-content"><div className="inventory-kpis"><article><span>Valeur théorique</span><strong>{money(totalValue)}</strong><small>Prix d’achat pondéré disponible</small></article><article><span>Articles en alerte</span><strong>{alertProducts.length}</strong><small>{criticalProducts.length} critique(s)</small></article><article><span>Produits suivis</span><strong>{products.length}</strong><small>{reserved} unité(s) réservée(s)</small></article><article><span>Dernières entrées</span><strong>{purchases.length}</strong><small>Historique disponible</small></article></div><div className="inventory-grid-two"><section className="inventory-card"><div className="inventory-card-heading"><div><p className="inventory-eyebrow">Priorité opérationnelle</p><h2>À contrôler maintenant</h2></div><button type="button" onClick={() => setTab("stocks")}>Voir le stock →</button></div>{alertProducts.length ? <div className="inventory-list">{alertProducts.slice(0, 8).map((item) => <div className="inventory-list-row" key={item.id}><div><strong>{item.name}</strong><span>{item.stock_family === "BEVERAGE" ? "Boisson" : "Cuisine"} · seuil {item.alert_threshold}</span></div><b className={status(item)[1] ?? "inventory-status-normal"}>{quantity(item)} {item.unit || "unités"}</b></div>)}</div> : <div className="inventory-empty"><strong>Aucune alerte active</strong><span>Les produits seront signalés dès qu’ils atteindront leur seuil.</span></div>}</section><section className="inventory-card"><div className="inventory-card-heading"><div><p className="inventory-eyebrow">Formule de référence</p><h2>Calcul traçable</h2></div></div><div className="inventory-formula"><span>Stock initial</span><b>+</b><span>Achats</span><b>−</b><span>Sorties</span><b>=</b><strong>Stock théorique</strong></div><p className="inventory-note">Les ventes, pertes, casses et transferts sont suivis dans les mouvements. Le responsable inventaire ne modifie pas les historiques.</p></section></div><section className="inventory-card"><div className="inventory-card-heading"><div><p className="inventory-eyebrow">Journal récent</p><h2>Dernières entrées de stock</h2></div><button type="button" onClick={() => setTab("mouvements")}>Tout l’historique →</button></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Date</th><th>Produit</th><th>Magasin</th><th>Quantité</th><th>Valeur</th></tr></thead><tbody>{recentPurchases.map((purchase) => <tr key={purchase.id}><td>{date(purchase.purchased_at)}</td><td>{purchase.products?.name ?? "Produit"}</td><td>{purchase.inventory_stores?.name ?? "—"}</td><td>+{purchase.quantity}</td><td>{money(purchase.quantity * purchase.purchase_unit_price)}</td></tr>)}</tbody></table></div></section></div>}
      {tab === "stocks" && <div className="inventory-content"><div className="inventory-toolbar"><div><p className="inventory-eyebrow">Vue par produit</p><h2>Situation des stocks</h2></div><div className="inventory-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher sans accent…" aria-label="Rechercher un produit" /><select value={family} onChange={(event) => setFamily(event.target.value as typeof family)}><option value="ALL">Toutes les familles</option><option value="BEVERAGE">Boissons</option><option value="KITCHEN">Cuisine</option></select></div></div><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Produit</th><th>Famille</th><th>Stock théorique</th><th>Prix achat</th><th>Valeur stock</th><th>Seuils</th><th>État</th></tr></thead><tbody>{visibleProducts.map((item) => { const state = status(item); return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.unit || "unité"}</small></td><td>{item.stock_family === "BEVERAGE" ? "Boissons" : "Cuisine"}</td><td>{quantity(item)}</td><td>{item.weighted_purchase_price == null ? "—" : money(item.weighted_purchase_price)}</td><td>{item.stock_value == null ? "—" : money(item.stock_value)}</td><td>{item.safety_threshold} / {item.alert_threshold}</td><td><span className={state[1] ?? "inventory-status-normal"}>{state[0] ?? state}</span></td></tr>; })}</tbody></table></div></div>}
      {tab === "mouvements" && <div className="inventory-content"><div className="inventory-card"><p className="inventory-eyebrow">Journal détaillé</p><h2>Mouvements disponibles</h2><p className="inventory-note">Les entrées d’achat et les transferts actuellement accessibles sont affichés ici. Les ventes et pertes seront raccordées au journal consolidé dans l’étape d’audit suivante.</p><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Quantité</th><th>Prix unitaire</th><th>Référence</th></tr></thead><tbody>{recentPurchases.map((purchase) => <tr key={purchase.id}><td>{date(purchase.purchased_at)}</td><td><span className="inventory-status-normal">Entrée achat</span></td><td>{purchase.products?.name ?? "Produit"}</td><td>+{purchase.quantity}</td><td>{money(purchase.purchase_unit_price)}</td><td>{purchase.invoice_number ?? purchase.id.slice(0, 8)}</td></tr>)}</tbody></table></div></div></div>}
      {tab === "inventaires" && <div className="inventory-content"><div className="inventory-card inventory-hero-card"><p className="inventory-eyebrow">Comptage physique</p><h2>Préparer un inventaire sans biais.</h2><p>Le workflow persistant sera activé avec les sessions de comptage, les lignes par produit, les justifications d’écart et la signature finale du Propriétaire. La structure de l’interface est prête pour recevoir ce flux sans exposer le stock théorique pendant le comptage aveugle.</p><button type="button" className="inventory-primary" disabled>Nouvel inventaire · préparation technique</button></div></div>}
      {tab === "ecarts" && <div className="inventory-content"><div className="inventory-card inventory-hero-card"><p className="inventory-eyebrow">Écarts</p><h2>Comparer le physique au théorique.</h2><p>Aucun écart physique n’est inventé. Dès qu’une session de comptage sera clôturée par le Propriétaire, cette vue affichera les manquants, excédents, causes, statuts et régularisations.</p><button type="button" className="inventory-primary" disabled>Écarts après le premier inventaire</button></div></div>}
      {tab === "seuils" && <div className="inventory-content"><div className="inventory-card"><p className="inventory-eyebrow">Paramétrage existant</p><h2>Seuils d’alerte et de sécurité</h2><p className="inventory-note">Les seuils sont consultables ici. Leur modification reste réservée au rôle habilité de gestion des produits afin de respecter la séparation des tâches.</p><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Produit</th><th>Seuil sécurité</th><th>Seuil alerte</th><th>Stock actuel</th><th>État</th></tr></thead><tbody>{visibleProducts.map((item) => { const state = status(item); return <tr key={item.id}><td>{item.name}</td><td>{item.safety_threshold}</td><td>{item.alert_threshold}</td><td>{quantity(item)}</td><td><span className={state[1] ?? "inventory-status-normal"}>{state[0] ?? state}</span></td></tr>; })}</tbody></table></div></div></div>}
      {tab === "rapports" && <div className="inventory-content"><div className="inventory-card inventory-hero-card"><p className="inventory-eyebrow">Audit et historique</p><h2>Rapports d’inventaire</h2><p>Les rapports utiliseront les sessions clôturées, la valorisation d’achat et les écarts validés. Aucun chiffre de fiabilité ou de rotation n’est affiché avant qu’une source réelle ne soit disponible.</p><button type="button" className="inventory-primary" disabled>Exporter après clôture d’un inventaire</button></div></div>}
    </>}
  </section>;
}
