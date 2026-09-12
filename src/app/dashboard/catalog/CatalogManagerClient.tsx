"use client";

// DebitManager: Gestionnaire unifié des Produits et Services pour BAR SANTE PLUS et établissements Power
import { useState, useEffect, useMemo, useRef, ChangeEvent, FormEvent } from "react";

type Category = {
  id: string;
  name: string;
  tenant_id: string;
};

type Product = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  product_type: string;
  stock_family: string;
  unit: string | null;
  price: number;
  current_stock: number;
  alert_threshold?: number;
  safety_threshold?: number;
  image_url: string | null;
  packaging_label: string | null;
  category_name?: string;
};

type PowerService = {
  id: string;
  tenant_id: string;
  activity_id: string;
  name: string;
  description: string | null;
  price_xof: number;
  billing_unit: string;
  image_url?: string | null;
  is_active: boolean;
  activity_code?: string;
};

type LodgingRoom = {
  id: string;
  tenant_id: string;
  room_number: string;
  pass_price_xof: number;
  pass_duration_minutes: number;
  night_price_xof: number;
  night_duration_nights: number;
  image_url?: string | null;
  is_active: boolean;
};

type UnifiedItem = {
  id: string;
  type: "PRODUCT" | "SERVICE" | "ROOM";
  group: "BOISSONS" | "REPAS" | "AUBERGE" | "GYM" | "LAVAGE" | "WIFI" | "AUTRE";
  name: string;
  description?: string;
  priceXof: number;
  priceSecondaryXof?: number;
  unit?: string;
  stock?: number;
  imageUrl?: string | null;
  raw: Product | PowerService | LodgingRoom;
};

type FilterGroup = "TOUS" | "BOISSONS" | "REPAS" | "AUBERGE" | "GYM" | "LAVAGE" | "WIFI";

const money = (val: number) => `${new Intl.NumberFormat("fr-FR").format(val)} XOF`;

