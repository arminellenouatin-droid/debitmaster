/* Maquette prisedecommande: terminal de vente clair, catalogue tenant réel, panier latéral et actions tactiles sans données inventées. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Company = { id: string; name: string };
type Category = { id: string; tenant_id: string; name: string };
type Product = { id: string; name: string; price: number; current_stock: number; product_type: string; stock_family?: string; category_id: string | null };
type CartLine = Product & {
  quantity: number;
  offeredAccompanimentProductId: string | null;
  offeredAccompanimentQuantity: number;
  purchasedAccompanimentProductId: string | null;
  purchasedAccompanimentQuantity: number;
};

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;

export function OrdersClient({ initialTableLabel = "" }: { initialTableLabel?: string }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [tableLabel, setTableLabel] = useState(initialTableLabel);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(""); const [createdOrderId, setCreatedOrderId] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/companies").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les établissements.");
      if (!active) return;
      const list = result.companies ?? [];
      setCompanies(list);
      if (list[0]) setTenantId(list[0].id);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger les établissements.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    setLoading(true); setError("");
    Promise.all([fetch(`/api/products?tenantId=${encodeURIComponent(tenantId)}`), fetch("/api/categories")]).then(async ([productsResponse, categoriesResponse]) => {
      const productsResult = await productsResponse.json();
      const categoriesResult = await categoriesResponse.json();
      if (!productsResponse.ok) throw new Error(productsResult.error ?? "Impossible de charger le catalogue.");
      if (!categoriesResponse.ok) throw new Error(categoriesResult.error ?? "Impossible de charger les catégories.");
      if (!active) return;
      setProducts(productsResult.products ?? []);
      setCategories((categoriesResult.categories ?? []).filter((category: Category) => category.tenant_id === tenantId));
      setCart([]);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger le catalogue.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [tenantId]);

  const visibleProducts = useMemo(() => activeCategory === "all" ? products : products.filter((product) => product.category_id === activeCategory), [activeCategory, products]);
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name.toLocaleLowerCase("fr-FR")])), [categories]);
  const accompaniments = useMemo(() => products.filter((product) => product.stock_family === "KITCHEN" && (categoryNames.get(product.category_id ?? "") ?? "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").includes("accompagnement")), [categoryNames, products]);
  const isMeal = (product: Product) => product.stock_family === "KITCHEN" || /meal|food|repas/i.test(product.product_type);
  const lineTotal = (line: CartLine) => line.price * line.quantity + (line.purchasedAccompanimentProductId ? (products.find((product) => product.id === line.purchasedAccompanimentProductId)?.price ?? 0) * line.purchasedAccompanimentQuantity * line.quantity : 0);
  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);

  function addProduct(product: Product) {
    setMessage(""); setCart((current) => { const existing = current.find((line) => line.id === product.id); if (existing) return current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line); return [...current, { ...product, quantity: 1, offeredAccompanimentProductId: null, offeredAccompanimentQuantity: 0, purchasedAccompanimentProductId: null, purchasedAccompanimentQuantity: 0 }]; });
  }
  function changeQuantity(id: string, amount: number) { setCart((current) => current.flatMap((line) => line.id === id ? (line.quantity + amount > 0 ? [{ ...line, quantity: line.quantity + amount }] : []) : [line])); }
  function updateAccompaniment(lineId: string, kind: "offered" | "purchased", value: string) {
    setCart((current) => current.map((line) => {
      if (line.id !== lineId) return line;
      if (kind === "offered") return value === "" ? { ...line, offeredAccompanimentProductId: null, offeredAccompanimentQuantity: 0 } : { ...line, offeredAccompanimentProductId: value };
      return value === "" ? { ...line, purchasedAccompanimentProductId: null, purchasedAccompanimentQuantity: 0 } : { ...line, purchasedAccompanimentProductId: value };
    }));
  }
  function updateAccompanimentQuantity(lineId: string, kind: "offered" | "purchased", quantity: number) {
    setCart((current) => current.map((line) => line.id !== lineId ? line : kind === "offered" ? { ...line, offeredAccompanimentQuantity: quantity, offeredAccompanimentProductId: quantity ? line.offeredAccompanimentProductId : null } : { ...line, purchasedAccompanimentQuantity: quantity, purchasedAccompanimentProductId: quantity ? line.purchasedAccompanimentProductId : null }));
  }
  async function submitOrder() {
    if (!tenantId || !cart.length) return;
    setError(""); setMessage(""); setPending(true);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, tableLabel, lines: cart.map((line) => ({ productId: line.id, quantity: line.quantity, fulfillmentUnit: isMeal(line) ? "MEAL" : "BEVERAGE", offeredAccompanimentProductId: line.offeredAccompanimentProductId, offeredAccompanimentQuantity: line.offeredAccompanimentQuantity, purchasedAccompanimentProductId: line.purchasedAccompanimentProductId, purchasedAccompanimentQuantity: line.purchasedAccompanimentQuantity })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer la commande.");
      setCart([]); setTableLabel(""); setCreatedOrderId(result.order?.id ?? ""); setMessage(`Commande ${result.order?.order_number ?? "enregistrée"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la commande."); } finally { setPending(false); }
  }

  if (loading && !products.length) return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-sm font-bold text-[var(--muted)]">Chargement du catalogue…</div>;
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Prise de commande</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--primary)]">Composez la commande</h1></div>{companies.length > 1 && <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="h-11 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold text-[var(--primary)]">{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>}</div>{(error || message) && <div className={`mt-5 rounded-lg px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}><p role={error ? "alert" : "status"}>{error || message}</p>{createdOrderId && !error && <button type="button" onClick={() => router.push(`/dashboard/payment?orderId=${encodeURIComponent(createdOrderId)}`)} className="mt-3 text-xs font-black underline underline-offset-4">Ouvrir le paiement de cette commande →</button>}</div>}{!companies.length ? <div className="mt-10 rounded-lg border border-dashed border-[var(--line)] p-8 text-center"><p className="font-black text-[var(--primary)]">Aucun établissement disponible</p><p className="mt-2 text-sm text-[var(--muted)]">Créez d’abord une boutique pour ouvrir la prise de commande.</p><Link href="/creationboutique" className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-white">Créer une boutique</Link></div> : <><div className="mt-7 flex gap-2 overflow-x-auto pb-2"><button onClick={() => setActiveCategory("all")} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black ${activeCategory === "all" ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--muted)]"}`}>Tout</button>{categories.map((category) => <button key={category.id} onClick={() => setActiveCategory(category.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black ${activeCategory === category.id ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--muted)]"}`}>{category.name}</button>)}</div>{visibleProducts.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)} className="rounded-lg border border-[var(--line)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-[0_14px_28px_-24px_var(--primary)]"><div className="flex items-start justify-between gap-3"><span className="font-black text-[var(--primary)]">{product.name}</span><span className="text-xs font-black text-[var(--secondary)]">＋</span></div><p className="mt-5 text-lg font-black text-[var(--primary)]">{money(product.price)}</p><p className="mt-1 text-xs text-[var(--muted)]">Stock : {product.current_stock}</p></button>)}</div> : <div className="mt-6 rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">Aucun produit disponible dans cette catégorie.</div>}</>}</section><aside className="h-fit rounded-xl bg-[var(--primary)] p-5 text-white shadow-[0_20px_45px_-28px_var(--primary)] xl:sticky xl:top-24"><div className="flex items-center justify-between border-b border-white/15 pb-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Commande en cours</p><p className="mt-2 text-xl font-black">Panier</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">{cart.reduce((sum, line) => sum + line.quantity, 0)} article(s)</span></div><label className="mt-6 block text-sm font-bold text-white/80">Table ou repère<input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} placeholder="Ex. Table 4" className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-[var(--secondary-container)]" /></label><div className="mt-6 space-y-4">{cart.length ? cart.map((line) => <div key={line.id} className="border-b border-white/10 pb-4 last:border-0"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{line.name}</p><p className="mt-1 text-xs text-white/55">{money(lineTotal(line))} · {line.quantity} unité(s)</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => changeQuantity(line.id, -1)} className="h-7 w-7 rounded bg-white/10 text-sm font-black">−</button><span className="w-5 text-center text-sm font-black">{line.quantity}</span><button type="button" onClick={() => changeQuantity(line.id, 1)} className="h-7 w-7 rounded bg-white/10 text-sm font-black">＋</button></div></div>{isMeal(line) && <div className="mt-3 grid gap-3 rounded-lg bg-white/5 p-3"><div><p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/65">Accompagnements du repas</p><p className="mt-1 text-[11px] text-white/50">L’offert est inclus ; l’acheté ajoute son prix au repas.</p></div><label className="grid grid-cols-[1fr_72px] items-center gap-2 text-xs font-bold text-white/80">Accompagnement offert<select value={line.offeredAccompanimentProductId ?? ""} onChange={(event) => updateAccompaniment(line.id, "offered", event.target.value)} className="h-9 rounded border border-white/15 bg-white/10 px-2 text-xs text-white"><option value="" className="text-[var(--ink)]">Aucun</option>{accompaniments.map((item) => <option key={item.id} value={item.id} className="text-[var(--ink)]">{item.name}</option>)}</select><span /> <select aria-label="Nombre d’accompagnements offerts" value={line.offeredAccompanimentQuantity} onChange={(event) => updateAccompanimentQuantity(line.id, "offered", Number(event.target.value))} className="h-9 rounded border border-white/15 bg-white/10 px-2 text-xs text-white">{Array.from({ length: 11 }, (_, index) => <option key={index} value={index} className="text-[var(--ink)]">{index}</option>)}</select></label><label className="grid grid-cols-[1fr_72px] items-center gap-2 text-xs font-bold text-white/80">Accompagnement acheté<select value={line.purchasedAccompanimentProductId ?? ""} onChange={(event) => updateAccompaniment(line.id, "purchased", event.target.value)} className="h-9 rounded border border-white/15 bg-white/10 px-2 text-xs text-white"><option value="" className="text-[var(--ink)]">Aucun</option>{accompaniments.map((item) => <option key={item.id} value={item.id} className="text-[var(--ink)]">{item.name}</option>)}</select><span /> <select aria-label="Nombre d’accompagnements achetés" value={line.purchasedAccompanimentQuantity} onChange={(event) => updateAccompanimentQuantity(line.id, "purchased", Number(event.target.value))} className="h-9 rounded border border-white/15 bg-white/10 px-2 text-xs text-white">{Array.from({ length: 11 }, (_, index) => <option key={index} value={index} className="text-[var(--ink)]">{index}</option>)}</select></label></div>}</div>) : <p className="rounded-lg border border-dashed border-white/20 p-5 text-sm leading-6 text-white/60">Sélectionnez un produit pour commencer.</p>}</div><div className="mt-7 flex items-end justify-between border-t border-white/15 pt-5"><span className="text-sm font-bold text-white/65">Total</span><span className="text-2xl font-black">{money(total)}</span></div><button disabled={!cart.length || pending} onClick={submitOrder} className="mt-6 h-12 w-full rounded-lg bg-[var(--secondary-container)] text-sm font-black text-[var(--primary)] transition hover:bg-[#ffd478] disabled:cursor-not-allowed disabled:opacity-45">{pending ? "Enregistrement…" : "Envoyer la commande →"}</button><Link href="/dashboard/payment" className="mt-3 flex h-11 w-full items-center justify-center rounded-lg border border-white/20 text-sm font-black text-white transition hover:bg-white/10">Passer au paiement</Link></aside></div>;
}
