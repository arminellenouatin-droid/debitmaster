// Menu QR public, Design Read: Carte restaurant & lounge gastronomique haut de gamme, ambre doré & obsidienne, photos appétissantes, commandes instantanées à table.
"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock_family: "BEVERAGE" | "KITCHEN";
  unit?: string | null;
  packaging_label?: string | null;
  category_id?: string | null;
  image_url?: string | null;
};

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
};

type CompanyService = {
  id: string;
  activity_id: string;
  name: string;
  description?: string | null;
  price_xof: number;
  billing_unit?: string | null;
  image_url?: string | null;
};

type LodgingRoom = {
  id: string;
  room_number: string;
  pass_price_xof: number;
  pass_duration_minutes: number;
  night_price_xof: number;
  night_duration_nights: number;
  occupied_until?: string | null;
  image_url?: string | null;
};

type WifiTicket = {
  ticket_code: string;
  label: string;
  duration_label: string;
  unit_price_xof: number;
};

type MenuData = {
  company: { id: string; name: string };
  table: { id: string; label: string; zone: string | null };
  products: Product[];
  categories: Category[];
  activities?: { id: string; activity_code: string; name: string }[];
  services?: CompanyService[];
  rooms?: LodgingRoom[];
  wifiTickets?: WifiTicket[];
};

type CartLine = {
  product: Product;
  quantity: number;
};

type PendingPayment = {
  id: string;
  amount: number;
  referenceId?: string;
  status?: string;
};

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;

