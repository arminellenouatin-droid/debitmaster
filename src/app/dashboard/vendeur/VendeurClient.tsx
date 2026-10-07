"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  current_stock: number;
  category_id: string | null;
  image_url: string | null;
  packaging_label?: string | null;
};

type Category = {
  id: string;
  name: string;
  parent_id?: string | null;
};

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  customer_type?: string;
};

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  discountPercent: number;
  taxRate: number;
  availableStock: number;
};

type Quote = {
  id: string;
  quote_number: string;
  quote_type: string;
  customer_name: string;
  customer_phone: string | null;
  total_amount: number;
  status: string;
  valid_until: string;
  created_at: string;
};

type Invoice = {
  id: string;
  order_number: string;
  table_label: string;
  total_amount: number;
  status: string;
  created_at: string;
  customers?: { full_name: string; phone: string | null } | null;
};

const money = (val: number) => `${Math.round(val || 0).toLocaleString("fr-FR")} FCFA`;

export function VendeurClient({
  tenantId,
  companyName,
  sellerName,
  isOwner,
}: {
  tenantId: string;
  companyName: string;
  sellerName: string;
  isOwner: boolean;
}) {
  const [tab, setTab] = useState<"pos" | "quotes" | "invoices">("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Filtres catalogue
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Panier
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [quoteType, setQuoteType] = useState<"STANDARD" | "PROFORMA">("STANDARD");
  const [validDays, setValidDays] = useState(15);
  const [notes, setNotes] = useState("");

  // Feedback & chargement
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);

  // Charger le catalogue et les clients
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [prodRes, custRes, catRes] = await Promise.all([
        fetch(`/api/products?tenantId=${tenantId}`, { cache: "no-store" }),
        fetch(`/api/customers?tenantId=${tenantId}`, { cache: "no-store" }),
        fetch(`/api/categories?tenantId=${tenantId}`, { cache: "no-store" }),
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products ?? []);
      }
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.customers ?? []);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories ?? []);
      }
    } catch {
      // Erreur réseau silencieuse
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Charger les devis
  const loadQuotes = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/commerce/quotes?tenantId=${tenantId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setQuotes(data.quotes ?? []);
      }
    } catch {
      // Ignorer
    }
  }, [tenantId]);

  // Charger les factures
  const loadInvoices = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/commerce/invoices?tenantId=${tenantId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices ?? []);
      }
    } catch {
      // Ignorer
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
    void loadQuotes();
    void loadInvoices();
  }, [loadData, loadQuotes, loadInvoices]);

  // Filtrage des produits
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        selectedCategory === "ALL" || p.category_id === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory]);

  // Totaux du panier
  const totals = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let tax = 0;

    for (const item of cart) {
      const lineGross = item.quantity * item.unitPrice;
      const lineDiscount = Math.round(lineGross * (item.discountPercent / 100));
      const lineNet = lineGross - lineDiscount;
      const lineTax = Math.round(lineNet * (item.taxRate / 100));
      gross += lineGross;
      discount += lineDiscount;
      tax += lineTax;
    }

    return {
      gross,
      discount,
      tax,
      net: gross - discount + tax,
    };
  }, [cart]);

  // Actions panier
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          unit: product.unit || "unité",
          quantity: 1,
          discountPercent: 0,
          taxRate: 0,
          availableStock: product.current_stock,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, discountPercent: Math.max(0, Math.min(100, discount)) }
          : item
      )
    );
  };

  // Créer un devis
  const handleCreateQuote = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/commerce/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          quoteType,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.full_name || "Client comptoir",
          customerPhone: selectedCustomer?.phone || null,
          validDays,
          notes,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            discountPercent: i.discountPercent,
            taxRate: i.taxRate,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de création du devis.");

      setMessage({ text: `Devis ${data.quote?.quote_number} créé avec succès !`, type: "success" });
      setCart([]);
      void loadQuotes();
      setTab("quotes");
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Erreur inattendue", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Vente directe transmise en caisse ("À régler")
  const handleSendToCashier = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/commerce/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.full_name || "Client comptoir",
          documentType: "INVOICE",
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            discountPercent: i.discountPercent,
            taxRate: i.taxRate,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'envoi en caisse.");

      setMessage({
        text: `Vente ${data.invoice?.order_number} transmise au Caissier avec succès. Le stock est réservé.`,
        type: "success",
      });
      setCart([]);
      void loadInvoices();
      void loadData(); // rafraîchir les stocks
      setTab("invoices");
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Erreur inattendue", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Convertir un devis en facture
  const handleConvertQuote = async (quoteId: string) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/commerce/quotes/${quoteId}/convert`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de convertir le devis.");

      setMessage({ text: data.message || "Devis converti en facture avec succès !", type: "success" });
      void loadQuotes();
      void loadInvoices();
      void loadData();
      setTab("invoices");
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Erreur de conversion", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Créer un client express
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          fullName: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          customerType: "NAMED",
        }),
      });
      const data = await res.json();
      if (res.ok && data.customer) {
        setCustomers((prev) => [data.customer, ...prev]);
        setSelectedCustomer(data.customer);
        setShowNewCustomerModal(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
      }
    } catch {
      // Ignorer
    }
  };

  // KPI Vendeur
  const pendingQuotesCount = quotes.filter((q) => q.status === "PENDING").length;
  const invoicesWaitingPaymentCount = invoices.filter((i) => i.status === "PENDING").length;
  const paidInvoicesToday = invoices.filter(
    (i) => i.status === "PAID" && new Date(i.created_at).toDateString() === new Date().toDateString()
  );
  const totalRevenueToday = paidInvoicesToday.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Cockpit Vendeur */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black uppercase text-amber-800">
              Espace Vendeur
            </span>
            <span className="text-xs text-slate-500 font-semibold">{companyName}</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Devis, Proformas & Ventes
          </h1>
          <p className="text-xs text-slate-500">
            Conseillez le client, créez des devis et transmettez vos ventes directement à la caisse.
          </p>
        </div>

        {/* Boutons d'onglets */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-200/70 p-1.5 self-start">
          <button
            onClick={() => setTab("pos")}
            className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
              tab === "pos" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🛒 Nouvelle Vente / Devis
          </button>
          <button
            onClick={() => setTab("quotes")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
              tab === "quotes" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📋 Devis & Proformas</span>
            {pendingQuotesCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                {pendingQuotesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("invoices")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
              tab === "invoices" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>💳 Factures en Caisse</span>
            {invoicesWaitingPaymentCount > 0 && (
              <span className="rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] text-white">
                {invoicesWaitingPaymentCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400">Ventes payées aujourd'hui</p>
          <p className="mt-1 text-xl font-black text-emerald-700">{money(totalRevenueToday)}</p>
          <p className="text-[10px] text-slate-500">{paidInvoicesToday.length} commande(s)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400">Devis en cours</p>
          <p className="mt-1 text-xl font-black text-amber-600">{pendingQuotesCount}</p>
          <p className="text-[10px] text-slate-500">En attente accord client</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400">En attente de paiement</p>
          <p className="mt-1 text-xl font-black text-blue-600">{invoicesWaitingPaymentCount}</p>
          <p className="text-[10px] text-slate-500">Transmises au caissier</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400">Vendeur connecté</p>
          <p className="mt-1 text-sm font-black text-slate-800 truncate">{sellerName}</p>
          <p className="text-[10px] text-emerald-600 font-bold">Actif · Prise de commande</p>
        </div>
      </div>

      {/* Bannière de notification */}
      {message && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold shadow-sm ${
            message.type === "success"
              ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border border-red-300 bg-red-50 text-red-900"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* CONTENU PRINCIPAL PAR ONGLET */}
      {tab === "pos" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Section Catalogue & Articles */}
          <div className="space-y-4">
            {/* Barre de recherche et filtres */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Rechercher un produit par nom..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium outline-none focus:border-emerald-600"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-2.5 text-xs text-slate-400"
                  >
                    ✕
                  </button>
                )}
              </div>

              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="ALL">Toutes les catégories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Grille de produits */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.current_stock <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md active:scale-98"
                  >
                    <div>
                      {p.image_url ? <img src={p.image_url} alt={`Photo de ${p.name}`} className="mb-3 h-28 w-full rounded-xl object-cover" loading="lazy" /> : <div aria-hidden="true" className="mb-3 grid h-28 w-full place-items-center rounded-xl bg-slate-100 text-2xl text-slate-400">▧</div>}
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-black text-slate-900 line-clamp-2">
                          {p.name}
                        </span>
                        <span className="rounded bg-emerald-50 px-1 text-[10px] font-black text-emerald-700">
                          ＋
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{p.unit || "unité"}</p>
                    </div>

                    <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2">
                      <span className="text-sm font-black text-emerald-700">{money(p.price)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                          isOutOfStock
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isOutOfStock ? "Rupture" : `Stock: ${p.current_stock}`}
                      </span>
                    </div>
                  </button>
                );
              })}

              {!filteredProducts.length && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400">
                  {loading ? "Chargement des produits..." : "Aucun produit ne correspond à votre recherche."}
                </div>
              )}
            </div>
          </div>

          {/* Panier latéral & Paramètres de vente */}
          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Panier de vente</h2>
                <p className="text-[11px] text-slate-400">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} article(s)
                </p>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Vider
                </button>
              )}
            </div>

            {/* Sélecteur de Client */}
            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500">Client</span>
                <button
                  onClick={() => setShowNewCustomerModal(true)}
                  className="text-[10px] font-black text-emerald-700 hover:underline"
                >
                  ＋ Nouveau client
                </button>
              </div>

              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{selectedCustomer.full_name}</p>
                    {selectedCustomer.phone && (
                      <p className="text-[10px] text-slate-500">{selectedCustomer.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[10px] text-slate-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  onChange={(e) => {
                    const found = customers.find((c) => c.id === e.target.value);
                    setSelectedCustomer(found || null);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="">👤 Client comptoir (anonyme)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Liste des articles dans le panier */}
            <div className="flex-1 max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-black text-slate-900 truncate">{item.name}</span>
                    <span className="font-black text-emerald-700">
                      {money(item.quantity * item.unitPrice * (1 - item.discountPercent / 100))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>{money(item.unitPrice)}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-slate-700 font-black hover:bg-slate-300"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-black text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-slate-700 font-black hover:bg-slate-300"
                      >
                        ＋
                      </button>
                    </div>
                  </div>

                  {/* Option Remise par ligne */}
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-1 text-[10px]">
                    <span className="text-slate-400">Remise (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={item.discountPercent || ""}
                      placeholder="0"
                      onChange={(e) => updateDiscount(item.productId, Number(e.target.value))}
                      className="w-12 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center font-bold text-slate-800"
                    />
                  </div>
                </div>
              ))}

              {!cart.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  Sélectionnez des articles dans le catalogue pour composer la vente ou le devis.
                </div>
              )}
            </div>

            {/* Récapitulatif financier */}
            {cart.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Total brut</span>
                  <span>{money(totals.gross)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Remise</span>
                    <span>-{money(totals.discount)}</span>
                  </div>
                )}
                <div className="flex items-end justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-900">
                  <span>Net à payer</span>
                  <span className="text-xl text-emerald-800">{money(totals.net)}</span>
                </div>
              </div>
            )}

            {/* Boutons d'action : Vente directe en caisse ou Devis */}
            <div className="space-y-2 pt-2">
              <button
                disabled={!cart.length || submitting}
                onClick={handleSendToCashier}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 active:scale-98"
              >
                {submitting ? "Transmission…" : "Transmettre à la Caisse →"}
              </button>

              <button
                disabled={!cart.length || submitting}
                onClick={handleCreateQuote}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 text-xs font-black text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {submitting ? "Création…" : "📄 Enregistrer comme Devis / Proforma"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET DEVIS & PROFORMAS */}
      {tab === "quotes" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Registre des Devis et Proformas</h2>
              <p className="text-xs text-slate-500">
                Consultez, convertissez en facture ou partagez vos propositions commerciales.
              </p>
            </div>
            <button
              onClick={() => setTab("pos")}
              className="rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-800 self-start"
            >
              ＋ Nouveau Devis
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="p-3">Numéro</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Montant TTC</th>
                  <th className="p-3">Validité</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => {
                  const isPending = q.status === "PENDING";
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 font-mono font-black text-slate-900">{q.quote_number}</td>
                      <td className="p-3">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {q.quote_type}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-800">{q.customer_name}</p>
                        {q.customer_phone && (
                          <p className="text-[10px] text-slate-400">{q.customer_phone}</p>
                        )}
                      </td>
                      <td className="p-3 font-black text-emerald-800">{money(q.total_amount)}</td>
                      <td className="p-3 text-slate-500">
                        {new Date(q.valid_until).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                            q.status === "CONVERTED"
                              ? "bg-emerald-100 text-emerald-800"
                              : q.status === "PENDING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {q.status === "CONVERTED"
                            ? "Converti en Vente"
                            : q.status === "PENDING"
                            ? "En attente"
                            : q.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {isPending && (
                          <button
                            disabled={submitting}
                            onClick={() => handleConvertQuote(q.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Convertir en Vente →
                          </button>
                        )}
                        <a
                          href={`https://wa.me/${q.customer_phone ? q.customer_phone.replace(/[^0-9]/g, "") : ""}?text=${encodeURIComponent(
                            `Bonjour ${q.customer_name}, voici votre devis ${q.quote_number} d'un montant de ${money(
                              q.total_amount
                            )} émis par ${companyName}.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                        >
                          WhatsApp
                        </a>
                      </td>
                    </tr>
                  );
                })}

                {!quotes.length && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-slate-400">
                      Aucun devis créé pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET FACTURES EN CAISSE */}
      {tab === "invoices" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Suivi des Factures en Caisse</h2>
              <p className="text-xs text-slate-500">
                Suivez en temps réel l'encaissement et la libération par le magasinier.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="p-3">N° Facture</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Montant</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Statut Caisse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const isPending = inv.status === "PENDING";
                  const isPaid = inv.status === "PAID";
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 font-mono font-black text-slate-900">{inv.order_number}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">
                          {inv.customers?.full_name || inv.table_label}
                        </span>
                      </td>
                      <td className="p-3 font-black text-emerald-800">{money(inv.total_amount)}</td>
                      <td className="p-3 text-slate-500">
                        {new Date(inv.created_at).toLocaleDateString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : isPending
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isPaid ? "✓ Payée en caisse" : isPending ? "⏳ En attente de règlement" : inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!invoices.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-slate-400">
                      Aucune facture en cours.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nouveau Client Express */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateCustomer}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-black text-slate-900">Nouveau client express</h3>
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Nom complet / Entreprise
                <input
                  required
                  type="text"
                  placeholder="Ex. Aminata Diallo"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Téléphone (optionnel)
                <input
                  type="tel"
                  placeholder="Ex. +229 97 00 00 00"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
