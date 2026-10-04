/* Maquette prisedecommande: terminal de vente clair, catalogue tenant réel, panier latéral, sélection tactile de quantité et actions sans données inventées. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Company = { id: string; name: string };
type Category = { id: string; tenant_id: string; name: string };
type Product = { id: string; name: string; price: number; current_stock: number; product_type: string; category_id: string | null };
type CartLine = Product & { quantity: number };

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
  const [message, setMessage] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState("");

  // Modal de sélection de quantité tactile
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingQty, setPendingQty] = useState<number>(1);

  useEffect(() => {
    let active = true;
    fetch("/api/companies")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger les établissements.");
        if (!active) return;
        const list = result.companies ?? [];
        setCompanies(list);
        if (list[0]) setTenantId(list[0].id);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger les établissements."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([fetch(`/api/products?tenantId=${encodeURIComponent(tenantId)}`), fetch("/api/categories")])
      .then(async ([productsResponse, categoriesResponse]) => {
        const productsResult = await productsResponse.json();
        const categoriesResult = await categoriesResponse.json();
        if (!productsResponse.ok) throw new Error(productsResult.error ?? "Impossible de charger le catalogue.");
        if (!categoriesResponse.ok) throw new Error(categoriesResult.error ?? "Impossible de charger les catégories.");
        if (!active) return;
        setProducts(productsResult.products ?? []);
        setCategories((categoriesResult.categories ?? []).filter((category: Category) => category.tenant_id === tenantId));
        setCart([]);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger le catalogue."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tenantId]);

  const visibleProducts = useMemo(
    () => (activeCategory === "all" ? products : products.filter((product) => product.category_id === activeCategory)),
    [activeCategory, products]
  );
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  function openQuantityModal(product: Product) {
    setPendingProduct(product);
    setPendingQty(1);
  }

  function confirmAddProduct(product: Product, qty: number) {
    const validQty = Math.max(1, Math.floor(qty));
    setMessage("");
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        return current.map((line) => (line.id === product.id ? { ...line, quantity: line.quantity + validQty } : line));
      }
      return [...current, { ...product, quantity: validQty }];
    });
    setPendingProduct(null);
    setPendingQty(1);
  }

  function changeQuantity(id: string, amount: number) {
    setCart((current) =>
      current.flatMap((line) =>
        line.id === id ? (line.quantity + amount > 0 ? [{ ...line, quantity: line.quantity + amount }] : []) : [line]
      )
    );
  }

  function setDirectQuantity(id: string, qty: number) {
    if (qty <= 0) {
      setCart((current) => current.filter((line) => line.id !== id));
      return;
    }
    setCart((current) => current.map((line) => (line.id === id ? { ...line, quantity: qty } : line)));
  }

  async function submitOrder() {
    if (!tenantId || !cart.length) return;
    setError("");
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          tableLabel,
          lines: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer la commande.");
      setCart([]);
      setTableLabel("");
      setCreatedOrderId(result.order?.id ?? "");
      setMessage(`Commande ${result.order?.order_number ?? "enregistrée"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la commande.");
    } finally {
      setPending(false);
    }
  }

  if (loading && !products.length) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-sm font-bold text-[var(--muted)]">
        Chargement du catalogue…
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Prise de commande</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--primary)]">Composez la commande</h1>
            </div>
            {companies.length > 1 && (
              <select
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                className="h-11 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold text-[var(--primary)]"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {(error || message) && (
            <div
              className={`mt-5 rounded-lg px-4 py-3 text-sm font-bold ${
                error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"
              }`}
            >
              <p role={error ? "alert" : "status"}>{error || message}</p>
              {createdOrderId && !error && (
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/payment?orderId=${encodeURIComponent(createdOrderId)}`)}
                  className="mt-3 text-xs font-black underline underline-offset-4"
                >
                  Ouvrir le paiement de cette commande →
                </button>
              )}
            </div>
          )}

          {!companies.length ? (
            <div className="mt-10 rounded-lg border border-dashed border-[var(--line)] p-8 text-center">
              <p className="font-black text-[var(--primary)]">Aucun établissement disponible</p>
              <p className="mt-2 text-sm text-[var(--muted)]">Créez d’abord une boutique pour ouvrir la prise de commande.</p>
              <Link
                href="/creationboutique"
                className="mt-5 inline-flex rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-white"
              >
                Créer une boutique
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black ${
                    activeCategory === "all" ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--muted)]"
                  }`}
                >
                  Tout
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black ${
                      activeCategory === category.id
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--muted)]"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {visibleProducts.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => openQuantityModal(product)}
                      className="rounded-lg border border-[var(--line)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-[0_14px_28px_-24px_var(--primary)] active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-black text-[var(--primary)]">{product.name}</span>
                        <span className="text-xs font-black text-[var(--secondary)]">＋</span>
                      </div>
                      <p className="mt-5 text-lg font-black text-[var(--primary)]">{money(product.price)}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Stock : {product.current_stock}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
                  Aucun produit disponible dans cette catégorie.
                </div>
              )}
            </>
          )}
        </section>

        {/* Panier latéral */}
        <aside className="h-fit rounded-xl bg-[var(--primary)] p-5 text-white shadow-[0_20px_45px_-28px_var(--primary)] xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-white/15 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Commande en cours</p>
              <p className="mt-2 text-xl font-black">Panier</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
              {cart.reduce((sum, line) => sum + line.quantity, 0)} article(s)
            </span>
          </div>

          <label className="mt-6 block text-sm font-bold text-white/80">
            Table ou repère
            <input
              value={tableLabel}
              onChange={(event) => setTableLabel(event.target.value)}
              placeholder="Ex. Table 4"
              className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-[var(--secondary-container)]"
            />
          </label>

          <div className="mt-6 space-y-3">
            {cart.length ? (
              cart.map((line) => (
                <div key={line.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{line.name}</p>
                    <p className="mt-1 text-xs text-white/55">
                      {money(line.price)} × {line.quantity} = {money(line.price * line.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.id, -1)}
                      className="h-7 w-7 rounded bg-white/10 text-sm font-black hover:bg-white/20 active:scale-95"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={line.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setDirectQuantity(line.id, isNaN(val) || val < 1 ? 1 : val);
                      }}
                      className="w-8 text-center text-sm font-black bg-white/10 rounded h-7 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.id, 1)}
                      className="h-7 w-7 rounded bg-white/10 text-sm font-black hover:bg-white/20 active:scale-95"
                    >
                      ＋
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-white/20 p-5 text-sm leading-6 text-white/60">
                Sélectionnez un produit pour commencer.
              </p>
            )}
          </div>

          <div className="mt-7 flex items-end justify-between border-t border-white/15 pt-5">
            <span className="text-sm font-bold text-white/65">Total</span>
            <span className="text-2xl font-black">{money(total)}</span>
          </div>

          <button
            disabled={!cart.length || pending}
            onClick={submitOrder}
            className="mt-6 h-12 w-full rounded-lg bg-[var(--secondary-container)] text-sm font-black text-[var(--primary)] transition hover:bg-[#ffd478] disabled:cursor-not-allowed disabled:opacity-45 shadow-sm"
          >
            {pending ? "Enregistrement…" : "Envoyer la commande →"}
          </button>
          <Link
            href="/dashboard/payment"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-lg border border-white/20 text-sm font-black text-white transition hover:bg-white/10"
          >
            Passer au paiement
          </Link>
        </aside>
      </div>

      {/* Modal Tactile de Choix de Quantité */}
      {pendingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Quantité pour ${pendingProduct.name}`}
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl border border-[var(--line)] text-[var(--primary)]">
            {/* Entête */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--secondary)]">
                  Article sélectionné
                </span>
                <h3 className="text-lg font-black">{pendingProduct.name}</h3>
                <p className="text-xs font-bold text-[var(--muted)]">{money(pendingProduct.price)} l’unité</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingProduct(null)}
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--background)] transition"
              >
                ✕
              </button>
            </div>

            {/* Stepper tactile & Entrée manuelle */}
            <div className="mt-5 space-y-4">
              <label className="text-xs font-black uppercase tracking-wider text-[var(--muted)] block">
                Quantité à ajouter :
              </label>

              <div className="flex items-center justify-center gap-4 bg-[var(--background)] rounded-2xl p-3 border border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setPendingQty((q) => Math.max(1, q - 1))}
                  disabled={pendingQty <= 1}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface)] text-xl font-black shadow-sm border border-[var(--line)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  −
                </button>

                <input
                  type="number"
                  min="1"
                  max="999"
                  value={pendingQty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setPendingQty(isNaN(val) || val < 1 ? 1 : val);
                  }}
                  className="w-24 text-center text-3xl font-black bg-transparent focus:outline-none"
                  aria-label="Quantité"
                />

                <button
                  type="button"
                  onClick={() => setPendingQty((q) => q + 1)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface)] text-xl font-black shadow-sm border border-[var(--line)] active:scale-95 transition"
                >
                  ＋
                </button>
              </div>

              {/* Raccourcis de quantité rapide */}
              <div>
                <p className="text-[11px] font-bold text-[var(--muted)] mb-1.5">Raccourcis rapides :</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 10, 12].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPendingQty(preset)}
                      className={`py-2 rounded-xl text-xs font-black transition active:scale-95 ${
                        pendingQty === preset
                          ? "bg-[var(--primary)] text-white shadow-sm"
                          : "bg-[var(--background)] text-[var(--primary)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calcul en direct */}
              <div className="rounded-xl bg-[var(--accent-soft)] p-3 flex items-center justify-between text-xs font-bold text-[var(--primary)]">
                <span>Total pour cet article :</span>
                <span className="text-base font-black">{money(pendingProduct.price * pendingQty)}</span>
              </div>
            </div>

            {/* Boutons d'Action */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingProduct(null)}
                className="flex-1 py-3 rounded-xl border border-[var(--line)] text-xs font-black hover:bg-[var(--background)] active:scale-95 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => confirmAddProduct(pendingProduct, pendingQty)}
                className="flex-2 py-3 px-4 rounded-xl bg-[var(--primary)] text-xs font-black text-white hover:opacity-95 active:scale-95 transition shadow-md"
              >
                Ajouter {pendingQty} au panier →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
