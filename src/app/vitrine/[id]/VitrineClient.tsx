"use client";

import { useState } from "react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  availableStock: number;
  photoUrl: string | null;
  badge?: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  activityType: string;
  plan: string;
  address: string;
  city: string;
  country: string;
  currency: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function VitrineClient({
  company,
  products: initialProducts,
}: {
  company: CompanyInfo;
  products: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{
    reference: string;
    total: number;
  } | null>(null);
  const [orderError, setOrderError] = useState("");

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === "ALL" || p.category === selectedCategory;
    const matchSearch =
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product) {
    if (product.availableStock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.availableStock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.availableStock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0 || !customerName.trim() || !customerPhone.trim()) return;

    setOrderSubmitting(true);
    setOrderError("");

    try {
      const payload = {
        tenantId: company.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim() || "Retrait en magasin",
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          price: i.product.price,
        })),
      };

      const res = await fetch("/api/vitrine/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Impossible de valider la commande.");

      // Décrémenter localement le stock pour refléter l'action immédiate
      setProducts((prev) =>
        prev.map((p) => {
          const ordered = cart.find((c) => c.product.id === p.id);
          if (ordered) {
            return { ...p, availableStock: Math.max(0, p.availableStock - ordered.quantity) };
          }
          return p;
        })
      );

      setOrderSuccess({
        reference: data.orderReference,
        total: data.totalAmount,
      });
      setCart([]);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  const isCouture = company.activityType === "ATELIER_COUTURE";
  const formatPrice = (val: number) =>
    new Intl.NumberFormat("fr-FR").format(val) + " " + company.currency;

  return (
    <div className="min-h-screen bg-[#070d10] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Banner */}
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-[#070d10]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 font-black text-slate-950 shadow-lg shadow-amber-500/20">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white sm:text-lg">
                  {company.name}
                </h1>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400 ring-1 ring-emerald-500/30">
                  {isCouture ? "Haute Confection" : "Boutique Officielle"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {company.city}, {company.country} · {company.address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-amber-500"
            >
              <span>🛒 Panier</span>
              {cartItemCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-amber-400">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Showcase Section */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-[#0b1613] via-[#070d10] to-[#070d10] py-12 px-4 sm:px-6">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black tracking-wider uppercase text-amber-300">
            {isCouture ? "Atelier de Création & Mode" : "Vente Directe & Commerce"} · Stock en temps réel
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isCouture ? "Découvrez nos Collections & Créations" : "Tous nos Articles Disponibles en Magasin"}
          </h2>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Commandez en ligne en toute sécurité. Les articles réservés sont directement décrémentés de notre stock physique en temps réel.
          </p>

          {/* Search Bar */}
          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un article, un modèle, une référence..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-5 py-3.5 pl-12 text-sm text-white placeholder-slate-500 shadow-xl backdrop-blur-md outline-none focus:border-amber-400"
              />
              <span className="absolute left-4 top-3.5 text-base text-slate-400">🔍</span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-4 top-3.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          {categories.length > 1 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                  selectedCategory === "ALL"
                    ? "bg-amber-400 text-slate-950 font-black shadow"
                    : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                Tous les articles ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                    selectedCategory === cat
                      ? "bg-amber-400 text-slate-950 font-black shadow"
                      : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Product Catalog Grid */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <span className="text-4xl">📦</span>
            <h3 className="mt-3 text-lg font-bold text-white">Aucun article ne correspond à votre recherche</h3>
            <p className="mt-1 text-xs text-slate-400">Modifiez vos mots-clés ou sélectionnez une autre catégorie.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              const inStock = product.availableStock > 0;
              const cartItem = cart.find((i) => i.product.id === product.id);

              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition duration-200 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5"
                >
                  <div>
                    {/* Visual header */}
                    <div className="relative flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700/50">
                      {product.photoUrl ? <img src={product.photoUrl} alt={`Photo de ${product.name}`} className="h-full w-full rounded-xl object-cover" loading="lazy" /> : <span aria-hidden="true" className="text-5xl opacity-80 transition duration-200 group-hover:scale-110">{isCouture ? "👗" : "🛍"}</span>}
                      {product.badge && (
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
                          {product.badge}
                        </span>
                      )}
                      <span
                        className={`absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                          inStock
                            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                            : "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                        }`}
                      >
                        {inStock ? `En stock : ${product.availableStock}` : "Rupture de stock"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        {product.category}
                      </span>
                      <h3 className="mt-1 text-base font-black text-white group-hover:text-amber-300 transition">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-lg font-black text-white">
                        {formatPrice(product.price)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">Unité</span>
                    </div>

                    {inStock ? (
                      cartItem ? (
                        <div className="flex items-center justify-between rounded-xl bg-slate-800 p-1">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-sm font-black hover:bg-slate-600"
                          >
                            −
                          </button>
                          <span className="text-xs font-black text-amber-400">
                            {cartItem.quantity} dans le panier
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            disabled={cartItem.quantity >= product.availableStock}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-950 text-sm font-black disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-black text-slate-950 shadow-md transition hover:from-amber-400 hover:to-amber-500 active:scale-[0.98]"
                        >
                          Ajouter au panier
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="w-full rounded-xl border border-slate-800 bg-slate-800/40 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed"
                      >
                        Indisponible
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative flex h-full w-full max-w-md flex-col justify-between bg-slate-900 border-l border-slate-800 p-6 shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛒</span>
                  <h3 className="text-lg font-black text-white">Mon Panier</h3>
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-black text-amber-300">
                    {cartItemCount}
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  Votre panier est vide. Sélectionnez des articles dans le catalogue pour commander.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-slate-800">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white">{item.product.name}</h4>
                        <span className="text-xs text-amber-400 font-black">
                          {formatPrice(item.product.price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="h-6 w-6 rounded bg-slate-800 text-xs font-bold hover:bg-slate-700"
                        >
                          −
                        </button>
                        <span className="text-xs font-black">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          disabled={item.quantity >= item.product.availableStock}
                          className="h-6 w-6 rounded bg-slate-800 text-xs font-bold hover:bg-slate-700 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-6 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-400">Sous-total :</span>
                  <span className="text-xl font-black text-amber-400">{formatPrice(cartTotal)}</span>
                </div>

                {orderError && (
                  <p className="mb-3 rounded-lg bg-red-950/80 p-2 text-xs font-bold text-red-200 border border-red-700">
                    {orderError}
                  </p>
                )}

                <form onSubmit={handleCheckout} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300">Votre Nom Complet *</label>
                    <input
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex. Jean Koffi"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300">Numéro de Téléphone (MoMo / Appel) *</label>
                    <input
                      required
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ex. +229 97 00 00 00"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300">Adresse de livraison ou Retrait</label>
                    <input
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Quartier, repère ou 'Retrait boutique'"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={orderSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 text-xs font-black text-white shadow-lg shadow-emerald-900/50 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50"
                  >
                    {orderSubmitting ? "Validation & Décrémentation..." : "Confirmer la Commande Immédiate"}
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    🔒 Décrémentation automatique du stock physique en direct.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400">
              ✓
            </div>
            <h3 className="mt-4 text-xl font-black text-white">Commande Validée avec Succès !</h3>
            <p className="mt-1 text-xs text-slate-300">
              Votre commande a été transmise à <strong className="text-white">{company.name}</strong>. Le stock physique a été décrémenté immédiatement.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <span className="text-[10px] font-black uppercase text-slate-400">Référence de Commande</span>
              <p className="text-lg font-black text-amber-400">{orderSuccess.reference}</p>
              <div className="mt-2 border-t border-slate-800 pt-2 flex justify-between text-xs font-bold text-slate-300">
                <span>Montant total :</span>
                <span className="text-emerald-400">{formatPrice(orderSuccess.total)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setOrderSuccess(null);
                setIsCartOpen(false);
              }}
              className="mt-6 w-full rounded-xl bg-amber-400 py-3 text-xs font-black text-slate-950 hover:bg-amber-300"
            >
              Fermer et continuer mes achats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
