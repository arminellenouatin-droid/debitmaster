"use client";
/* Design DebitManager Serveur : Expérience Mobile-First Tactile & Accessible pour le personnel terrain. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import {
  Wine,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Smartphone,
  Plus,
  Minus,
  Search,
  ShoppingBag,
  CreditCard,
  Banknote,
  AlertCircle,
  Printer,
  X,
  User,
  ArrowRight,
  Sparkles,
  LayoutGrid,
  Receipt,
  Calendar,
  Check,
  Building2,
} from "lucide-react";

type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  fulfillment_unit?: "BEVERAGE" | "MEAL";
  preparation_status?: string;
  prepared_at?: string | null;
  received_at?: string | null;
  delivered_at?: string | null;
};
type Payment = { id: string; status: string; payment_method: string; amount: number; created_at?: string };
type Order = {
  id: string;
  order_number: string;
  table_label: string | null;
  location_label?: string | null;
  customer_id?: string | null;
  customers?: { full_name: string } | { full_name: string }[] | null;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  order_items?: OrderItem[];
  payments?: Payment[];
};
type DashboardData = {
  zonesTablesEnabled: boolean;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    position: string;
    service_start_time: string | null;
    service_end_time: string | null;
    rest_day: number | null;
  } | null;
  assignments: {
    id: string;
    dining_tables: { id: string; label: string; zone: string | null; zone_id?: string | null; capacity: number; status: string } | null;
  }[];
  zoneAssignments?: {
    id: string;
    zone_id: string;
    work_zones: {
      id: string;
      name: string;
      is_active: boolean;
      dining_tables?: { id: string; label: string; zone: string | null; zone_id?: string | null; capacity: number; status: string }[];
    } | null;
  }[];
  orders: Order[];
  metrics: { sales: number; paidSales: number; orderCount: number; commissionTotal: number };
  commissions: { id: string; commission_amount: number; status: string; created_at: string }[];
};
type Product = {
  id: string;
  name: string;
  price: number;
  product_type?: string | null;
  stock_family?: string | null;
  category_id?: string | null;
};
type Customer = { id: string; full_name: string; phone: string | null; customer_type: string };
type CartLine = { product: Product; quantity: number; fulfillmentUnit: "BEVERAGE" | "MEAL" };
type RemittanceSnapshot = {
  sales: number;
  cash: number;
  mobile: number;
  receivedCash: number;
  shortages: number;
  cashBalance: number;
  pending: {
    id: string;
    expected_cash_amount: number;
    declared_mobile_amount: number;
    declared_cash_amount: number;
    status: string;
    submitted_at: string;
  } | null;
  remittances: {
    id: string;
    expected_cash_amount: number;
    declared_mobile_amount: number;
    declared_cash_amount: number;
    received_cash_amount: number | null;
    discrepancy_type: string | null;
    discrepancy_amount: number;
    status: string;
    submitted_at: string;
    confirmed_at: string | null;
    note: string | null;
  }[];
};

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(value)))} XOF`;
const statusLabel: Record<string, string> = {
  PENDING: "Envoyée",
  IN_PREPARATION: "En préparation",
  READY: "Prête",
  HANDED_OFF: "Partiellement reçue",
  DELIVERED: "Livrée",
  PAID: "Payée",
};
const itemStatusLabel: Record<string, string> = {
  PENDING: "À préparer",
  IN_PREPARATION: "En préparation",
  READY: "Prête",
  RECEIVED: "Reçue",
  DELIVERED: "Livrée",
};
const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function ServeurClient({
  tenantId,
  firstName,
  companyName,
  initialTab = "dashboard",
}: {
  tenantId: string;
  firstName: string;
  companyName: string;
  initialTab?: "dashboard" | "orders" | "sales" | "encaissement" | "treasury" | "permanence" | "profile";
}) {
  const normalizedInitial = initialTab === "sales" ? "encaissement" : initialTab;
  const [tab, setTab] = useState<"dashboard" | "orders" | "encaissement" | "treasury" | "permanence" | "profile">(
    normalizedInitial as "dashboard" | "orders" | "encaissement" | "treasury" | "permanence" | "profile"
  );
  useEffect(() => {
    setTab(normalizedInitial as "dashboard" | "orders" | "encaissement" | "treasury" | "permanence" | "profile");
  }, [normalizedInitial]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [remittance, setRemittance] = useState<RemittanceSnapshot | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedType, setSelectedType] = useState<"BEVERAGE" | "MEAL">("BEVERAGE");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [mobileAmount, setMobileAmount] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [declaredCashAmount, setDeclaredCashAmount] = useState("");
  const [declaredMobileAmount, setDeclaredMobileAmount] = useState("");
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [orderSearch, setOrderSearch] = useState("");

  const refresh = useCallback(async () => {
    const [response, financeResponse] = await Promise.all([
      fetch("/api/dashboard/staff-overview", { cache: "no-store" }),
      fetch(`/api/server-remittances?tenantId=${tenantId}`, { cache: "no-store" }),
    ]);
    if (response.ok) setData(await response.json());
    if (financeResponse.ok) setRemittance((await financeResponse.json()).snapshot ?? null);
  }, [tenantId]);

  const loadOrderData = useCallback(async () => {
    const [productsResponse, customersResponse] = await Promise.all([
      fetch(`/api/products?tenantId=${tenantId}`, { cache: "no-store" }),
      fetch(`/api/customers?tenantId=${tenantId}`, { cache: "no-store" }),
    ]);
    if (productsResponse.ok) setProducts((await productsResponse.json()).products ?? []);
    if (customersResponse.ok) setCustomers((await customersResponse.json()).customers ?? []);
  }, [tenantId]);

  useEffect(() => {
    void refresh();
    void loadOrderData();
  }, [refresh, loadOrderData]);
  useLiveRefresh(async () => {
    await Promise.all([refresh(), loadOrderData()]);
  });

  const assignedTables = useMemo(() => {
    const direct = data?.assignments.map((assignment) => assignment.dining_tables).filter(Boolean) ?? [];
    const fromZones = data?.zoneAssignments?.flatMap((assignment) => assignment.work_zones?.dining_tables ?? []) ?? [];
    return Array.from(new Map([...direct, ...fromZones].filter(Boolean).map((table) => [table!.id, table])).values());
  }, [data]);

  const locations = useMemo(
    () =>
      Array.from(
        new Set([
          ...(data?.zoneAssignments?.map((assignment) => assignment.work_zones?.name).filter(Boolean) ?? []),
          ...assignedTables.map((table) => table?.zone ?? "Emplacement général"),
        ].filter((value): value is string => Boolean(value)))
      ).sort((a, b) => a.localeCompare(b, "fr")),
    [assignedTables, data]
  );

  const locationTables = useMemo(
    () =>
      assignedTables.filter(
        (table) =>
          (table?.zone ?? "Emplacement général") === selectedLocation ||
          data?.zoneAssignments?.some(
            (assignment) => assignment.work_zones?.id === table?.zone_id && assignment.work_zones?.name === selectedLocation
          )
      ),
    [assignedTables, data, selectedLocation]
  );

  const selectedZoneId = useMemo(
    () =>
      data?.zoneAssignments?.find((assignment) => assignment.work_zones?.name === selectedLocation)?.zone_id ??
      locationTables.find((table) => table?.zone_id)?.zone_id ??
      null,
    [data, locationTables, selectedLocation]
  );

  useEffect(() => {
    setSelectedLocation((current) => (locations.length === 1 ? locations[0] ?? "" : locations.includes(current) ? current : ""));
  }, [locations]);

  useEffect(() => {
    setTableLabel((current) => (locationTables.some((table) => table?.label === current) ? current : ""));
  }, [locationTables]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const kind = String(product.product_type ?? "").toUpperCase();
      const inferred = kind.includes("FOOD") || kind.includes("MEAL") || product.stock_family === "KITCHEN" ? "MEAL" : "BEVERAGE";
      return inferred === selectedType && product.name.toLowerCase().includes(productSearch.toLowerCase());
    });
  }, [products, productSearch, selectedType]);

  const cartTotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  const orderPaid = (order: Order) =>
    (order.payments ?? []).filter((payment) => ["SUCCEEDED"].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount), 0);

  const orderRemaining = (order: Order) => Math.max(order.total_amount - orderPaid(order), 0);

  const customerName = (order: Order) =>
    Array.isArray(order.customers) ? order.customers[0]?.full_name ?? "Client comptoir" : order.customers?.full_name ?? "Client comptoir";

  const readiness = (order: Order, unit: "BEVERAGE" | "MEAL") => {
    const items = (order.order_items ?? []).filter((item) => item.fulfillment_unit === unit);
    if (!items.length) return null;
    return items.every((item) => ["READY", "RECEIVED", "DELIVERED"].includes(item.preparation_status ?? "PENDING"))
      ? "Prêt"
      : items.some((item) => ["READY", "RECEIVED", "DELIVERED"].includes(item.preparation_status ?? "PENDING"))
      ? "Partiellement prêt"
      : "En préparation";
  };

  const zonesTablesEnabled = data?.zonesTablesEnabled ?? true;

  const visibleOrders = useMemo(() => {
    return (
      data?.orders.filter((order) => {
        const needle = orderSearch.trim().toLowerCase();
        return !needle || `${order.order_number} ${customerName(order)} ${order.table_label ?? ""}`.toLowerCase().includes(needle);
      }) ?? []
    );
  }, [data, orderSearch]);

  // Fast direct quantity increment / decrement helper for staff on touch screens
  const incProduct = (product: Product) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...current, { product, quantity: 1, fulfillmentUnit: selectedType }];
    });
  };

  const decProduct = (productId: string) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === productId);
      if (!existing) return current;
      if (existing.quantity <= 1) {
        return current.filter((line) => line.product.id !== productId);
      }
      return current.map((line) => (line.product.id === productId ? { ...line, quantity: line.quantity - 1 } : line));
    });
  };

  const getProductQty = (productId: string) => {
    return cart.find((line) => line.product.id === productId)?.quantity ?? 0;
  };

  const removeLine = (productId: string) => setCart((current) => current.filter((line) => line.product.id !== productId));

  const placeOrder = async () => {
    if (zonesTablesEnabled && !selectedLocation) return setNotice("Sélectionnez l’emplacement avant de choisir la table.");
    if (zonesTablesEnabled && !tableLabel.trim()) return setNotice("Le numéro de table est obligatoire pour retrouver la commande.");
    if (!cart.length) return setNotice("Ajoutez au moins un article à la commande.");
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        locationLabel: zonesTablesEnabled ? selectedLocation : null,
        zoneId: zonesTablesEnabled ? selectedZoneId : null,
        tableLabel: zonesTablesEnabled ? tableLabel : null,
        customerId: customerId || null,
        lines: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity, fulfillmentUnit: line.fulfillmentUnit })),
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Impossible de lancer la commande.");
    setNotice(`✓ Commande ${result.order.order_number} envoyée avec succès !`);
    setCart([]);
    setTab("encaissement");
    await refresh();
  };

  const createCustomer = async () => {
    if (newCustomer.trim().length < 2) return setNotice("Le nom du client est obligatoire.");
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, fullName: newCustomer.trim(), customerType: "NAMED" }),
    });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error ?? "Impossible de créer le client.");
    setCustomers((current) => [result.customer, ...current]);
    setCustomerId(result.customer.id);
    setNewCustomer("");
    setNotice("Client enregistré.");
  };

  const moveItem = async (order: Order, item: OrderItem, status: "HANDED_OFF" | "DELIVERED" | "IN_PREPARATION" | "READY") => {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, orderId: order.id, orderItemId: item.id, status }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Impossible de mettre à jour l’article.");
    setNotice(
      status === "HANDED_OFF"
        ? `${item.product_name} reçu et affecté à votre service.`
        : status === "DELIVERED"
        ? `${item.product_name} marqué livré.`
        : "État de préparation mis à jour."
    );
    await refresh();
  };

  const pay = async () => {
    if (!paymentOrder) return;
    const total = orderRemaining(paymentOrder);
    const cash = Number(cashAmount || 0);
    const mobile = Number(mobileAmount || 0);
    if (![cash, mobile].every((amount) => Number.isInteger(amount) && amount >= 0) || cash + mobile !== total || (cash === 0 && mobile === 0)) {
      return setNotice(`La ventilation doit correspondre exactement au reste : ${money(total)}.`);
    }
    if (mobile > 0 && !mobileNumber.trim()) return setNotice("Le numéro Mobile Money est obligatoire pour la partie Mobile Money.");
    setBusy(true);
    setNotice("");
    try {
      if (cash > 0) {
        const cashResponse = await fetch("/api/payments/cash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, orderId: paymentOrder.id, amount: cash }),
        });
        const cashResult = await cashResponse.json();
        if (!cashResponse.ok) throw new Error(cashResult.error ?? "Impossible d’enregistrer la partie espèces.");
      }
      if (mobile > 0) {
        const mobileResponse = await fetch("/api/payments/mtn-momo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, orderId: paymentOrder.id, amount: mobile, mobileNumber: mobileNumber.trim() }),
        });
        const mobileResult = await mobileResponse.json();
        if (!mobileResponse.ok) throw new Error(mobileResult.error ?? "Impossible de lancer Mobile Money.");
        if (!mobileResult.payment?.id) throw new Error("Référence de paiement MTN MoMo absente.");
        setNotice("Demande MTN MoMo envoyée. Le client doit confirmer sur son téléphone.");
        for (let attempt = 0; attempt < 40; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 3000));
          const statusResponse = await fetch(`/api/payments/mtn-momo/status?paymentId=${encodeURIComponent(mobileResult.payment.id)}`, {
            cache: "no-store",
          });
          const statusResult = await statusResponse.json();
          if (!statusResponse.ok) throw new Error(statusResult.error ?? "Impossible de vérifier MTN MoMo.");
          if (statusResult.payment?.status === "SUCCEEDED") {
            setNotice("✓ Paiement MTN MoMo confirmé ! La commande est soldée.");
            setPaymentOrder(null);
            setCashAmount("");
            setMobileAmount("");
            setMobileNumber("");
            await refresh();
            return;
          }
          if (statusResult.payment?.status === "FAILED") throw new Error("Le paiement MTN MoMo a échoué ou a été refusé.");
        }
        setNotice("Le paiement MTN MoMo est toujours en attente. Vérifiez le téléphone du client.");
        return;
      }
      setNotice("✓ Paiement espèces enregistré. La commande est soldée.");
      setPaymentOrder(null);
      setCashAmount("");
      setMobileAmount("");
      setMobileNumber("");
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Impossible de préparer le règlement.");
    } finally {
      setBusy(false);
    }
  };

  const submitRemittance = async () => {
    if (!remittance) return;
    const cash = Number(declaredCashAmount || 0);
    const mobile = Number(declaredMobileAmount || 0);
    if (![cash, mobile].every((amount) => Number.isInteger(amount) && amount >= 0)) return setNotice("Saisissez des montants valides pour le point.");
    if (cash > remittance.cashBalance) return setNotice(`Les espèces déclarées ne peuvent pas dépasser le solde cash : ${money(remittance.cashBalance)}.`);
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/server-remittances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, declaredCashAmount: cash, declaredMobileAmount: mobile }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Impossible d’enregistrer le reversement.");
    setDeclaredCashAmount("");
    setDeclaredMobileAmount("");
    setNotice("✓ Point envoyé au Gérant. En attente de validation.");
    await refresh();
  };

  const printTicket = (order: Order) => {
    setPrintingOrder(order);
    window.setTimeout(() => window.print(), 80);
  };

  if (!data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="mt-4 text-sm font-bold text-slate-600">Chargement de votre espace de service…</p>
      </div>
    );
  }

  const totals = data.orders.reduce(
    (acc, order) => {
      const paid = orderPaid(order);
      acc.sales += order.total_amount;
      acc.paid += paid;
      acc.remaining += Math.max(order.total_amount - paid, 0);
      acc.cash += (order.payments ?? [])
        .filter((payment) => payment.payment_method === "CASH" && ["SUCCEEDED"].includes(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      return acc;
    },
    { sales: 0, paid: 0, remaining: 0, cash: 0 }
  );

  return (
    <>
      <div className="space-y-6 pb-20 print:hidden">
        {/* Header bar */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-[#0c1e18] p-5 text-white shadow-md sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-slate-950 shadow-md">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">{companyName}</p>
              <h1 className="text-xl font-black tracking-tight sm:text-2xl">Service · {firstName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300 ring-1 ring-emerald-500/30">
              ● En service
            </span>
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-300">
              Cash en poche : {money(totals.cash)}
            </span>
          </div>
        </div>

        {/* Tactile Tab Selector (thumb-friendly for phones) */}
        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/80">
          {[
            { value: "dashboard", label: "Tableau de bord", icon: LayoutGrid },
            { value: "orders", label: "Prendre commande", icon: Plus },
            { value: "encaissement", label: `Encaissements (${visibleOrders.length})`, icon: Receipt },
            { value: "treasury", label: "Mon Point Caisse", icon: Banknote },
            { value: "permanence", label: "Horaires", icon: Calendar },
            { value: "profile", label: "Mon Profil", icon: User },
          ].map((item) => {
            const isActive = tab === item.value;
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                onClick={() => setTab(item.value as typeof tab)}
                className={`flex flex-1 min-w-[130px] items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs font-black transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-amber-400" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Alert Notice */}
        {notice && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice("")} className="text-emerald-700 hover:text-emerald-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Ventes</span>
                  <ShoppingBag className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-2xl font-black text-slate-900">{money(totals.sales)}</p>
                <p className="mt-1 text-xs text-slate-500">{data.metrics.orderCount} commandes lancées</p>
              </article>

              <article className="rounded-2xl border border-emerald-500/40 bg-emerald-50/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Espèces en main</span>
                  <Banknote className="h-5 w-5 text-emerald-700" />
                </div>
                <p className="mt-3 text-2xl font-black text-emerald-900">{money(totals.cash)}</p>
                <p className="mt-1 text-xs font-bold text-emerald-700">À reverser au Gérant</p>
              </article>

              <article className="rounded-2xl border border-amber-500/40 bg-amber-50/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Reste à encaisser</span>
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-3 text-2xl font-black text-amber-900">{money(totals.remaining)}</p>
                <p className="mt-1 text-xs text-amber-700">Sur vos tables actives</p>
              </article>

              <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Commissions</span>
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <p className="mt-3 text-2xl font-black text-slate-900">{money(data.metrics.commissionTotal)}</p>
                <p className="mt-1 text-xs text-slate-500">Gains personnels</p>
              </article>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Order Status Counters */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-amber-600">Suivi en direct</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">État de mes commandes</h3>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["PENDING", "Envoyée", "bg-slate-100 text-slate-800"],
                    ["HANDED_OFF", "Reçue", "bg-amber-100 text-amber-900"],
                    ["DELIVERED", "Livrée", "bg-blue-100 text-blue-900"],
                    ["PAID", "Payée", "bg-emerald-100 text-emerald-900"],
                  ].map(([statusKey, label, color]) => (
                    <div key={statusKey} className={`rounded-xl p-3.5 text-center ${color}`}>
                      <p className="text-2xl font-black">{data.orders.filter((o) => o.status === statusKey).length}</p>
                      <p className="mt-1 text-xs font-bold">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned Tables */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-amber-600">Mon Périmètre</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">
                  {assignedTables.length} Table{assignedTables.length > 1 ? "s" : ""} Attribuée{assignedTables.length > 1 ? "s" : ""}
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  {assignedTables.map((table) => (
                    <span
                      key={table?.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800 shadow-sm"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Table {table?.label}
                    </span>
                  ))}
                  {!assignedTables.length && (
                    <p className="text-sm text-slate-500">Aucune table assignée pour le moment.</p>
                  )}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
                  Service : {data.employee?.service_start_time || "—"} à {data.employee?.service_end_time || "—"} · Repos :{" "}
                  {data.employee?.rest_day !== null && data.employee?.rest_day !== undefined ? days[data.employee.rest_day] : "non défini"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NOUVELLE COMMANDE (TOUCH-OPTIMIZED) */}
        {tab === "orders" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              {/* Step 1: Table & Location Selector */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-600">Étape 1 · Emplacement & Table</span>
                  {tableLabel && (
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                      ✓ Table {tableLabel} sélectionnée
                    </span>
                  )}
                </div>

                {zonesTablesEnabled ? (
                  <div className="mt-4 space-y-3">
                    {/* Location Pills */}
                    {locations.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {locations.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => {
                              setSelectedLocation(loc);
                              setTableLabel("");
                            }}
                            className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                              selectedLocation === loc
                                ? "bg-slate-900 text-amber-400 shadow"
                                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Table Pills (Large touch targets for phones) */}
                    <div className="mt-2">
                      <p className="text-xs font-bold text-slate-500 mb-2">Touchez la table du client :</p>
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                        {locationTables.map((table) => {
                          const isSelected = tableLabel === table?.label;
                          return (
                            <button
                              key={table?.id}
                              type="button"
                              onClick={() => setTableLabel(table?.label ?? "")}
                              className={`flex flex-col items-center justify-center rounded-xl p-3 font-black transition-all active:scale-95 ${
                                isSelected
                                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500"
                                  : "border border-slate-200 bg-slate-50 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50"
                              }`}
                            >
                              <span className="text-base font-black">Table</span>
                              <span className="text-lg font-black text-amber-500">{table?.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                    Mode commande libre actif : Vous pouvez prendre la commande sans numéro de table.
                  </div>
                )}
              </div>

              {/* Step 2: Visual Products Grid */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600">Étape 2 · Choisir les articles</span>
                    <h3 className="text-lg font-black text-slate-900">Carte & Produits</h3>
                  </div>

                  {/* Big Toggle Drink vs Food */}
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedType("BEVERAGE")}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black transition ${
                        selectedType === "BEVERAGE"
                          ? "bg-emerald-700 text-white shadow"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Wine className="h-4 w-4 text-amber-400" />
                      <span>Boissons & Bar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedType("MEAL")}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black transition ${
                        selectedType === "MEAL"
                          ? "bg-emerald-700 text-white shadow"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <UtensilsCrossed className="h-4 w-4 text-amber-400" />
                      <span>Plats Cuisine</span>
                    </button>
                  </div>
                </div>

                {/* Instant Search Filter */}
                <div className="relative mt-4">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={selectedType === "BEVERAGE" ? "Rechercher une boisson (ex: Béninoise, Guinness, Eau)..." : "Rechercher un plat (ex: Poulet braisé, Mérou)..."}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch("")}
                      className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                {/* Products Grid with +/- Touch Buttons */}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {filteredProducts.map((p) => {
                    const qty = getProductQty(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                          qty > 0
                            ? "border-emerald-500 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500/50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-snug">{p.name}</p>
                            <p className="mt-1 text-xs font-black text-amber-600">{money(p.price)}</p>
                          </div>
                          {selectedType === "BEVERAGE" ? (
                            <Wine className="h-5 w-5 text-amber-500 shrink-0" />
                          ) : (
                            <UtensilsCrossed className="h-5 w-5 text-emerald-600 shrink-0" />
                          )}
                        </div>

                        {/* Direct +/- Stepper with large touch targets */}
                        <div className="mt-3.5 flex items-center justify-between rounded-xl bg-slate-100 p-1">
                          <button
                            type="button"
                            onClick={() => decProduct(p.id)}
                            disabled={qty === 0}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className={`text-base font-black ${qty > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => incProduct(p)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white shadow-sm hover:bg-emerald-500 active:scale-95"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!filteredProducts.length && (
                    <div className="col-span-full py-8 text-center text-sm text-slate-400">
                      Aucun article trouvé dans cette catégorie.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Cart Summary & Order Validation (Sticky on mobile & desktop) */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600">Brouillon</span>
                    <h3 className="text-lg font-black text-slate-900">
                      {tableLabel ? `Table ${tableLabel}` : "Sans table"}
                    </h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    {cartCount} article{cartCount > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Items in Cart */}
                <div className="mt-4 max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                  {cart.map((line) => (
                    <div key={line.product.id} className="flex items-center justify-between py-3 text-sm">
                      <div className="pr-2">
                        <p className="font-bold text-slate-900">{line.product.name}</p>
                        <p className="text-xs text-slate-500">
                          {line.quantity} × {money(line.product.price)} ·{" "}
                          <span className="text-amber-700 font-semibold">
                            {line.fulfillmentUnit === "MEAL" ? "Cuisine" : "Bar/Comptoir"}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{money(line.product.price * line.quantity)}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.product.id)}
                          className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!cart.length && (
                    <div className="py-12 text-center text-sm text-slate-400">
                      <ShoppingBag className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      Touchez les articles à gauche pour composer la commande.
                    </div>
                  )}
                </div>

                {/* Total Price */}
                <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600">Total à payer</span>
                  <span className="text-2xl font-black text-emerald-700">{money(cartTotal)}</span>
                </div>
              </div>

              {/* Big Send Order Button */}
              <button
                type="button"
                disabled={busy || !cart.length || (zonesTablesEnabled && !tableLabel)}
                onClick={() => void placeOrder()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-4 text-base font-black text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {busy ? (
                  <span>Envoi de la commande…</span>
                ) : (
                  <>
                    <span>ENVOYER LA COMMANDE ({money(cartTotal)})</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ENCAISSEMENT & REGLEMENT */}
        {tab === "encaissement" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-600">Factures & Règlements</span>
                <h3 className="text-lg font-black text-slate-900">Mes Commandes en Salle</h3>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="N° commande, table, client..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Orders List */}
            <div className="grid gap-4 md:grid-cols-2">
              {visibleOrders.map((order) => {
                const remaining = orderRemaining(order);
                const isPaid = order.status === "PAID" || remaining === 0;
                return (
                  <div
                    key={order.id}
                    className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition ${
                      isPaid
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-slate-200 bg-white hover:border-amber-400"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-amber-400">
                              Table {order.table_label || "Libre"}
                            </span>
                            <span className="text-xs font-bold text-slate-500">{order.order_number}</span>
                          </div>
                          <p className="mt-1.5 font-bold text-slate-900">{customerName(order)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900">{money(order.total_amount)}</p>
                          {!isPaid ? (
                            <p className="text-xs font-black text-amber-700">Reste : {money(remaining)}</p>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                              <Check className="h-3.5 w-3.5" /> Soldé
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items details */}
                      <div className="mt-4 divide-y divide-slate-100 rounded-xl bg-slate-50 p-3 text-xs">
                        {(order.order_items ?? []).map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-1.5">
                            <span className="font-semibold text-slate-800">
                              {item.quantity} × {item.product_name}
                            </span>
                            <div className="flex items-center gap-2">
                              {item.preparation_status === "READY" && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void moveItem(order, item, "HANDED_OFF")}
                                  className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white"
                                >
                                  Reçu ✓
                                </button>
                              )}
                              {item.preparation_status === "RECEIVED" && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void moveItem(order, item, "DELIVERED")}
                                  className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white"
                                >
                                  Livré ✓
                                </button>
                              )}
                              <span className="text-[10px] font-bold text-slate-500">
                                {itemStatusLabel[item.preparation_status ?? "PENDING"]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      {!isPaid ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentOrder(order);
                            setCashAmount(String(remaining));
                            setMobileAmount("");
                            setMobileNumber("");
                            setNotice("");
                          }}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-600 active:scale-95"
                        >
                          <Banknote className="h-4 w-4 text-amber-400" />
                          <span>ENCAISSER ({money(remaining)})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => printTicket(order)}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Imprimer le ticket</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!visibleOrders.length && (
                <div className="col-span-full rounded-2xl bg-white p-12 text-center text-sm text-slate-400 shadow-sm">
                  Aucune commande active trouvée.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: TREASURY / POINT DE CAISSE */}
        {tab === "treasury" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200/80">
                <p className="text-xs font-bold uppercase text-slate-500">Chiffre d’affaires total</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{money(remittance?.sales ?? totals.sales)}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-5 shadow-sm border border-emerald-200">
                <p className="text-xs font-bold uppercase text-emerald-800">Espèces encaissées</p>
                <p className="mt-2 text-2xl font-black text-emerald-900">{money(remittance?.cash ?? totals.cash)}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-5 shadow-sm border border-amber-200">
                <p className="text-xs font-bold uppercase text-amber-800">Mobile Money reçu</p>
                <p className="mt-2 text-2xl font-black text-amber-900">{money(remittance?.mobile ?? 0)}</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200/80">
                <p className="text-xs font-bold uppercase text-slate-500">Solde cash à remettre</p>
                <p className="mt-2 text-2xl font-black text-emerald-700">{money(remittance?.cashBalance ?? totals.cash)}</p>
              </div>
            </div>

            {/* Submission Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-amber-600">Clôture de service</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">Transmettre mon point de caisse au Gérant</h3>

              {remittance?.pending ? (
                <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900 border border-amber-200">
                  Point en attente de validation par le gérant : {money(remittance.pending.declared_cash_amount)} espèces et {money(remittance.pending.declared_mobile_amount)} MTN MoMo.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <p className="text-xs text-slate-500">
                    Indiquez le montant des espèces et du Mobile Money collectés pendant votre service :
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">Espèces remises au Gérant (XOF)</label>
                      <input
                        type="number"
                        min="0"
                        value={declaredCashAmount}
                        onChange={(e) => setDeclaredCashAmount(e.target.value)}
                        placeholder="0"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base font-black text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700">Mobile Money contrôlé (XOF)</label>
                      <input
                        type="number"
                        min="0"
                        value={declaredMobileAmount}
                        onChange={(e) => setDeclaredMobileAmount(e.target.value)}
                        placeholder="0"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base font-black text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy || !remittance || (remittance.cashBalance <= 0 && Number(declaredMobileAmount || 0) <= 0)}
                    onClick={() => void submitRemittance()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3.5 text-sm font-black text-white shadow-md hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <span>Transmettre le point au Gérant</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: PERMANENCE */}
        {tab === "permanence" && (
          <div className="max-w-xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-amber-600">Planning & Présence</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Mes Horaires de Service</h3>
            <div className="mt-6 space-y-3 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Heure de début</span>
                <span className="font-black text-slate-900">{data.employee?.service_start_time || "Non défini"}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Heure de fin</span>
                <span className="font-black text-slate-900">{data.employee?.service_end_time || "Non défini"}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500">Jour de repos</span>
                <span className="font-black text-emerald-700">
                  {data.employee?.rest_day !== null && data.employee?.rest_day !== undefined
                    ? days[data.employee.rest_day]
                    : "Non défini"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PROFIL */}
        {tab === "profile" && (
          <div className="max-w-xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-amber-600">Compte Personnel</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              {data.employee?.first_name} {data.employee?.last_name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Poste : {data.employee?.position || "Serveuse / Serveur"} · {companyName}
            </p>
          </div>
        )}

        {/* POPUP MODAL: PAIEMENT & ENCAISSEMENT AVEC TOUCHES BILLETS RAPIDES */}
        {paymentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 p-5 text-white">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                    Règlement Facture · Table {paymentOrder.table_label || "Libre"}
                  </span>
                  <h3 className="text-xl font-black">{customerName(paymentOrder)}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentOrder(null)}
                  className="rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                {/* Amount to pay banner */}
                <div className="rounded-2xl bg-emerald-50 p-4 text-center border border-emerald-200">
                  <p className="text-xs font-bold uppercase text-emerald-800">Montant total restant à régler</p>
                  <p className="mt-1 text-3xl font-black text-emerald-900">{money(orderRemaining(paymentOrder))}</p>
                </div>

                {/* Quick Banknotes Presets */}
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2">Touches billets rapides :</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {[
                      { label: "Montant Exact", val: orderRemaining(paymentOrder) },
                      { label: "1 000 F", val: 1000 },
                      { label: "2 000 F", val: 2000 },
                      { label: "5 000 F", val: 5000 },
                      { label: "10 000 F", val: 10000 },
                      { label: "20 000 F", val: 20000 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => {
                          setCashAmount(String(btn.val));
                          setMobileAmount("");
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-1 text-center font-black text-xs text-slate-800 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change Helper */}
                {Number(cashAmount || 0) > orderRemaining(paymentOrder) && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-3.5 text-center border border-amber-200">
                    <span className="text-xs font-bold text-amber-800">Monnaie à rendre au client :</span>
                    <p className="text-2xl font-black text-amber-900">
                      {money(Number(cashAmount) - orderRemaining(paymentOrder))}
                    </p>
                  </div>
                )}

                {/* Direct Numeric Inputs */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Part en Espèces (XOF)</label>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="0"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-lg font-black text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Part Mobile Money (XOF)</label>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={mobileAmount}
                      onChange={(e) => setMobileAmount(e.target.value)}
                      placeholder="0"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-lg font-black text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {Number(mobileAmount || 0) > 0 && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-700">Numéro MTN MoMo du client</label>
                    <input
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="Ex: 97000000"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentOrder(null)}
                    className="rounded-xl px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void pay()}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3.5 text-sm font-black text-white shadow-lg hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50"
                  >
                    {busy ? (
                      <span>Validation en cours…</span>
                    ) : (
                      <>
                        <span>Confirmer le règlement</span>
                        <Check className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {printingOrder && <ServeurTicket order={printingOrder} />}
    </>
  );
}

export function ServeurTicket({ order }: { order: Order }) {
  return (
    <div className="mx-auto hidden w-[80mm] bg-white p-4 text-black print:block">
      <h1 className="text-center text-lg font-black">DebitManager</h1>
      <p className="text-center text-xs">{order.order_number}</p>
      <p className="mt-3 text-xs">Table : {order.table_label ?? "—"}</p>
      <div className="my-3 border-t border-dashed border-black" />
      {(order.order_items ?? []).map((item) => (
        <div key={item.id} className="flex justify-between gap-2 text-xs">
          <span>
            {item.quantity} × {item.product_name}
          </span>
          <span>{money(item.total_price)}</span>
        </div>
      ))}
      <div className="my-3 border-t border-dashed border-black" />
      <div className="flex justify-between text-sm font-black">
        <span>Total</span>
        <span>{money(order.total_amount)}</span>
      </div>
      <p className="mt-5 text-center text-[10px]">Merci pour votre visite.</p>
    </div>
  );
}
