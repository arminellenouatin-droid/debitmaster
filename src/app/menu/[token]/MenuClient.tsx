// Menu QR public, Design Read: lounge sombre, ambre comme signal d’action, listes horizontales mobiles, panier accessible en permanence et états explicites.
"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; description?: string | null; price: number; stock_family: "BEVERAGE" | "KITCHEN"; unit?: string | null; packaging_label?: string | null; category_id?: string | null };
type Category = { id: string; name: string; parent_id: string | null };
type MenuData = { company: { id: string; name: string }; table: { id: string; label: string; zone: string | null }; products: Product[]; categories: Category[] };
type CartLine = { product: Product; quantity: number };
type PendingPayment = { id: string; amount: number; referenceId?: string; status?: string };

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;

export function MenuClient({ token }: { token: string }) {
  const [data, setData] = useState<MenuData | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<"ALL" | "BEVERAGE" | "KITCHEN">("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/menu/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Le menu est indisponible.");
        if (active) setData(result);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Le menu est indisponible."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  const categoryMap = useMemo(() => new Map((data?.categories ?? []).map((category) => [category.id, category.name])), [data?.categories]);
  const categories = useMemo(() => {
    const visible = (data?.products ?? []).filter((product) => selectedFamily === "ALL" || product.stock_family === selectedFamily);
    const ids = [...new Set(visible.map((product) => product.category_id).filter(Boolean))] as string[];
    return ids.map((id) => ({ id, name: categoryMap.get(id) ?? "Autres" }));
  }, [categoryMap, data?.products, selectedFamily]);
  const products = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");
    return (data?.products ?? []).filter((product) => {
      const familyMatch = selectedFamily === "ALL" || product.stock_family === selectedFamily;
      const categoryMatch = selectedCategory === "ALL" || product.category_id === selectedCategory;
      const searchMatch = !query || product.name.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      return familyMatch && categoryMatch && searchMatch;
    });
  }, [data?.products, search, selectedCategory, selectedFamily]);
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function add(product: Product) {
    setSuccess("");
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      return found ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }];
    });
  }
  function change(productId: string, delta: number) {
    setCart((current) => current.flatMap((line) => line.product.id !== productId ? [line] : line.quantity + delta > 0 ? [{ ...line, quantity: line.quantity + delta }] : []));
  }
  async function submitOrder() {
    if (!cart.length) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/public/menu/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })), customerName, note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’envoyer la commande.");
      setSuccess(result.message ?? "Commande envoyée."); setCart([]); setCartOpen(true); setNote(""); setPendingPayment({ id: result.order.id, amount: Number(result.order.total_amount), status: "ORDERED" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’envoyer la commande.");
    } finally { setSubmitting(false); }
  }

  async function startPayment() {
    if (!pendingPayment || !paymentPhone.trim()) return;
    setPaymentBusy(true); setError("");
    try {
      const response = await fetch(`/api/public/menu/${encodeURIComponent(token)}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: pendingPayment.id, amount: pendingPayment.amount, mobileNumber: paymentPhone.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’initier le paiement.");
      setPendingPayment((current) => current ? { ...current, referenceId: result.referenceId, status: result.status } : current);
      setSuccess("Paiement initié. Validez la demande sur votre téléphone, puis attendez la confirmation.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’initier le paiement.");
    } finally { setPaymentBusy(false); }
  }

  if (loading) return <main className="qr-page qr-state"><div className="qr-spinner" aria-hidden="true" /><p>Préparation du menu…</p></main>;
  if (error && !data) return <main className="qr-page qr-state"><div className="qr-mark">!</div><h1>Menu indisponible</h1><p>{error}</p><button className="qr-button" onClick={() => window.location.reload()}>Réessayer</button></main>;
  if (!data) return null;

  return <main className="qr-page">
    <div className="qr-marquee">Bienvenue chez {data.company.name}. Commandez depuis votre table, nous préparons et vous servons.</div>
    <header className="qr-header"><div className="qr-brand"><span className="qr-brand-icon" aria-hidden="true">✦</span><span>{data.company.name}</span></div><button className="qr-cart-button" onClick={() => setCartOpen(true)} aria-label={`Ouvrir le panier, ${itemCount} article(s)`}>Panier <strong>{itemCount}</strong></button></header>
    <section className="qr-hero"><div className="qr-hero-glow" aria-hidden="true" /><div className="qr-hero-copy"><p className="qr-kicker">Table {data.table.label}{data.table.zone ? ` · ${data.table.zone}` : ""}</p><h1>Choisissez votre moment.</h1><p>Boissons fraîches, repas préparés et services de la maison, réunis au même endroit.</p><button className="qr-button qr-button-light" onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}>Voir le menu <span aria-hidden="true">↓</span></button></div></section>
    <section id="menu" className="qr-menu-section"><div className="qr-section-heading"><div><p className="qr-kicker">Carte de la maison</p><h2>À votre rythme</h2></div><label className="qr-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un article" aria-label="Rechercher un article" /></label></div>
      <div className="qr-filters" role="tablist" aria-label="Familles du menu">{[["ALL", "Tout"], ["BEVERAGE", "Boissons"], ["KITCHEN", "Repas"]].map(([key, label]) => <button key={key} role="tab" aria-selected={selectedFamily === key} className={selectedFamily === key ? "is-active" : ""} onClick={() => { setSelectedFamily(key as typeof selectedFamily); setSelectedCategory("ALL"); }}>{label}</button>)}{categories.map((category) => <button key={category.id} className={selectedCategory === category.id ? "is-active" : ""} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>)}</div>
      {error && <p className="qr-alert" role="alert">{error}</p>}{success && <p className="qr-success" role="status">{success}</p>}
      {products.length ? <div className="qr-product-list">{products.map((product) => <article className="qr-product" key={product.id}><div className={`qr-product-art ${product.stock_family === "KITCHEN" ? "meal" : "drink"}`} aria-hidden="true">{product.stock_family === "KITCHEN" ? "⌁" : "◒"}</div><div className="qr-product-body"><div className="qr-product-meta"><span>{product.stock_family === "KITCHEN" ? "Repas" : "Boisson"}</span>{product.packaging_label && <span>{product.packaging_label}</span>}</div><h3>{product.name}</h3><p>{product.description || (product.stock_family === "KITCHEN" ? "Préparé à la commande par notre cuisine." : "Servi frais à votre table.")}</p></div><div className="qr-product-action"><strong>{money(product.price)}</strong><button className="qr-add" onClick={() => add(product)} aria-label={`Ajouter ${product.name}`}>+</button></div></article>)}</div> : <div className="qr-empty"><h3>Aucun article ne correspond.</h3><p>Essayez une autre recherche ou revenez à toutes les catégories.</p></div>}
    </section>
    <footer className="qr-footer"><span>{data.company.name}</span><span>Table {data.table.label}</span><span>Commande au service</span></footer>
    {cartOpen && <div className="qr-overlay" role="presentation" onClick={() => setCartOpen(false)}><aside className="qr-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={(event) => event.stopPropagation()}><div className="qr-drawer-head"><div><p className="qr-kicker">Table {data.table.label}</p><h2 id="cart-title">Votre commande</h2></div><button className="qr-close" onClick={() => setCartOpen(false)} aria-label="Fermer le panier">×</button></div>{pendingPayment ? <div className="qr-payment-panel"><div className="qr-mark">✓</div><h3>Commande envoyée</h3><p>{success || "Votre commande est arrivée au service."}</p><div className="qr-total"><span>Total de la commande</span><strong>{money(pendingPayment.amount)}</strong></div><label className="qr-form-label">Numéro Mobile Money<input value={paymentPhone} onChange={(event) => setPaymentPhone(event.target.value)} placeholder="Numéro du client" inputMode="tel" /></label><button className="qr-button qr-submit" disabled={paymentBusy || !paymentPhone.trim()} onClick={startPayment}>{paymentBusy ? "Initialisation…" : "Payer maintenant par Mobile Money"}</button><p className="qr-payment-note">Le montant sera confirmé par le service de paiement. La commande ne sera pas marquée payée avant confirmation.</p><button className="qr-button qr-button-light" onClick={() => { setPendingPayment(null); setCartOpen(false); }}>Payer plus tard</button></div> : cart.length ? <><div className="qr-cart-lines">{cart.map((line) => <div className="qr-cart-line" key={line.product.id}><div><strong>{line.product.name}</strong><span>{money(line.product.price)} l’unité</span></div><div className="qr-quantity"><button onClick={() => change(line.product.id, -1)} aria-label={`Retirer ${line.product.name}`}>−</button><span>{line.quantity}</span><button onClick={() => change(line.product.id, 1)} aria-label={`Ajouter ${line.product.name}`}>+</button></div></div>)}</div><div className="qr-form"><label>Votre nom <span>(facultatif)</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Pour vous reconnaître" /></label><label>Note pour le service <span>(facultatif)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex. peu sucré, sans glaçons…" rows={3} /></label></div><div className="qr-total"><span>Total à payer</span><strong>{money(total)}</strong></div><button className="qr-button qr-submit" disabled={submitting} onClick={submitOrder}>{submitting ? "Envoi en cours…" : "Envoyer la commande"}</button><p className="qr-payment-note">Le paiement sera confirmé avec le service au moment de la remise.</p></> : <div className="qr-empty"><div className="qr-mark">∅</div><h3>Votre panier est vide.</h3><p>Ajoutez vos boissons ou repas pour composer votre commande.</p><button className="qr-button" onClick={() => setCartOpen(false)}>Retourner au menu</button></div>}</aside></div>}
  </main>;
}