export function CatalogManagerClient({
  tenantId,
  companyName,
  isPower,
  canManage,
  userRole,
}: {
  tenantId: string;
  companyName: string;
  isPower: boolean;
  canManage: boolean;
  userRole: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<PowerService[]>([]);
  const [rooms, setRooms] = useState<LodgingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  // Filters
  const [activeFilter, setActiveFilter] = useState<FilterGroup>("TOUS");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<UnifiedItem | null>(null);

  // Form creation state
  const [createKind, setCreateKind] = useState<"BOISSON" | "REPAS" | "GYM" | "LAVAGE" | "WIFI" | "AUBERGE">("BOISSON");
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPassPrice, setFormPassPrice] = useState("");
  const [formUnit, setFormUnit] = useState("UNIT");
  const [formStock, setFormStock] = useState("0");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load all data
  async function loadAllData() {
    setLoading(true);
    setError("");
    try {
      const [prodRes, catRes, servRes, roomRes] = await Promise.all([
        fetch(`/api/products?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
        isPower ? fetch(`/api/power/services?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }) : Promise.resolve(null),
        isPower ? fetch(`/api/power/rooms?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }) : Promise.resolve(null),
      ]);

      if (prodRes && prodRes.ok) {
        const prodJson = await prodRes.json();
        setProducts(prodJson.products ?? []);
      }
      if (catRes && catRes.ok) {
        const catJson = await catRes.json();
        setCategories((catJson.categories ?? []).filter((c: Category) => c.tenant_id === tenantId));
      }
      if (servRes && servRes.ok) {
        const servJson = await servRes.json();
        setServices(servJson.services ?? []);
      }
      if (roomRes && roomRes.ok) {
        const roomJson = await roomRes.json();
        setRooms(roomJson.rooms ?? []);
      }
    } catch (cause) {
      console.error("[Catalog] Erreur chargement:", cause);
      setError("Impossible de charger l'ensemble des produits et services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAllData();
  }, [tenantId, isPower]);

  // Consolidate all items into unified list
  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const list: UnifiedItem[] = [];
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    // Products
    for (const p of products) {
      const catName = p.category_id ? catMap.get(p.category_id) || "" : "";
      const isBeverage = p.stock_family === "BEVERAGE" || /bière|sucrerie|vin|liqueur|whisky|eau|boisson/i.test(catName || p.name);
      list.push({
        id: `prod-${p.id}`,
        type: "PRODUCT",
        group: isBeverage ? "BOISSONS" : "REPAS",
        name: p.name,
        description: catName ? `Catégorie : ${catName}` : p.packaging_label ?? undefined,
        priceXof: p.price,
        unit: p.unit || "Bouteille/Unité",
        stock: p.current_stock,
        imageUrl: p.image_url,
        raw: { ...p, category_name: catName },
      });
    }

    // Power Services
    for (const s of services) {
      let grp: UnifiedItem["group"] = "AUTRE";
      const desc = s.description || "";
      const n = s.name.toLowerCase();
      if (n.includes("gym") || n.includes("tapis") || n.includes("séance") || n.includes("vibromasseur") || n.includes("abonnement")) {
        grp = "GYM";
      } else if (n.includes("lavage") || n.includes("moto") || n.includes("voiture")) {
        grp = "LAVAGE";
      } else if (n.includes("wifi") || n.includes("ticket") || n.includes("connexion")) {
        grp = "WIFI";
      } else if (n.includes("nuitée") || n.includes("passe") || n.includes("auberge") || n.includes("chambre")) {
        grp = "AUBERGE";
      }

      list.push({
        id: `serv-${s.id}`,
        type: "SERVICE",
        group: grp,
        name: s.name,
        description: desc,
        priceXof: s.price_xof,
        unit: s.billing_unit,
        imageUrl: s.image_url,
        raw: s,
      });
    }

    // Lodging Rooms
    for (const r of rooms) {
      list.push({
        id: `room-${r.id}`,
        type: "ROOM",
        group: "AUBERGE",
        name: `Chambre ${r.room_number}`,
        description: `Nuitée : ${money(r.night_price_xof)} · Passe (${r.pass_duration_minutes} min) : ${money(r.pass_price_xof)}`,
        priceXof: r.night_price_xof,
        priceSecondaryXof: r.pass_price_xof,
        unit: "Chambre",
        imageUrl: r.image_url,
        raw: r,
      });
    }

    return list;
  }, [products, categories, services, rooms]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (activeFilter !== "TOUS" && item.group !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesUnit = item.unit?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesUnit) return false;
      }
      return true;
    });
  }, [unifiedItems, activeFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const byGroup: Record<string, number> = {
      TOUS: unifiedItems.length,
      BOISSONS: 0,
      REPAS: 0,
      AUBERGE: 0,
      GYM: 0,
      LAVAGE: 0,
      WIFI: 0,
    };
    for (const item of unifiedItems) {
      if (byGroup[item.group] !== undefined) {
        byGroup[item.group]++;
      }
    }
    return byGroup;
  }, [unifiedItems]);

  // Handle Photo Upload
  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>, targetCallback: (url: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", tenantId);

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec du téléversement");

      targetCallback(data.imageUrl);
      setSuccessNotice("Photo enregistrée avec succès.");
      setTimeout(() => setSuccessNotice(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du téléversement de la photo");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Handle Create Submit
  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (createKind === "BOISSON" || createKind === "REPAS") {
        const payload = {
          tenantId,
          name: formName,
          price: Math.round(Number(formPrice)),
          unit: formUnit || "UNIT",
          productType: "UNIT",
          stockFamily: createKind === "BOISSON" ? "BEVERAGE" : "KITCHEN",
          categoryId: formCategoryId || undefined,
          currentStock: Math.round(Number(formStock) || 0),
          imageUrl: formImageUrl || undefined,
        };
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Impossible de créer le produit.");
      } else if (createKind === "AUBERGE") {
        const payload = {
          tenantId,
          roomNumber: formName,
          nightPriceXof: Math.round(Number(formPrice)),
          passPriceXof: Math.round(Number(formPassPrice) || 0),
          passDurationMinutes: 60,
          nightDurationNights: 1,
          imageUrl: formImageUrl || undefined,
        };
        const res = await fetch("/api/power/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Impossible de créer la chambre.");
      } else {
        // GYM, LAVAGE, WIFI
        const activityCode = createKind === "WIFI" ? "WIFI" : createKind;
        const payload = {
          tenantId,
          activityCode,
          name: formName,
          description: formDescription || undefined,
          priceXof: Math.round(Number(formPrice)),
          billingUnit: formUnit || "UNIT",
          imageUrl: formImageUrl || undefined,
        };
        const res = await fetch("/api/power/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Impossible de créer le service.");
      }

      setSuccessNotice(`Élément "${formName}" ajouté avec succès.`);
      setTimeout(() => setSuccessNotice(""), 4000);
      setIsCreateOpen(false);
      resetCreateForm();
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Edit Submit
  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setSubmitting(true);
    setError("");

    try {
      if (editItem.type === "PRODUCT") {
        const p = editItem.raw as Product;
        const payload = {
          tenantId,
          productId: p.id,
          name: formName,
          price: Math.round(Number(formPrice)),
          categoryId: formCategoryId || undefined,
          imageUrl: formImageUrl || undefined,
        };
        const res = await fetch("/api/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Impossible de modifier le produit.");
      } else if (editItem.type === "ROOM") {
        const r = editItem.raw as LodgingRoom;
        const payload = {
          tenantId,
          roomId: r.id,
          roomNumber: formName,
          nightPriceXof: Math.round(Number(formPrice)),
          passPriceXof: Math.round(Number(formPassPrice) || 0),
          imageUrl: formImageUrl || undefined,
        };
        const res = await fetch("/api/power/rooms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Impossible de modifier la chambre.");
      } else {
        // SERVICE
        const s = editItem.raw as PowerService;
        const payload = {
          tenantId,
          serviceId: s.id,
          name: formName,
          description: formDescription || undefined,
          priceXof: Math.round(Number(formPrice)),
          billingUnit: formUnit || "UNIT",
          imageUrl: formImageUrl || undefined,
        };
        const res = await fetch("/api/power/services", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Impossible de modifier la prestation.");
      }

      setSuccessNotice(`Élément "${formName}" mis à jour.`);
      setTimeout(() => setSuccessNotice(""), 4000);
      setEditItem(null);
      await loadAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la modification.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: UnifiedItem) {
    setEditItem(item);
    setFormName(item.name.replace(/^Chambre\s+/, ""));
    setFormPrice(String(item.priceXof));
    setFormPassPrice(item.priceSecondaryXof ? String(item.priceSecondaryXof) : "");
    setFormUnit(item.unit || "UNIT");
    setFormDescription(item.description || "");
    setFormImageUrl(item.imageUrl || "");
    if (item.type === "PRODUCT") {
      const p = item.raw as Product;
      setFormCategoryId(p.category_id || "");
    }
  }

  function resetCreateForm() {
    setFormName("");
    setFormPrice("");
    setFormPassPrice("");
    setFormUnit("UNIT");
    setFormStock("0");
    setFormCategoryId("");
    setFormDescription("");
    setFormImageUrl("");
  }

  return (
    <section className="space-y-6">
      {/* Header title & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-black tracking-tight text-[var(--primary)] sm:text-3xl">
              Produits et services
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
            Catalogue général · {companyName} {isPower ? "(Formule Power)" : ""} · Droits : {userRole}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary)]/90"
          >
            <span>＋</span>
            <span>Nouveau produit / service</span>
          </button>
        )}
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      {successNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {successNotice}
        </div>
      )}

      {/* Filters bar */}
      <div className="space-y-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          {(
            [
              ["TOUS", "Tous", stats.TOUS],
              ["BOISSONS", "🍺 Boissons", stats.BOISSONS],
              ["REPAS", "🍲 Repas & Accompagnements", stats.REPAS],
              ["AUBERGE", "🛏 Chambres Auberge", stats.AUBERGE],
              ["GYM", "💪 Salle Gym", stats.GYM],
              ["LAVAGE", "🚗 Lavage", stats.LAVAGE],
              ["WIFI", "📶 Zone Wi-Fi", stats.WIFI],
            ] as const
          ).map(([key, label, count]) => {
            const active = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key as FilterGroup)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition ${
                  active
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                    active ? "bg-white/20 text-white" : "bg-[var(--surface-muted)] text-[var(--muted)]"
                  }`}
                >
                  {count ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, catégorie, tarif..."
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-10 pr-4 text-sm font-semibold text-[var(--primary)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
          />
          <span className="pointer-events-none absolute left-3.5 top-3 text-sm text-[var(--muted)]">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3 text-xs font-bold text-[var(--muted)] hover:text-[var(--primary)]"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Grid of Items */}
      {loading ? (
        <div className="py-16 text-center text-sm font-bold text-[var(--muted)]">
          Chargement du catalogue complet...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-12 text-center">
          <p className="text-3xl">📦</p>
          <h3 className="mt-3 text-base font-bold text-[var(--primary)]">Aucun produit ou service trouvé</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {searchQuery ? "Essayez de modifier votre recherche." : "Ajoutez un premier produit ou service au catalogue."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition hover:shadow-md"
            >
              {/* Picture Header */}
              <div className="relative h-44 w-full bg-[var(--surface-muted)]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-[var(--muted)]">
                    <span className="text-4xl">
                      {item.group === "BOISSONS"
                        ? "🍺"
                        : item.group === "REPAS"
                        ? "🍲"
                        : item.group === "AUBERGE"
                        ? "🛏"
                        : item.group === "GYM"
                        ? "💪"
                        : item.group === "LAVAGE"
                        ? "🚗"
                        : item.group === "WIFI"
                        ? "📶"
                        : "📦"}
                    </span>
                    <span className="mt-1 text-[11px] font-semibold text-[var(--muted)]/70">Aucune photo</span>
                  </div>
                )}

                {/* Badge Group */}
                <div className="absolute left-3 top-3">
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${
                      item.group === "BOISSONS"
                        ? "bg-amber-600"
                        : item.group === "REPAS"
                        ? "bg-orange-600"
                        : item.group === "AUBERGE"
                        ? "bg-indigo-600"
                        : item.group === "GYM"
                        ? "bg-emerald-600"
                        : item.group === "LAVAGE"
                        ? "bg-sky-600"
                        : "bg-purple-600"
                    }`}
                  >
                    {item.group}
                  </span>
                </div>

                {/* Stock badge if physical product */}
                {item.type === "PRODUCT" && (
                  <div className="absolute right-3 top-3">
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-black shadow-sm ${
                        (item.stock ?? 0) > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      Stock : {item.stock ?? 0}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3 className="line-clamp-1 text-base font-black text-[var(--primary)]" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                    {item.description || item.unit || "Prestation standard"}
                  </p>
                </div>

                {/* Prices & Action */}
                <div className="mt-4 flex items-end justify-between border-t border-[var(--line)]/60 pt-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Tarif</span>
                    <p className="text-base font-black text-[var(--primary)]">{money(item.priceXof)}</p>
                    {item.priceSecondaryXof !== undefined && item.priceSecondaryXof > 0 && (
                      <p className="text-[11px] font-bold text-[var(--muted)]">
                        Passe : {money(item.priceSecondaryXof)}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-bold text-[var(--primary)] transition hover:bg-[var(--primary)] hover:text-white"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* MODAL CRÉATION */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <h2 className="text-xl font-black text-[var(--primary)]">Nouveau produit ou service</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-lg font-bold text-[var(--muted)] hover:text-[var(--primary)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
              {/* Kind selector */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  Type d’élément
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["BOISSON", "🍺 Boisson"],
                      ["REPAS", "🍲 Repas"],
                      ["AUBERGE", "🛏 Auberge"],
                      ["GYM", "💪 Gym"],
                      ["LAVAGE", "🚗 Lavage"],
                      ["WIFI", "📶 Wi-Fi"],
                    ] as const
                  ).map(([kind, lbl]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setCreateKind(kind);
                        if (kind === "BOISSON") setFormUnit("Bouteille");
                        else if (kind === "REPAS") setFormUnit("Plat");
                        else if (kind === "AUBERGE") setFormUnit("Chambre");
                        else setFormUnit("UNIT");
                      }}
                      className={`rounded-xl px-2 py-2 text-xs font-black transition ${
                        createKind === kind
                          ? "bg-[var(--primary)] text-white"
                          : "border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--muted)]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  {createKind === "AUBERGE" ? "Numéro ou Nom de chambre" : "Désignation / Nom"}
                </label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={createKind === "AUBERGE" ? "Ex: 1, 2, VIP 1" : "Ex: Béninoise 65, Panini viande..."}
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Price & Pass Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                    {createKind === "AUBERGE" ? "Prix Nuitée (XOF)" : "Prix de vente (XOF)"}
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0"
                    className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {createKind === "AUBERGE" ? (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      Prix Passe (XOF)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formPassPrice}
                      onChange={(e) => setFormPassPrice(e.target.value)}
                      placeholder="Ex: 1000"
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      Unité
                    </label>
                    <input
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      placeholder="UNIT, Plat, Bouteille..."
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                )}
              </div>

              {/* Category selector for physical products */}
              {(createKind === "BOISSON" || createKind === "REPAS") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      Catégorie
                    </label>
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      <option value="">Sélectionner...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      Stock initial
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              {createKind !== "BOISSON" && createKind !== "AUBERGE" && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                    Description ou détails
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Détails de la prestation..."
                    className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
              )}

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  Photo de l’élément
                </label>
                <div className="mt-2 flex items-center gap-3">
                  {formImageUrl ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-[var(--line)]">
                      <img src={formImageUrl} alt="Aperçu" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormImageUrl("")}
                        className="absolute right-0.5 top-0.5 rounded-full bg-red-600 p-0.5 text-[10px] text-white"
                        title="Retirer la photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2.5 text-xs font-bold text-[var(--primary)] transition hover:bg-[var(--line)]">
                    <span>{uploadingImage ? "Téléversement..." : "📷 Choisir une photo"}</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageUpload(e, setFormImageUrl)}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-6 flex justify-end gap-3 border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[var(--primary)]/90 disabled:opacity-50"
                >
                  {submitting ? "Création en cours..." : "Créer l’élément"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ÉDITION */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <span className="text-xs font-black uppercase text-[var(--muted)]">{editItem.group}</span>
                <h2 className="text-xl font-black text-[var(--primary)]">Modifier {editItem.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="text-lg font-bold text-[var(--muted)] hover:text-[var(--primary)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  {editItem.type === "ROOM" ? "Numéro / Nom de la chambre" : "Désignation / Nom"}
                </label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                    {editItem.type === "ROOM" ? "Prix Nuitée (XOF)" : "Prix (XOF)"}
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {editItem.type === "ROOM" ? (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      Prix Passe (XOF)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formPassPrice}
                      onChange={(e) => setFormPassPrice(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      Unité
                    </label>
                    <input
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                )}
              </div>

              {/* Category for product */}
              {editItem.type === "PRODUCT" && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                    Catégorie
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="">Aucune catégorie</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description for Service */}
              {editItem.type === "SERVICE" && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-3 text-sm font-semibold text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
              )}

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  Photo
                </label>
                <div className="mt-2 flex items-center gap-3">
                  {formImageUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--line)] shadow-sm">
                      <img src={formImageUrl} alt="Aperçu" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormImageUrl("")}
                        className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-[10px] text-white"
                        title="Supprimer la photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2.5 text-xs font-bold text-[var(--primary)] transition hover:bg-[var(--line)]">
                    <span>{uploadingImage ? "Téléversement..." : "📷 Mettre à jour la photo"}</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageUpload(e, setFormImageUrl)}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-6 flex justify-end gap-3 border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[var(--primary)]/90 disabled:opacity-50"
                >
                  {submitting ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
