"use client";

import { useEffect, useState, useMemo } from "react";

type Store = { id: string; name: string; store_type?: string };
type Supplier = { id: string; name: string; phone?: string; email?: string; payment_terms_days?: number };

type StockSuggestion = {
  productId: string;
  name: string;
  internalCode: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQty: number;
  estimatedCostXof: number;
  supplierId?: string;
};

type PurchaseRequestItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity_requested: number;
  estimated_unit_price_xof: number;
  notes?: string;
};

type PurchaseRequest = {
  id: string;
  request_number: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CONVERTED";
  priority: "LOW" | "NORMAL" | "URGENT";
  total_estimated_amount_xof: number;
  notes?: string;
  created_at: string;
  store_id?: string;
  supplier_id?: string;
  purchase_request_items?: PurchaseRequestItem[];
};

type PurchaseOrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price_xof: number;
  tax_rate_basis_points: number;
  total_line_xof: number;
};

type PurchaseOrder = {
  id: string;
  order_number: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  total_subtotal_xof: number;
  landed_costs_xof: number;
  total_tax_xof: number;
  total_amount_xof: number;
  payment_terms?: string;
  expected_delivery_date?: string;
  notes?: string;
  created_at: string;
  supplier_id: string;
  store_id?: string;
  purchase_request_id?: string;
  purchase_order_items?: PurchaseOrderItem[];
};

type GoodsReceiptItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity_received: number;
  unit_cost_xof: number;
  total_cost_xof: number;
};

type GoodsReceipt = {
  id: string;
  receipt_number: string;
  purchase_order_id: string;
  supplier_id: string;
  store_id: string;
  supplier_invoice_ref?: string;
  status: string;
  landed_costs_applied_xof: number;
  notes?: string;
  received_at: string;
  goods_receipt_items?: GoodsReceiptItem[];
};

type TransferItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity_requested: number;
  quantity_shipped: number;
  quantity_received: number;
};

type StoreTransfer = {
  id: string;
  transfer_number: string;
  source_store_id: string;
  destination_store_id: string;
  status: "REQUESTED" | "APPROVED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  notes?: string;
  created_at: string;
  shipped_at?: string;
  received_at?: string;
  commerce_transfer_items?: TransferItem[];
};