// SVG Icons
function IconCart({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function IconDrink({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20m0 0h6m-6 0l-.75-3M15 20l.75-3M4.5 4.5h15l-2.25 7.5a4.5 4.5 0 01-4.35 3.38h-1.8A4.5 4.5 0 016.75 12L4.5 4.5z" />
    </svg>
  );
}

function IconFood({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function IconSparkle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  );
}

function IconWifi({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.393 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  );
}

function IconBed({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v4m-9 4h18M4 7a1 1 0 011-1h4a1 1 0 011 1v3H4V7z" />
    </svg>
  );
}

function IconCheck({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export function MenuClient({ token }: { token: string }) {
  const [data, setData] = useState<MenuData | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "BEVERAGE" | "KITCHEN" | "SERVICES">("ALL");
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
  const [payAtTableSuccess, setPayAtTableSuccess] = useState(false);

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
    return () => {
      active = false;
    };
  }, [token]);

  const categoryMap = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c.name])), [data?.categories]);

  const categories = useMemo(() => {
    const visible = (data?.products ?? []).filter((product) => activeTab === "ALL" || product.stock_family === activeTab);
    const ids = [...new Set(visible.map((product) => product.category_id).filter(Boolean))] as string[];
    return ids.map((id) => ({ id, name: categoryMap.get(id) ?? "Autres" }));
  }, [categoryMap, data?.products, activeTab]);

  const products = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");
    return (data?.products ?? []).filter((product) => {
      const tabMatch = activeTab === "ALL" || product.stock_family === activeTab;
      const categoryMatch = selectedCategory === "ALL" || product.category_id === selectedCategory;
      const searchMatch =
        !query ||
        product.name.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ||
        Boolean(product.description && product.description.toLocaleLowerCase("fr-FR").includes(query));
      return tabMatch && categoryMatch && searchMatch;
    });
  }, [data?.products, search, selectedCategory, activeTab]);

  const cartMap = useMemo(() => new Map(cart.map((line) => [line.product.id, line.quantity])), [cart]);
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function add(product: Product) {
    setSuccess("");
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      return found ? current.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)) : [...current, { product, quantity: 1 }];
    });
  }

  function change(productId: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.product.id !== productId) return [line];
        const nextQty = line.quantity + delta;
        return nextQty > 0 ? [{ ...line, quantity: nextQty }] : [];
      })
    );
  }

  function removeLine(productId: string) {
    setCart((current) => current.filter((line) => line.product.id !== productId));
  }

  async function submitOrder() {
    if (!cart.length) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/public/menu/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          customerName,
          note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’envoyer la commande.");
      setSuccess(result.message ?? "Commande envoyée au service.");
      setCart([]);
      setCartOpen(true);
      setNote("");
      setPendingPayment({ id: result.order.id, amount: Number(result.order.total_amount), status: "ORDERED" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’envoyer la commande.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startPayment() {
    if (!pendingPayment || !paymentPhone.trim()) return;
    setPaymentBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/public/menu/${encodeURIComponent(token)}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: pendingPayment.id,
          amount: pendingPayment.amount,
          mobileNumber: paymentPhone.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’initier le paiement.");
      setPendingPayment((current) => (current ? { ...current, referenceId: result.referenceId, status: result.status } : current));
      setSuccess("Paiement Mobile Money initié ! Validez la demande sur votre téléphone (code secret requis).");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’initier le paiement.");
    } finally {
      setPaymentBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="qr-page qr-state">
        <div className="qr-spinner" aria-hidden="true" />
        <h2 className="text-xl font-bold text-amber-200 mt-4">Préparation de votre carte…</h2>
        <p className="text-sm text-neutral-400">Connexion sécurisée avec votre table en cours.</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="qr-page qr-state">
        <div className="qr-mark">!</div>
        <h1 className="text-2xl font-black text-amber-300">Menu indisponible</h1>
        <p className="text-sm text-neutral-400 max-w-md">{error}</p>
        <button className="qr-button mt-4" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </main>
    );
  }

  if (!data) return null;

  const hasServices = Boolean((data.services && data.services.length > 0) || (data.rooms && data.rooms.length > 0) || (data.wifiTickets && data.wifiTickets.length > 0));

  return (
    <main className="qr-page">
      {/* Top Welcome Ticker */}
      <div className="qr-marquee">
        <span className="inline-flex items-center gap-2">
          <IconSparkle className="w-3.5 h-3.5 text-amber-950 inline" />
          BIENVENUE CHEZ {data.company.name.toUpperCase()} • COMMANDE EN DIRECT À VOTRE TABLE • SERVICE DU BAR & DE LA CUISINE
          <IconSparkle className="w-3.5 h-3.5 text-amber-950 inline" />
        </span>
      </div>

      {/* Header Sticky Navbar */}
      <header className="qr-header">
        <div className="qr-brand">
          <span className="qr-brand-icon" aria-hidden="true">
            <IconSparkle className="w-5 h-5 text-amber-950" />
          </span>
          <div className="flex flex-col">
            <span className="text-amber-100 font-black tracking-tight text-base sm:text-lg leading-tight">{data.company.name}</span>
            <span className="text-amber-400/80 text-[10px] uppercase font-bold tracking-widest">Restaurant & Lounge</span>
          </div>
        </div>

        {/* Table Badge & Cart Button */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Table {data.table.label}</span>
            {data.table.zone && <span className="text-emerald-400/60 font-normal">· {data.table.zone}</span>}
          </div>

          <button className="qr-cart-button flex items-center gap-2" onClick={() => setCartOpen(true)} aria-label={`Ouvrir le panier, ${itemCount} article(s)`}>
            <IconCart className="w-4 h-4" />
            <span className="hidden xs:inline">Commande</span>
            <strong>{itemCount}</strong>
            {total > 0 && <span className="text-xs font-bold opacity-90 hidden sm:inline">({money(total)})</span>}
          </button>
        </div>
      </header>

      {/* Luxury Hero Banner */}
      <section className="qr-hero">
        <div className="qr-hero-glow" aria-hidden="true" />
        <div className="qr-hero-copy">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Connecté à la Table {data.table.label}</span>
            {data.table.zone && <span className="opacity-70">({data.table.zone})</span>}
          </div>

          <h1>L’Art de la Table & du Plaisir.</h1>
          <p>
            Explorez notre sélection de boissons bien fraîches, nos plats gourmands préparés avec passion par notre cuisine, et les services d’exception de notre complexe.
          </p>

          {/* Quick Hospitality Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5 max-w-2xl">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-xs font-semibold text-neutral-200">
              <span className="text-amber-400 text-base">⚡</span>
              <span>Service direct à table</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-xs font-semibold text-neutral-200">
              <span className="text-amber-400 text-base">👨‍🍳</span>
              <span>Cuisine fraîche du Chef</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-xs font-semibold text-neutral-200">
              <span className="text-amber-400 text-base">🍹</span>
              <span>Boissons & Vins frais</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm text-xs font-semibold text-neutral-200">
              <span className="text-amber-400 text-base">📱</span>
              <span>Paiement Mobile & Comptoir</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              className="qr-button"
              onClick={() => {
                document.getElementById("menu-catalog")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Consulter la Carte <span aria-hidden="true">↓</span>
            </button>
            {hasServices && (
              <button
                className="qr-button qr-button-light"
                onClick={() => {
                  setActiveTab("SERVICES");
                  document.getElementById("menu-catalog")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Services & Pass Wi-Fi ✨
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Menu Catalog Section */}
      <section id="menu-catalog" className="qr-menu-section">
        {/* Section Heading & Live Search */}
        <div className="qr-section-heading">
          <div>
            <p className="qr-kicker">À votre rythme • Table {data.table.label}</p>
            <h2>Notre Sélection Gourmande</h2>
          </div>
          <label className="qr-search">
            <span aria-hidden="true">
              <IconSearch className="w-4 h-4 text-amber-400/80" />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un plat, une boisson…"
              aria-label="Rechercher un plat ou une boisson"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs text-neutral-400 hover:text-amber-300 font-bold px-1.5"
                title="Effacer la recherche"
              >
                ✕
              </button>
            )}
          </label>
        </div>

        {/* Sticky Filters: Families + Categories */}
        <div className="qr-filters-container">
          <div className="qr-filters" role="tablist" aria-label="Catégories du menu">
            <button
              role="tab"
              aria-selected={activeTab === "ALL" && selectedCategory === "ALL"}
              className={activeTab === "ALL" && selectedCategory === "ALL" ? "is-active" : ""}
              onClick={() => {
                setActiveTab("ALL");
                setSelectedCategory("ALL");
              }}
            >
              🌟 Tout le Menu ({data.products.length})
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "BEVERAGE"}
              className={activeTab === "BEVERAGE" ? "is-active" : ""}
              onClick={() => {
                setActiveTab("BEVERAGE");
                setSelectedCategory("ALL");
              }}
            >
              🍹 Boissons & Bar ({data.products.filter((p) => p.stock_family === "BEVERAGE").length})
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "KITCHEN"}
              className={activeTab === "KITCHEN" ? "is-active" : ""}
              onClick={() => {
                setActiveTab("KITCHEN");
                setSelectedCategory("ALL");
              }}
            >
              🍽️ Plats & Cuisine ({data.products.filter((p) => p.stock_family === "KITCHEN").length})
            </button>
            {hasServices && (
              <button
                role="tab"
                aria-selected={activeTab === "SERVICES"}
                className={activeTab === "SERVICES" ? "is-active" : ""}
                onClick={() => {
                  setActiveTab("SERVICES");
                  setSelectedCategory("ALL");
                }}
              >
                ✨ Services & Pass
              </button>
            )}
          </div>

          {/* Subcategory Pills (when activeTab is not SERVICES) */}
          {activeTab !== "SERVICES" && categories.length > 0 && (
            <div className="qr-subfilters flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-[11px] uppercase font-extrabold text-amber-400/70 mr-1 shrink-0">Rayons :</span>
              <button
                type="button"
                className={`qr-subpill ${selectedCategory === "ALL" ? "is-active" : ""}`}
                onClick={() => setSelectedCategory("ALL")}
              >
                Tous
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`qr-subpill ${selectedCategory === cat.id ? "is-active" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <p className="qr-alert" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="qr-success" role="status">
            {success}
          </p>
        )}

        {/* Products Grid (when not on SERVICES tab) */}
        {activeTab !== "SERVICES" && (
          <>
            <div className="flex items-center justify-between my-3 text-xs text-neutral-400">
              <span>
                Affichage de <strong className="text-amber-300">{products.length}</strong> délice(s)
              </span>
              {search && (
                <span>
                  Filtre : &quot;{search}&quot;
                </span>
              )}
            </div>

            {products.length > 0 ? (
              <div className="qr-product-grid">
                {products.map((product) => {
                  const qtyInCart = cartMap.get(product.id) ?? 0;
                  const isKitchen = product.stock_family === "KITCHEN";

                  return (
                    <article className="qr-card group" key={product.id}>
                      {/* Card Media Header */}
                      <div className="qr-card-media">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="qr-card-img"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.parentElement?.classList.add("has-fallback");
                            }}
                          />
                        ) : (
                          <div className={`qr-card-fallback ${isKitchen ? "kitchen" : "beverage"}`}>
                            <div className="qr-card-fallback-glow" />
                            <div className="qr-card-fallback-icon">
                              {isKitchen ? <IconFood className="w-12 h-12 text-amber-300/80" /> : <IconDrink className="w-12 h-12 text-amber-300/80" />}
                            </div>
                            <span className="qr-card-watermark">{product.name}</span>
                          </div>
                        )}

                        {/* Badges Over Image */}
                        <div className="qr-card-badges">
                          <span className={`qr-badge ${isKitchen ? "badge-kitchen" : "badge-beverage"}`}>
                            {isKitchen ? "🍽️ Cuisine" : "🍹 Bar & Cave"}
                          </span>
                          {product.packaging_label && <span className="qr-badge badge-format">{product.packaging_label}</span>}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="qr-card-body">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="qr-card-title">{product.name}</h3>
                        </div>

                        <p className="qr-card-desc">
                          {product.description ||
                            (isKitchen
                              ? "Préparé avec soin à la commande par notre brigade de cuisine."
                              : "Servi très frais à votre table avec verres et glaçons.")}
                        </p>

                        {/* Card Price & Direct Actions */}
                        <div className="qr-card-footer">
                          <div className="qr-card-price">
                            <span className="qr-price-amount">{money(product.price)}</span>
                            {product.unit && <span className="qr-price-unit">/{product.unit}</span>}
                          </div>

                          {/* Direct On-Card Quantity Controls */}
                          {qtyInCart > 0 ? (
                            <div className="qr-qty-pill">
                              <button
                                type="button"
                                className="qr-qty-btn"
                                onClick={() => change(product.id, -1)}
                                aria-label={`Diminuer ${product.name}`}
                              >
                                −
                              </button>
                              <span className="qr-qty-val">{qtyInCart}</span>
                              <button
                                type="button"
                                className="qr-qty-btn"
                                onClick={() => change(product.id, 1)}
                                aria-label={`Augmenter ${product.name}`}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="qr-card-add-btn"
                              onClick={() => add(product)}
                              aria-label={`Ajouter ${product.name} au panier`}
                            >
                              <span>+</span>
                              <span>Ajouter</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="qr-empty">
                <div className="qr-mark">∅</div>
                <h3>Aucun article ne correspond</h3>
                <p>Essayez un autre mot-clé ou réinitialisez les filtres pour découvrir toute la carte.</p>
                <button
                  type="button"
                  className="qr-button qr-button-light mt-3"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("ALL");
                    setActiveTab("ALL");
                  }}
                >
                  Afficher tout le menu
                </button>
              </div>
            )}
          </>
        )}

        {/* Services, Lodging & Wi-Fi Section */}
        {(activeTab === "SERVICES" || (!search && activeTab === "ALL" && hasServices)) && (
          <section className="qr-services-section mt-12 pt-8 border-t border-amber-500/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="qr-kicker">Commodités & Prestations</p>
                <h2 className="text-2xl font-black text-amber-200">Services de l’Établissement</h2>
              </div>
              <span className="text-xs text-neutral-400">Disponibles sur place</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Wi-Fi Tickets */}
              {data.wifiTickets && data.wifiTickets.length > 0 && (
                <div className="qr-service-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 grid place-items-center text-amber-300">
                      <IconWifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-100 text-base">Wi-Fi Haut Débit</h4>
                      <p className="text-xs text-neutral-400">Connexion rapide & stable</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {data.wifiTickets.map((wifi) => (
                      <div key={wifi.ticket_code} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                        <div>
                          <p className="font-bold text-neutral-200">{wifi.label}</p>
                          <p className="text-[11px] text-amber-400/80">Validité : {wifi.duration_label}</p>
                        </div>
                        <span className="font-black text-amber-300 text-sm">{money(wifi.unit_price_xof)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-3 italic">Rapprochez-vous du serveur pour obtenir votre code de connexion.</p>
                </div>
              )}

              {/* Lodging / Rooms */}
              {data.rooms && data.rooms.length > 0 && (
                <div className="qr-service-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 grid place-items-center text-amber-300">
                      <IconBed className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-100 text-base">Chambres & Hébergement</h4>
                      <p className="text-xs text-neutral-400">Détente, repos & nuitée</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {data.rooms.map((room) => (
                      <div key={room.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-neutral-200">Chambre {room.room_number}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${room.occupied_until ? "bg-red-950/60 text-red-300 border border-red-500/30" : "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"}`}>
                            {room.occupied_until ? "Occupée" : "Disponible"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-300">
                          <span>Pass ({room.pass_duration_minutes} min) : <strong className="text-amber-300">{money(room.pass_price_xof)}</strong></span>
                          <span>Nuitée : <strong className="text-amber-300">{money(room.night_price_xof)}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Services (Gym, Lavage, etc.) */}
              {data.services && data.services.length > 0 && (
                <div className="qr-service-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 grid place-items-center text-amber-300">
                      <IconSparkle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-100 text-base">Autres Prestations</h4>
                      <p className="text-xs text-neutral-400">Gym, Lavage auto & moto</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {data.services.slice(0, 4).map((srv) => (
                      <div key={srv.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                        <div>
                          <p className="font-bold text-neutral-200">{srv.name}</p>
                          {srv.billing_unit && <p className="text-[11px] text-neutral-400">{srv.billing_unit}</p>}
                        </div>
                        <span className="font-black text-amber-300 text-sm">{money(srv.price_xof)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </section>

      {/* Floating Bottom Cart Dock (Appears when cart has items) */}
      {cart.length > 0 && (
        <div className="qr-dock-wrapper">
          <div className="qr-dock">
            <div className="flex items-center gap-3">
              <div className="qr-dock-badge">
                <IconCart className="w-5 h-5 text-amber-950" />
                <span className="qr-dock-count">{itemCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-amber-200/80 font-bold uppercase tracking-wider">Total Commande</span>
                <span className="text-base sm:text-lg font-black text-amber-400">{money(total)}</span>
              </div>
            </div>

            <button type="button" className="qr-dock-cta" onClick={() => setCartOpen(true)}>
              <span>Voir la commande</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="qr-footer">
        <div className="flex flex-col gap-1">
          <span className="text-amber-200 font-bold text-sm">{data.company.name}</span>
          <span className="text-neutral-400 text-xs">Service à table en direct · Table {data.table.label}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>Plateforme DébitMaster</span>
          <span>•</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-amber-400/80 hover:text-amber-300">
            Haut de page ↑
          </button>
        </div>
      </footer>

      {/* Checkout Drawer & Modal */}
      {cartOpen && (
        <div className="qr-overlay" role="presentation" onClick={() => setCartOpen(false)}>
          <aside
            className="qr-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Drawer Head */}
            <div className="qr-drawer-head">
              <div>
                <p className="qr-kicker">Service à table • {data.company.name}</p>
                <h2 id="cart-title">
                  {pendingPayment ? "Commande Transmise !" : `Votre Panier (${itemCount})`}
                </h2>
              </div>
              <button className="qr-close" onClick={() => setCartOpen(false)} aria-label="Fermer le panier">
                ×
              </button>
            </div>

            {/* Content: Order Confirmation & Payment Panel */}
            {pendingPayment ? (
              <div className="qr-payment-panel">
                <div className="qr-mark-success">
                  <IconCheck className="w-8 h-8 text-emerald-300" />
                </div>
                <h3 className="text-xl font-bold text-amber-200 mt-2">Commande bien reçue en cuisine & au bar !</h3>
                <p className="text-xs text-neutral-300 mt-1 max-w-sm">
                  Votre commande a été transmise directement à nos équipes pour la <strong>Table {data.table.label}</strong>. Vos consommations sont en cours de préparation.
                </p>

                <div className="qr-total-box my-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Table assignée :</span>
                    <strong className="text-amber-200">Table {data.table.label} {data.table.zone ? `(${data.table.zone})` : ""}</strong>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-300">
                    <span>Montant total de la commande :</span>
                    <strong className="text-base text-amber-300 font-extrabold">{money(pendingPayment.amount)}</strong>
                  </div>
                </div>

                {payAtTableSuccess ? (
                  <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs text-center space-y-2">
                    <p className="font-bold">✓ Règlement au serveur confirmé</p>
                    <p className="text-neutral-300">Le serveur apportera votre commande à la table et vous pourrez régler en espèces ou par carte/TPE.</p>
                    <button
                      type="button"
                      className="qr-button qr-button-light w-full mt-3"
                      onClick={() => {
                        setPendingPayment(null);
                        setPayAtTableSuccess(false);
                        setCartOpen(false);
                      }}
                    >
                      Retourner au menu
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Option 1: Mobile Money Payment */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                        <span>Option 1 : Paiement direct Mobile Money</span>
                      </div>
                      <label className="qr-form-label">
                        <span className="text-neutral-300 text-xs">Numéro de téléphone (MTN / Moov / Celtiis)</span>
                        <input
                          value={paymentPhone}
                          onChange={(event) => setPaymentPhone(event.target.value)}
                          placeholder="Ex: 0197000000"
                          inputMode="tel"
                          className="mt-1"
                        />
                      </label>
                      <button
                        className="qr-button qr-submit"
                        disabled={paymentBusy || !paymentPhone.trim()}
                        onClick={startPayment}
                      >
                        {paymentBusy ? "Initialisation du paiement…" : "Payer par Mobile Money"}
                      </button>
                      <p className="text-[11px] text-neutral-400 text-center">
                        Une invite USSD sera envoyée sur votre téléphone pour valider le débit sécurisé.
                      </p>
                    </div>

                    {/* Option 2: Pay to Server / At Counter */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center space-y-2">
                      <p className="text-xs font-bold text-neutral-300">Option 2 : Règlement lors du service</p>
                      <button
                        type="button"
                        className="qr-button qr-button-light w-full"
                        onClick={() => setPayAtTableSuccess(true)}
                      >
                        Régler directement au serveur à table
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : cart.length > 0 ? (
              <>
                {/* Cart Lines */}
                <div className="qr-cart-lines">
                  {cart.map((line) => (
                    <div className="qr-cart-line" key={line.product.id}>
                      <div className="flex items-center gap-3">
                        {line.product.image_url ? (
                          <img src={line.product.image_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 grid place-items-center text-amber-300">
                            {line.product.stock_family === "KITCHEN" ? <IconFood className="w-6 h-6" /> : <IconDrink className="w-6 h-6" />}
                          </div>
                        )}
                        <div>
                          <strong className="text-neutral-100 text-sm font-bold block">{line.product.name}</strong>
                          <span className="text-amber-400/90 text-xs font-semibold">{money(line.product.price)} l’unité</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="qr-quantity">
                          <button onClick={() => change(line.product.id, -1)} aria-label={`Retirer un(e) ${line.product.name}`}>
                            −
                          </button>
                          <span>{line.quantity}</span>
                          <button onClick={() => change(line.product.id, 1)} aria-label={`Ajouter un(e) ${line.product.name}`}>
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.product.id)}
                          className="text-neutral-500 hover:text-red-400 p-1 transition-colors"
                          title="Supprimer cet article"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form fields: Name and Special Instructions */}
                <div className="qr-form">
                  <label>
                    Votre prénom ou nom <span>(facultatif)</span>
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Ex: Jean, Mariam, VIP..."
                    />
                  </label>
                  <label>
                    Instructions pour le service ou la cuisine <span>(facultatif)</span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Ex: boisson très fraîche, sans glaçons, piment à part…"
                      rows={2}
                    />
                  </label>
                </div>

                {/* Totals Breakdown */}
                <div className="qr-total-box mt-4 p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Sous-total articles :</span>
                    <span>{money(total)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Service à table (Table {data.table.label}) :</span>
                    <span className="text-emerald-400 font-semibold">Inclus</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-amber-300 pt-2 border-t border-white/10">
                    <span>Total TTC à régler :</span>
                    <span>{money(total)}</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  className="qr-button qr-submit mt-4"
                  disabled={submitting}
                  onClick={submitOrder}
                >
                  {submitting ? "Transmission en cuisine…" : "Confirmer et envoyer la commande"}
                </button>
                <p className="qr-payment-note">
                  Votre commande sera transmise instantanément au bar et en cuisine pour la Table {data.table.label}.
                </p>
              </>
            ) : (
              <div className="qr-empty py-12">
                <div className="qr-mark">
                  <IconCart className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-amber-200">Votre panier est vide</h3>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Sélectionnez vos boissons et vos plats préférés depuis la carte pour composer votre commande.
                </p>
                <button className="qr-button mt-4" onClick={() => setCartOpen(false)}>
                  Explorer la carte
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

