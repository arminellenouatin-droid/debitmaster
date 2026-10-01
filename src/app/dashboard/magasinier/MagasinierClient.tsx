"use client";

import { useEffect, useState } from "react";

type DeliveryNote = {
  id: string;
  delivery_number: string;
  order_id: string;
  customer_name: string;
  status: "PENDING" | "PREPARED" | "PARTIALLY_DELIVERED" | "DELIVERED" | "CANCELLED";
  pickup_code?: string;
  recipient_name?: string;
  delivered_at?: string;
  created_at: string;
  delivery_note_items?: {
    id: string;
    product_name: string;
    quantity_ordered: number;
    quantity_delivered: number;
  }[];
};

type PendingOrder = {
  id: string;
  invoice_number?: string;
  customer_name?: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  status: string;
  created_at: string;
  order_items?: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

type CustomerReturn = {
  id: string;
  return_number: string;
  order_id: string;
  customer_name: string;
  return_reason: string;
  total_refund_amount: number;
  created_at: string;
  customer_return_items?: {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    condition: string;
  }[];
};

export function MagasinierClient({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [activeTab, setActiveTab] = useState<"DELIVERIES" | "RETURNS" | "OUT">("DELIVERIES");
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modales
  const [confirmingDn, setConfirmingDn] = useState<DeliveryNote | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [pickupCode, setPickupCode] = useState("");
  const [confirmingLoading, setConfirmingLoading] = useState(false);

  const [printedBl, setPrintedBl] = useState<any | null>(null);

  // Modal Retour
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnItemName, setReturnItemName] = useState("");
  const [returnItemQty, setReturnItemQty] = useState(1);
  const [returnItemPrice, setReturnItemPrice] = useState(0);
  const [returnItemCondition, setReturnItemCondition] = useState<"RESTOCKED" | "SCRAPPED">("RESTOCKED");

  // Modal Sortie diverse
  const [showOutModal, setShowOutModal] = useState(false);
  const [outReason, setOutReason] = useState("");
  const [outQty, setOutQty] = useState(1);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/commerce/deliveries");
      const data = await res.json();
      if (res.ok) {
        setDeliveryNotes(data.deliveryNotes || []);
        setPendingOrders(data.pendingOrders || []);
      }

      const retRes = await fetch("/api/commerce/returns");
      const retData = await retRes.json();
      if (retRes.ok) {
        setReturns(retData.returns || []);
      }
    } catch {
      setMessage({ text: "Erreur lors du chargement des livraisons.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateDeliveryNote(orderId: string) {
    try {
      const res = await fetch("/api/commerce/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de préparer le bon de livraison.");
      setMessage({ text: `Bon de livraison ${data.deliveryNote.delivery_number} généré !`, type: "success" });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    }
  }

  async function handleConfirmDelivery() {
    if (!confirmingDn) return;
    setConfirmingLoading(true);
    try {
      const res = await fetch(`/api/commerce/deliveries/${confirmingDn.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          pickupCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validation de livraison échouée.");
      setPrintedBl(data.printPayload);
      setConfirmingDn(null);
      setMessage({ text: `Livraison ${confirmingDn.delivery_number} confirmée avec sortie de stock !`, type: "success" });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setConfirmingLoading(false);
    }
  }

  async function handleSubmitReturn() {
    if (!returnOrderId || !returnReason) return;
    try {
      const res = await fetch("/api/commerce/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: returnOrderId,
          returnReason,
          items: [
            {
              productName: returnItemName || "Article retourné",
              quantity: returnItemQty,
              unitPrice: returnItemPrice,
              condition: returnItemCondition,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'enregistrement du retour.");
      setShowReturnModal(false);
      setMessage({
        text: `Retour client enregistré ! Avoir n° ${data.creditNote?.credit_note_number || "généré"} émis.`,
        type: "success",
      });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-black text-slate-900">Espace Magasinier & Livraisons</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Préparez les commandes payées, confirmez les sorties de stock et traitez les retours clients.
          </p>
        </div>

        {/* Boutons d'actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReturnModal(true)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 transition"
          >
            ↩ Nouveau retour client
          </button>
        </div>
      </div>

      {/* Message notification */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between ${
            message.type === "success" ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Onglets */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-black">
        <button
          onClick={() => setActiveTab("DELIVERIES")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "DELIVERIES" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          📋 Commandes « À livrer » & BLs ({pendingOrders.length + deliveryNotes.filter((d) => d.status !== "DELIVERED").length})
        </button>
        <button
          onClick={() => setActiveTab("RETURNS")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "RETURNS" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          ↩ Retours marchandises & Avoirs ({returns.length})
        </button>
      </div>

      {activeTab === "DELIVERIES" && (
        <div className="space-y-6">
          {/* Section 1 : Commandes payées en attente de BL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>🔔</span> Commandes payées en caisse à préparer ({pendingOrders.length})
            </h2>

            {loading ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">Chargement...</div>
            ) : pendingOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">
                Aucune nouvelle commande en attente de préparation.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        {order.invoice_number || `COMM-${order.id.slice(0, 6)}`}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">Payée ✓</span>
                    </div>

                    <p className="text-sm font-black text-slate-900">{order.customer_name || "Client comptoir"}</p>

                    <div className="text-xs text-slate-600 space-y-1">
                      {(order.order_items || []).map((it) => (
                        <div key={it.id} className="flex justify-between">
                          <span>{it.product_name}</span>
                          <span className="font-bold">x{it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleCreateDeliveryNote(order.id)}
                      className="w-full py-2 text-xs font-black rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
                    >
                      📄 Émettre le Bon de Livraison
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2 : Bons de Livraison émis en attente de remise client */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>🚚</span> Bons de Livraison en cours / confirmés ({deliveryNotes.length})
            </h2>

            {deliveryNotes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">Aucun bon de livraison émis.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deliveryNotes.map((dn) => (
                  <div key={dn.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-900">{dn.delivery_number}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            dn.status === "DELIVERED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {dn.status === "DELIVERED" ? "Livrée au client ✓" : "Prête pour retrait"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Client : <span className="font-bold">{dn.customer_name}</span>
                        {dn.recipient_name && ` • Réceptionné par : ${dn.recipient_name}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {dn.status !== "DELIVERED" ? (
                        <button
                          onClick={() => {
                            setConfirmingDn(dn);
                            setRecipientName(dn.customer_name || "");
                            setPickupCode("");
                          }}
                          className="px-3 py-2 text-xs font-black rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-sm"
                        >
                          ✓ Valider la remise & Sortie de stock
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setPrintedBl({
                              deliveryNumber: dn.delivery_number,
                              customerName: dn.customer_name,
                              recipientName: dn.recipient_name || dn.customer_name,
                              deliveredAt: dn.delivered_at,
                              items: dn.delivery_note_items,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 transition"
                        >
                          🖨 Imprimer BL
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "RETURNS" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
          <h2 className="text-base font-black text-slate-900">Historique des retours clients & Factures d'avoir</h2>
          {returns.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-bold text-xs">Aucun retour client enregistré.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {returns.map((ret) => (
                <div key={ret.id} className="py-3 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-black text-slate-900">{ret.return_number}</span>
                    <span className="font-black text-emerald-800">
                      {(Number(ret.total_refund_amount) || 0).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Client : <span className="font-bold">{ret.customer_name}</span> • Motif : {ret.return_reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Confirmation de livraison */}
      {confirmingDn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Confirmation de remise client</h3>
            <p className="text-xs text-slate-500">
              Cette action confirme la livraison physique et déclenche la décrémentation irréversible du stock.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Nom du réceptionnaire</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Code de retrait client (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: 8492"
                  value={pickupCode}
                  onChange={(e) => setPickupCode(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setConfirmingDn(null)}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-slate-300"
              >
                Annuler
              </button>
              <button
                disabled={confirmingLoading}
                onClick={handleConfirmDelivery}
                className="flex-1 py-2.5 text-xs font-black rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {confirmingLoading ? "Validation..." : "Confirmer livraison ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retour Client */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Enregistrer un retour client</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Identifiant de commande / facture</label>
                <input
                  type="text"
                  placeholder="ID de commande"
                  value={returnOrderId}
                  onChange={(e) => setReturnOrderId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Motif du retour</label>
                <input
                  type="text"
                  placeholder="Ex: Produit défectueux / Erreur de référence"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Quantité</label>
                  <input
                    type="number"
                    min="1"
                    value={returnItemQty}
                    onChange={(e) => setReturnItemQty(Number(e.target.value) || 1)}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Prix unitaire (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={returnItemPrice}
                    onChange={(e) => setReturnItemPrice(Number(e.target.value) || 0)}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Décision sur la marchandise</label>
                <select
                  value={returnItemCondition}
                  onChange={(e) => setReturnItemCondition(e.target.value as any)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                >
                  <option value="RESTOCKED">Remettre en stock vendable</option>
                  <option value="SCRAPPED">Mettre au rebut / Casse (pas de remise en stock)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setShowReturnModal(false)}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-slate-300"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitReturn}
                className="flex-1 py-2.5 text-xs font-black rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Générer l'avoir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impression Bon de Livraison */}
      {printedBl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center font-mono">
            <div className="text-3xl">🚚</div>
            <h3 className="text-base font-black uppercase text-slate-900">Bon de Livraison</h3>
            <p className="text-xs text-slate-500 font-bold">{printedBl.deliveryNumber}</p>

            <div className="border-t border-b border-dashed border-slate-300 py-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>Client :</span>
                <span className="font-bold">{printedBl.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Réceptionné par :</span>
                <span className="font-bold">{printedBl.recipientName}</span>
              </div>
              <div className="text-[10px] text-slate-400 pt-1">
                Date : {new Date(printedBl.deliveredAt).toLocaleString("fr-FR")}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-sans text-xs font-bold hover:bg-slate-50"
              >
                🖨 Imprimer BL (A4/Thermique)
              </button>
              <button
                onClick={() => setPrintedBl(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-sans text-xs font-black hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