export function ApprovisionnementClient({
  tenantId,
  companyName,
  userRole,
}: {
  tenantId: string;
  companyName: string;
  userRole: string;
}) {
  const [tab, setTab] = useState<"suggestions" | "requests" | "orders" | "receipts" | "transfers">("suggestions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Données
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [transfers, setTransfers] = useState<StoreTransfer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  // Modals & Forms
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showNewTransferModal, setShowNewTransferModal] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<PurchaseOrder | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<PurchaseOrder | null>(null);

  // Form state Demande d'Achat
  const [reqStoreId, setReqStoreId] = useState("");
  const [reqSupplierId, setReqSupplierId] = useState("");
  const [reqPriority, setReqPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [reqNotes, setReqNotes] = useState("");
  const [reqItems, setReqItems] = useState<{ productId: string; productName: string; quantityRequested: number; estimatedUnitPriceXof: number }[]>([]);

  // Form state Commande Fournisseur
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poStoreId, setPoStoreId] = useState("");
  const [poPurchaseReqId, setPoPurchaseReqId] = useState<string | null>(null);
  const [poPaymentTerms, setPoPaymentTerms] = useState("Comptant à la livraison");
  const [poLandedCosts, setPoLandedCosts] = useState<number>(0);
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<{ productId: string; productName: string; quantityOrdered: number; unitPriceXof: number; taxRateBasisPoints: number }[]>([]);

  // Form state Réception 3-voies
  const [recInvoiceRef, setRecInvoiceRef] = useState("");
  const [recLandedCosts, setRecLandedCosts] = useState(0);
  const [recNotes, setRecNotes] = useState("");
  const [recItems, setRecItems] = useState<{ purchaseOrderItemId: string; productId: string; productName: string; quantityReceived: number; unitCostXof: number }[]>([]);

  // Form state Transfert
  const [trfSourceStoreId, setTrfSourceStoreId] = useState("");
  const [trfDestStoreId, setTrfDestStoreId] = useState("");
  const [trfNotes, setTrfNotes] = useState("");
  const [trfItems, setTrfItems] = useState<{ productId: string; productName: string; quantityRequested: number }[]>([]);

  // Charger toutes les données
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, poRes, recRes, trfRes] = await Promise.all([
        fetch("/api/commerce/procurement/requests"),
        fetch("/api/commerce/procurement/orders"),
        fetch("/api/commerce/procurement/receipts"),
        fetch("/api/commerce/transfers"),
      ]);

      if (reqRes.ok) {
        const d = await reqRes.json();
        setRequests(d.requests || []);
        setSuggestions(d.suggestions || []);
        setSuppliers(d.suppliers || []);
        setStores(d.stores || []);
      }
      if (poRes.ok) {
        const d = await poRes.json();
        setOrders(d.orders || []);
      }
      if (recRes.ok) {
        const d = await recRes.json();
        setReceipts(d.receipts || []);
      }
      if (trfRes.ok) {
        const d = await trfRes.json();
        setTransfers(d.transfers || []);
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Déclencher une DA à partir d'une suggestion
  function initDaFromSuggestion(sug: StockSuggestion) {
    setReqItems([
      {
        productId: sug.productId,
        productName: sug.name,
        quantityRequested: sug.suggestedQty,
        estimatedUnitPriceXof: sug.estimatedCostXof,
      },
    ]);
    if (sug.supplierId) setReqSupplierId(sug.supplierId);
    setShowNewRequestModal(true);
  }

  // Soumission Demande d'Achat
  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (reqItems.length === 0) {
      alert("Ajoutez au moins un article.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/commerce/procurement/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: reqStoreId || null,
          supplierId: reqSupplierId || null,
          priority: reqPriority,
          notes: reqNotes,
          items: reqItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de création de la DA.");
        return;
      }
      setSuccessMsg(data.message);
      setShowNewRequestModal(false);
      setReqItems([]);
      setReqNotes("");
      loadData();
    } catch {
      setError("Erreur réseau lors de la création de la DA.");
    }
  }

  // Convertir une DA en Bon de Commande Fournisseur
  function convertRequestToOrder(da: PurchaseRequest) {
    setPoPurchaseReqId(da.id);
    if (da.supplier_id) setPoSupplierId(da.supplier_id);
    if (da.store_id) setPoStoreId(da.store_id);
    setPoNotes(da.notes || "");
    const items = (da.purchase_request_items || []).map((it) => ({
      productId: it.product_id,
      productName: it.product_name,
      quantityOrdered: Number(it.quantity_requested) || 1,
      unitPriceXof: Number(it.estimated_unit_price_xof) || 0,
      taxRateBasisPoints: 0,
    }));
    setPoItems(items);
    setShowNewOrderModal(true);
  }

  // Soumission Bon de Commande Fournisseur
  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!poSupplierId) {
      alert("Veuillez sélectionner un fournisseur.");
      return;
    }
    if (poItems.length === 0) {
      alert("Le bon de commande doit comporter au moins un article.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/commerce/procurement/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: poSupplierId,
          storeId: poStoreId || null,
          purchaseRequestId: poPurchaseReqId,
          paymentTerms: poPaymentTerms,
          landedCostsXof: poLandedCosts,
          notes: poNotes,
          items: poItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de l'enregistrement du bon de commande.");
        return;
      }
      setSuccessMsg(data.message);
      setShowNewOrderModal(false);
      setPoItems([]);
      setPoNotes("");
      loadData();
    } catch {
      setError("Erreur réseau lors de la création du BC.");
    }
  }

  // Approbation d'une commande par le gérant/promoteur
  async function handleApproveOrder(orderId: string) {
    try {
      const res = await fetch(`/api/commerce/procurement/orders/${orderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        loadData();
      } else {
        setError(data.error || "Échec de validation de la commande.");
      }
    } catch {
      setError("Erreur réseau lors de l'approbation.");
    }
  }

  // Ouvrir le modal de réception 3-voies sur un BC
  function openReceiptModal(order: PurchaseOrder) {
    setSelectedOrderForReceipt(order);
    setRecInvoiceRef("");
    setRecLandedCosts(0);
    setRecNotes("");
    const items = (order.purchase_order_items || []).map((it) => {
      const remaining = Math.max(0, (Number(it.quantity_ordered) || 0) - (Number(it.quantity_received) || 0));
      return {
        purchaseOrderItemId: it.id,
        productId: it.product_id,
        productName: it.product_name,
        quantityReceived: remaining,
        unitCostXof: Number(it.unit_price_xof) || 0,
      };
    });
    setRecItems(items);
    setShowReceiveModal(true);
  }

  // Soumission Bon de Réception (3-voies)
  async function handleConfirmReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderForReceipt) return;

    setError(null);
    try {
      const res = await fetch("/api/commerce/procurement/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: selectedOrderForReceipt.id,
          storeId: selectedOrderForReceipt.store_id || stores[0]?.id,
          supplierInvoiceRef: recInvoiceRef,
          landedCostsAppliedXof: recLandedCosts,
          notes: recNotes,
          items: recItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de validation de la réception.");
        return;
      }
      setSuccessMsg(data.message);
      setShowReceiveModal(false);
      setSelectedOrderForReceipt(null);
      loadData();
    } catch {
      setError("Erreur réseau lors de la réception.");
    }
  }

  // Soumission Transfert Inter-Magasins
  async function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!trfSourceStoreId || !trfDestStoreId) {
      alert("Sélectionnez le magasin source et le magasin cible.");
      return;
    }
    if (trfSourceStoreId === trfDestStoreId) {
      alert("Le magasin source et la destination doivent être distincts.");
      return;
    }
    if (trfItems.length === 0) {
      alert("Le transfert doit comporter au moins un article.");
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/commerce/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceStoreId: trfSourceStoreId,
          destinationStoreId: trfDestStoreId,
          notes: trfNotes,
          items: trfItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de la demande de transfert.");
        return;
      }
      setSuccessMsg(data.message);
      setShowNewTransferModal(false);
      setTrfItems([]);
      setTrfNotes("");
      loadData();
    } catch {
      setError("Erreur réseau lors du transfert.");
    }
  }

  // Action expédier / réceptionner transfert
  async function handleTransferAction(transferId: string, action: "SHIP" | "RECEIVE") {
    setError(null);
    try {
      const res = await fetch("/api/commerce/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        loadData();
      } else {
        setError(data.error || "Impossible d'exécuter l'action.");
      }
    } catch {
      setError("Erreur réseau lors de l'action de transfert.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-emerald-950 via-[#063327] to-slate-900 p-6 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-xs font-black text-amber-300">
              MODULE COMMERCE · SPRINT 7
            </span>
            <span className="text-xs text-emerald-300/70">Rôle : {userRole}</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>📥</span> Espace Approvisionnements & Dépôts
          </h1>
          <p className="mt-1 text-xs text-emerald-200/80">
            {companyName} · Demandes d’achat, commandes fournisseurs, réceptions 3-voies & transferts inter-magasins
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setReqItems([]);
              setShowNewRequestModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500 shadow-md transition"
          >
            <span>📝</span> Nouvelle DA
          </button>
          <button
            onClick={() => {
              setPoItems([]);
              setPoPurchaseReqId(null);
              setShowNewOrderModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 shadow-md transition"
          >
            <span>📦</span> Nouveau Bon de Commande
          </button>
          <button
            onClick={() => {
              setTrfItems([]);
              setShowNewTransferModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-black text-white hover:bg-white/20 transition"
          >
            <span>🔄</span> Transfert Dépôts
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 shadow-sm flex items-center justify-between">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 shadow-sm flex items-center justify-between">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setTab("suggestions")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "suggestions"
              ? "bg-emerald-800 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>💡</span> Suggestions Stock Bas
          {suggestions.length > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">
              {suggestions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "requests"
              ? "bg-emerald-800 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📝</span> Demandes d’Achat (DA)
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
            {requests.length}
          </span>
        </button>
        <button
          onClick={() => setTab("orders")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "orders"
              ? "bg-emerald-800 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📦</span> Bons de Commande (BC)
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
            {orders.length}
          </span>
        </button>
        <button
          onClick={() => setTab("receipts")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "receipts"
              ? "bg-emerald-800 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📥</span> Réceptions (BR) & Rapprochement
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
            {receipts.length}
          </span>
        </button>
        <button
          onClick={() => setTab("transfers")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "transfers"
              ? "bg-emerald-800 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>🔄</span> Transferts Dépôts
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
            {transfers.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Suggestions Stock Bas */}
      {tab === "suggestions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Alertes de Réapprovisionnement Automatique
            </h2>
            <span className="text-xs text-slate-500">
              Basé sur les seuils d’alerte et points de commande du catalogue
            </span>
          </div>

          {suggestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <span className="text-3xl">🎉</span>
              <p className="mt-2 text-sm font-bold text-slate-700">Aucun produit sous le seuil d’alerte.</p>
              <p className="text-xs text-slate-400 mt-1">Tous les stocks sont à des niveaux optimaux.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((sug) => (
                <div key={sug.productId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-400 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                        RUPTURE / FAIBLE
                      </span>
                      <h3 className="mt-2 text-sm font-black text-slate-900">{sug.name}</h3>
                      <p className="text-xs text-slate-400">Réf : {sug.internalCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Stock actuel</p>
                      <p className="text-lg font-black text-rose-600">{sug.currentStock}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <p className="text-slate-400">Point de réappro</p>
                      <p className="font-bold text-slate-700">{sug.reorderPoint} unités</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">Qté suggérée</p>
                      <p className="font-bold text-emerald-700">+{sug.suggestedQty} unités</p>
                    </div>
                  </div>

                  <button
                    onClick={() => initDaFromSuggestion(sug)}
                    className="mt-4 w-full rounded-xl bg-emerald-800 py-2 text-xs font-black text-white hover:bg-emerald-700 transition"
                  >
                    + Générer Demande d’Achat
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Demandes d'Achat (DA) */}
      {tab === "requests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Historique des Demandes d’Achat (DA)
            </h2>
            <button
              onClick={() => {
                setReqItems([]);
                setShowNewRequestModal(true);
              }}
              className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700"
            >
              + Nouvelle Demande d’Achat
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-black text-slate-600">
                <tr>
                  <th className="p-3">Numéro DA</th>
                  <th className="p-3">Priorité</th>
                  <th className="p-3">Articles</th>
                  <th className="p-3">Montant Estimé</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="p-3 font-black text-emerald-900">{req.request_number}</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-black ${
                        req.priority === "URGENT" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                      }`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-900">
                        {req.purchase_request_items?.length || 0} référence(s)
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {req.purchase_request_items?.map((it) => `${it.product_name} (${it.quantity_requested})`).join(", ")}
                      </p>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {new Intl.NumberFormat("fr-FR").format(req.total_estimated_amount_xof)} FCFA
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        req.status === "CONVERTED"
                          ? "bg-purple-100 text-purple-700"
                          : req.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {req.status === "CONVERTED" ? "Convertie en BC" : req.status === "APPROVED" ? "Approuvée" : "En attente"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(req.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="p-3 text-right">
                      {req.status !== "CONVERTED" && (
                        <button
                          onClick={() => convertRequestToOrder(req)}
                          className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-black text-slate-950 hover:bg-amber-400"
                        >
                          Créer Bon de Commande
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Aucune demande d’achat enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Bons de Commande (BC) */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Bons de Commande Fournisseur (BC)
            </h2>
            <button
              onClick={() => {
                setPoItems([]);
                setPoPurchaseReqId(null);
                setShowNewOrderModal(true);
              }}
              className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-400"
            >
              + Nouveau Bon de Commande
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-black text-slate-600">
                <tr>
                  <th className="p-3">Numéro BC</th>
                  <th className="p-3">Fournisseur</th>
                  <th className="p-3">Lignes</th>
                  <th className="p-3">Montant Total</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {orders.map((po) => {
                  const sup = suppliers.find((s) => s.id === po.supplier_id);
                  return (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-emerald-900">{po.order_number}</td>
                      <td className="p-3 font-bold text-slate-900">{sup?.name || "Fournisseur"}</td>
                      <td className="p-3 text-slate-500">
                        {po.purchase_order_items?.length || 0} produit(s)
                      </td>
                      <td className="p-3 font-black text-slate-900">
                        {new Intl.NumberFormat("fr-FR").format(po.total_amount_xof)} FCFA
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          po.status === "RECEIVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : po.status === "PARTIALLY_RECEIVED"
                            ? "bg-blue-100 text-blue-800"
                            : po.status === "PENDING_APPROVAL"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {po.status === "PENDING_APPROVAL"
                            ? "Validation Promoteur Requise"
                            : po.status === "RECEIVED"
                            ? "Totalement Reçu"
                            : po.status === "PARTIALLY_RECEIVED"
                            ? "Partiellement Reçu"
                            : po.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(po.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {po.status === "PENDING_APPROVAL" && (userRole === "ADMINISTRATEUR" || userRole === "GERANT") && (
                          <button
                            onClick={() => handleApproveOrder(po.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-black text-white hover:bg-emerald-500"
                          >
                            Approuver
                          </button>
                        )}
                        <button
                          onClick={() => setOrderToPrint(po)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Imprimer A4
                        </button>
                        {po.status !== "RECEIVED" && po.status !== "CANCELLED" && po.status !== "PENDING_APPROVAL" && (
                          <button
                            onClick={() => openReceiptModal(po)}
                            className="rounded-lg bg-emerald-800 px-2.5 py-1 text-xs font-black text-white hover:bg-emerald-700"
                          >
                            Réceptionner (BR)
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Aucun bon de commande fournisseur enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Réceptions (BR) & Contrôle 3-voies */}
      {tab === "receipts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Bons de Réception Fournisseur (BR) & Rapprochement
            </h2>
            <span className="text-xs text-slate-500">
              Contrôle physique des quantités livrées, saisie facture fournisseur & entrée en stock
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-black text-slate-600">
                <tr>
                  <th className="p-3">Numéro BR</th>
                  <th className="p-3">Réf Facture Fournisseur</th>
                  <th className="p-3">Articles Réceptionnés</th>
                  <th className="p-3">Frais d’Approche Affectés</th>
                  <th className="p-3">Date Réception</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {receipts.map((br) => (
                  <tr key={br.id} className="hover:bg-slate-50">
                    <td className="p-3 font-black text-emerald-900">{br.receipt_number}</td>
                    <td className="p-3 font-bold text-slate-900">{br.supplier_invoice_ref || "N/A"}</td>
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{br.goods_receipt_items?.length || 0} ligne(s)</p>
                      <p className="text-[11px] text-slate-400">
                        {br.goods_receipt_items?.map((it) => `${it.product_name} (${it.quantity_received} à ${it.unit_cost_xof} F)`).join(", ")}
                      </p>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {new Intl.NumberFormat("fr-FR").format(br.landed_costs_applied_xof)} FCFA
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(br.received_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                        Stock Entré & CMP Recalculé
                      </span>
                    </td>
                  </tr>
                ))}
                {receipts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Aucune réception enregistrée. Pour réceptionner, cliquez sur « Réceptionner (BR) » dans l’onglet Bons de Commande.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Transferts inter-magasins */}
      {tab === "transfers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Transferts Inter-Magasins & Dépôts
            </h2>
            <button
              onClick={() => {
                setTrfItems([]);
                setShowNewTransferModal(true);
              }}
              className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700"
            >
              + Nouveau Transfert
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-black text-slate-600">
                <tr>
                  <th className="p-3">Numéro TRF</th>
                  <th className="p-3">Départ (Source)</th>
                  <th className="p-3">Arrivée (Cible)</th>
                  <th className="p-3">Lignes transférées</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {transfers.map((trf) => {
                  const source = stores.find((s) => s.id === trf.source_store_id);
                  const dest = stores.find((s) => s.id === trf.destination_store_id);
                  return (
                    <tr key={trf.id} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-emerald-900">{trf.transfer_number}</td>
                      <td className="p-3 font-bold text-slate-800">{source?.name || "Dépôt A"}</td>
                      <td className="p-3 font-bold text-slate-800">{dest?.name || "Dépôt B"}</td>
                      <td className="p-3 text-slate-500">
                        {trf.commerce_transfer_items?.map((it) => `${it.product_name} (${it.quantity_requested})`).join(", ")}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          trf.status === "RECEIVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : trf.status === "IN_TRANSIT"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {trf.status === "IN_TRANSIT" ? "En Transit" : trf.status === "RECEIVED" ? "Reçu" : "Demandé"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(trf.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {trf.status === "REQUESTED" && (
                          <button
                            onClick={() => handleTransferAction(trf.id, "SHIP")}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-black text-white hover:bg-blue-500"
                          >
                            Expédier Sortie
                          </button>
                        )}
                        {trf.status === "IN_TRANSIT" && (
                          <button
                            onClick={() => handleTransferAction(trf.id, "RECEIVE")}
                            className="rounded-lg bg-emerald-800 px-2.5 py-1 text-xs font-black text-white hover:bg-emerald-700"
                          >
                            Confirmer Réception
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Aucun transfert de stock enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Nouvelle Demande d'Achat (DA) */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Émettre une Demande d’Achat (DA)</h3>
            <p className="mt-1 text-xs text-slate-500">Document interne d’expression de besoin d’approvisionnement</p>

            <form onSubmit={handleCreateRequest} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Magasin demandeur</label>
                  <select
                    value={reqStoreId}
                    onChange={(e) => setReqStoreId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  >
                    <option value="">Sélectionner un magasin...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Priorité</label>
                  <select
                    value={reqPriority}
                    onChange={(e) => setReqPriority(e.target.value as typeof reqPriority)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  >
                    <option value="NORMAL">Normale</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Fournisseur recommandé (optionnel)</label>
                <select
                  value={reqSupplierId}
                  onChange={(e) => setReqSupplierId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                >
                  <option value="">Non déterminé</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Lignes d'articles */}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Articles à commander</label>
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Nom de l'article :");
                      if (name) {
                        const qty = Number(prompt("Quantité souhaitée :") || "1");
                        const price = Number(prompt("Prix unitaire estimé (FCFA) :") || "0");
                        setReqItems([...reqItems, { productId: "manual-" + Date.now(), productName: name, quantityRequested: qty, estimatedUnitPriceXof: price }]);
                      }
                    }}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    + Ajouter une ligne
                  </button>
                </div>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {reqItems.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{it.productName}</p>
                        <p className="text-[11px] text-slate-500">Qté : {it.quantityRequested} · Estimé : {it.estimatedUnitPriceXof} F</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReqItems(reqItems.filter((_, i) => i !== idx))}
                        className="text-rose-500 font-bold hover:text-rose-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {reqItems.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Aucun article dans cette demande.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Notes & Justification</label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
                  placeholder="Justification du besoin..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                >
                  Créer la Demande d’Achat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Nouveau Bon de Commande (BC) */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Émettre un Bon de Commande Fournisseur (BC)</h3>
            <p className="mt-1 text-xs text-slate-500">Contrat officiel d’achat avec numérotation séquentielle et ventilation de coûts</p>

            <form onSubmit={handleCreateOrder} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Fournisseur *</label>
                  <select
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  >
                    <option value="">Sélectionner un fournisseur...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.phone || s.email || "Contact"})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Magasin de livraison</label>
                  <select
                    value={poStoreId}
                    onChange={(e) => setPoStoreId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  >
                    <option value="">Magasin principal par défaut</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Conditions de paiement</label>
                  <input
                    type="text"
                    value={poPaymentTerms}
                    onChange={(e) => setPoPaymentTerms(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Frais d’approche prévus (Transport, Douane FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    value={poLandedCosts}
                    onChange={(e) => setPoLandedCosts(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Lignes du Bon de commande */}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Articles commandés</label>
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Nom de l'article :");
                      if (name) {
                        const qty = Number(prompt("Quantité :") || "1");
                        const price = Number(prompt("Prix unitaire d'achat convenu (FCFA) :") || "0");
                        setPoItems([...poItems, { productId: "manual-" + Date.now(), productName: name, quantityOrdered: qty, unitPriceXof: price, taxRateBasisPoints: 0 }]);
                      }
                    }}
                    className="text-xs font-bold text-amber-700 hover:underline"
                  >
                    + Ajouter une ligne
                  </button>
                </div>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {poItems.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{it.productName}</p>
                        <p className="text-[11px] text-slate-500">
                          {it.quantityOrdered} unités × {new Intl.NumberFormat("fr-FR").format(it.unitPriceXof)} FCFA ={" "}
                          <span className="font-bold text-slate-900">
                            {new Intl.NumberFormat("fr-FR").format(it.quantityOrdered * it.unitPriceXof)} FCFA
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                        className="text-rose-500 font-bold hover:text-rose-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-400"
                >
                  Valider le Bon de Commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Réception 3-voies & Entrée en Stock */}
      {showReceiveModal && selectedOrderForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Réception Marchandise (BR) · Contrôle 3-voies</h3>
            <p className="mt-1 text-xs text-slate-500">
              Commande {selectedOrderForReceipt.order_number} · Contrôlez les quantités physiques et renseignez la facture fournisseur.
            </p>

            <form onSubmit={handleConfirmReceipt} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Réf Facture / BL Fournisseur *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: FAC-FOURN-9842"
                    value={recInvoiceRef}
                    onChange={(e) => setRecInvoiceRef(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Frais d’approche réels (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    value={recLandedCosts}
                    onChange={(e) => setRecLandedCosts(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Lignes à réceptionner */}
              <div className="border-t border-slate-200 pt-3">
                <label className="text-xs font-bold text-slate-700">Quantités physiques réellement réceptionnées</label>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {recItems.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-800">{it.productName}</p>
                        <p className="text-[11px] text-slate-400">Coût unitaire convenu : {it.unitCostXof} FCFA</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-500">Qté Reçue :</label>
                        <input
                          type="number"
                          min={0}
                          value={it.quantityReceived}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...recItems];
                            updated[idx].quantityReceived = val;
                            setRecItems(updated);
                          }}
                          className="w-20 rounded-lg border border-slate-300 p-1 text-center font-bold text-emerald-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                >
                  Confirmer la Réception & Entrée Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Nouveau Transfert Inter-Magasins */}
      {showNewTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Demande de Transfert Inter-Magasins</h3>
            <p className="mt-1 text-xs text-slate-500">Acheminement de marchandise d’un magasin source vers un magasin cible</p>

            <form onSubmit={handleCreateTransfer} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Magasin Source (Départ) *</label>
                  <select
                    value={trfSourceStoreId}
                    onChange={(e) => setTrfSourceStoreId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  >
                    <option value="">Sélectionner magasin source...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Magasin Cible (Destination) *</label>
                  <select
                    value={trfDestStoreId}
                    onChange={(e) => setTrfDestStoreId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  >
                    <option value="">Sélectionner destination...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lignes d'articles à transférer */}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Articles à transférer</label>
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Nom de l'article à transférer :");
                      if (name) {
                        const qty = Number(prompt("Quantité à transférer :") || "1");
                        setTrfItems([...trfItems, { productId: "manual-" + Date.now(), productName: name, quantityRequested: qty }]);
                      }
                    }}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    + Ajouter une ligne
                  </button>
                </div>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                  {trfItems.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs">
                      <p className="font-bold text-slate-800">{it.productName}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-800">{it.quantityRequested} unités</span>
                        <button
                          type="button"
                          onClick={() => setTrfItems(trfItems.filter((_, i) => i !== idx))}
                          className="text-rose-500 font-bold hover:text-rose-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Instructions / Notes de transport</label>
                <textarea
                  value={trfNotes}
                  onChange={(e) => setTrfNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTransferModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                >
                  Créer la Demande de Transfert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Impression A4 du Bon de Commande Fournisseur */}
      {orderToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl">
            <div className="flex justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">{companyName}</h2>
                <p className="text-xs text-slate-500">Système de Gestion Commerciale DebitMaster PRO</p>
                <p className="text-xs text-slate-500">Date : {new Date(orderToPrint.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">
                  BON DE COMMANDE FOURNISSEUR
                </span>
                <p className="mt-1 text-lg font-black text-emerald-900">{orderToPrint.order_number}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6 rounded-xl bg-slate-50 p-4 text-xs">
              <div>
                <p className="font-black text-slate-400 uppercase">Fournisseur</p>
                <p className="text-sm font-black text-slate-900 mt-1">
                  {suppliers.find((s) => s.id === orderToPrint.supplier_id)?.name || "Fournisseur Partenaire"}
                </p>
                <p className="text-slate-500">{suppliers.find((s) => s.id === orderToPrint.supplier_id)?.phone || ""}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-400 uppercase">Conditions</p>
                <p className="text-xs font-bold text-slate-800 mt-1">
                  Paiement : {orderToPrint.payment_terms || "À réception"}
                </p>
                <p className="text-xs text-slate-500">
                  Livraison : {orderToPrint.expected_delivery_date || "Dès que possible"}
                </p>
              </div>
            </div>

            <table className="mt-6 w-full text-left text-xs">
              <thead className="border-b border-slate-300 bg-slate-100 font-black text-slate-700">
                <tr>
                  <th className="p-2">Désignation</th>
                  <th className="p-2 text-center">Quantité</th>
                  <th className="p-2 text-right">Prix Unitaire HT</th>
                  <th className="p-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orderToPrint.purchase_order_items?.map((it) => (
                  <tr key={it.id}>
                    <td className="p-2 font-bold text-slate-800">{it.product_name}</td>
                    <td className="p-2 text-center font-bold">{it.quantity_ordered}</td>
                    <td className="p-2 text-right">{new Intl.NumberFormat("fr-FR").format(it.unit_price_xof)} FCFA</td>
                    <td className="p-2 text-right font-black">{new Intl.NumberFormat("fr-FR").format(it.total_line_xof)} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Sous-total HT :</span>
                  <span>{new Intl.NumberFormat("fr-FR").format(orderToPrint.total_subtotal_xof)} FCFA</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Frais d’approche :</span>
                  <span>{new Intl.NumberFormat("fr-FR").format(orderToPrint.landed_costs_xof)} FCFA</span>
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-slate-900">
                  <span>TOTAL NET :</span>
                  <span className="text-emerald-900">{new Intl.NumberFormat("fr-FR").format(orderToPrint.total_amount_xof)} FCFA</span>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-between border-t border-slate-200 pt-6 text-xs text-slate-500">
              <div className="text-center">
                <p className="font-bold">Pour l’Établissement</p>
                <div className="mt-12 h-0.5 w-32 bg-slate-300 mx-auto" />
                <p className="text-[10px] mt-1">Visa & Signature</p>
              </div>
              <div className="text-center">
                <p className="font-bold">Bon pour Accord Fournisseur</p>
                <div className="mt-12 h-0.5 w-32 bg-slate-300 mx-auto" />
                <p className="text-[10px] mt-1">Cachet & Signature</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                onClick={() => setOrderToPrint(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                🖨 Imprimer A4
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
