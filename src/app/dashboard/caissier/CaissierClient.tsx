"use client";

import { useEffect, useState } from "react";

type CashRegister = {
  id: string;
  name: string;
  store_id: string;
  inventory_stores?: { id: string; name: string };
  activeSession: CashSession | null;
};

type CashSession = {
  id: string;
  cash_register_id: string;
  cash_registers?: { name: string };
  opened_by_user_id: string;
  opened_at: string;
  opening_float: number;
  expected_cash: number;
  status: "OPEN" | "CLOSED";
  total_collected?: number;
};

type InvoiceItem = {
  id: string;
  invoice_number?: string;
  total_amount: number;
  amount_paid?: number;
  payment_status?: string;
  status: string;
  customer_name?: string;
  created_at: string;
  items?: { product_name: string; quantity: number; unit_price: number }[];
};

type TicketZ = {
  sessionId: string;
  openedAt: string;
  closedAt: string;
  openingFloat: number;
  totalCollected: number;
  cashPayments: number;
  netMovementAdjustment: number;
  expectedCash: number;
  closingCashCounted: number;
  cashDifference: number;
  differenceReason?: string;
  paymentsCount: number;
};

export function CaissierClient({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");

  // Modales
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [selectedRegisterId, setSelectedRegisterId] = useState("");
  const [openingFloat, setOpeningFloat] = useState(0);

  const [payingInvoice, setPayingInvoice] = useState<InvoiceItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [cashTendered, setCashTendered] = useState(0);
  const [paymentRef, setPaymentRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<"CASH_IN" | "CASH_OUT" | "EXPENSE" | "BANK_DEPOSIT">("EXPENSE");
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementReason, setMovementReason] = useState("");

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState(0);
  const [differenceReason, setDifferenceReason] = useState("");
  const [ticketZ, setTicketZ] = useState<TicketZ | null>(null);

  const [lastReceipt, setLastReceipt] = useState<any | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Charger les caisses et la session active
      const regRes = await fetch("/api/commerce/cash-registers");
      const regData = await regRes.json();
      if (regRes.ok) {
        setRegisters(regData.registers || []);
        // Vérifier si l'utilisateur a une session ouverte
        const sessRes = await fetch("/api/commerce/cash-registers/sessions?active=true");
        const sessData = await sessRes.json();
        if (sessRes.ok && sessData.myActiveSession) {
          setActiveSession(sessData.myActiveSession);
        } else {
          setActiveSession(null);
        }
      }

      // 2. Charger les factures à encaisser
      const invRes = await fetch("/api/commerce/invoices");
      const invData = await invRes.json();
      if (invRes.ok) {
        const list = invData.invoices || [];
        setInvoices(list.filter((inv: InvoiceItem) => inv.payment_status !== "PAID" && inv.status !== "CANCELLED"));
      }
    } catch {
      setMessage({ text: "Erreur lors du chargement des données.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleOpenSession() {
    if (!selectedRegisterId) return;
    try {
      const res = await fetch("/api/commerce/cash-registers/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId: selectedRegisterId,
          openingFloat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'ouvrir la caisse.");
      setShowOpenModal(false);
      setMessage({ text: "Caisse ouverte avec succès !", type: "success" });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    }
  }

  async function handleRecordPayment() {
    if (!payingInvoice) return;
    setSubmittingPayment(true);
    try {
      const res = await fetch(`/api/commerce/invoices/${payingInvoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession?.id,
          paymentMethod,
          amount: paymentAmount,
          transactionReference: paymentRef,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Paiement échoué.");

      setLastReceipt(data.receipt);
      setPayingInvoice(null);
      setMessage({ text: `Règlement de ${paymentAmount.toLocaleString("fr-FR")} FCFA enregistré !`, type: "success" });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleAddMovement() {
    if (!activeSession) return;
    try {
      const res = await fetch("/api/commerce/cash-registers/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          movementType,
          amount: movementAmount,
          reason: movementReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer le mouvement.");
      setShowMovementModal(false);
      setMovementAmount(0);
      setMovementReason("");
      setMessage({ text: "Mouvement de caisse enregistré avec succès.", type: "success" });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    }
  }

  async function handleCloseSession() {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/commerce/cash-registers/sessions/${activeSession.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCashCounted: countedCash,
          differenceReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de clôture.");
      setShowCloseModal(false);
      setTicketZ(data.ticketZ);
      setActiveSession(null);
      setMessage({ text: "Caisse clôturée avec succès ! Le Ticket Z est disponible.", type: "success" });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    }
  }

  const filteredInvoices = invoices.filter((inv) => {
    const q = filterQuery.toLowerCase();
    const num = (inv.invoice_number || "").toLowerCase();
    const client = (inv.customer_name || "").toLowerCase();
    return num.includes(q) || client.includes(q);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💵</span>
            <h1 className="text-2xl font-black text-slate-900">Espace Caissier & Règlements</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Encaissez les factures en attente, gérez les espèces, Mobile Money et clôtures journalières (Ticket Z).
          </p>
        </div>

        {/* État de la caisse */}
        <div className="flex items-center gap-3">
          {activeSession ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Caisse ouverte
              </span>
              <button
                onClick={() => setShowMovementModal(true)}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-100 transition"
              >
                ± Mouvement
              </button>
              <button
                onClick={() => {
                  setCountedCash(activeSession.expected_cash || 0);
                  setShowCloseModal(true);
                }}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 transition"
              >
                Clôturer la caisse (Z)
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (registers.length > 0) setSelectedRegisterId(registers[0].id);
                setShowOpenModal(true);
              }}
              className="px-4 py-2 text-sm font-black rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-sm"
            >
              🔓 Ouvrir ma caisse
            </button>
          )}
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

      {/* Bannière de session active */}
      {activeSession && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 text-white p-4 rounded-2xl">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Fond de caisse initial</p>
            <p className="text-2xl font-black mt-1">{(Number(activeSession.opening_float) || 0).toLocaleString("fr-FR")} FCFA</p>
          </div>
          <div className="bg-emerald-800 text-white p-4 rounded-2xl">
            <p className="text-xs text-emerald-200 font-semibold uppercase tracking-wider">Solde théorique en caisse</p>
            <p className="text-2xl font-black mt-1">{(Number(activeSession.expected_cash) || 0).toLocaleString("fr-FR")} FCFA</p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-2xl">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Ouverte depuis</p>
            <p className="text-lg font-bold text-slate-800 mt-1">
              {new Date(activeSession.opened_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      )}

      {/* File d'attente des factures */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900">File d'attente des factures « À régler »</h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
              {filteredInvoices.length}
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher par n° de facture ou client..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full sm:w-80 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-semibold text-sm">Chargement des factures...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-semibold text-sm">
            Aucune facture en attente d'encaissement pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((inv) => {
              const remaining = Math.max(0, (Number(inv.total_amount) || 0) - (Number(inv.amount_paid) || 0));
              return (
                <div
                  key={inv.id}
                  className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-600 transition flex flex-col justify-between bg-slate-50/50"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {inv.invoice_number || `FAC-${inv.id.slice(0, 6)}`}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(inv.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="text-sm font-black text-slate-900">{inv.customer_name || "Client comptoir"}</div>

                    <div className="border-t border-slate-200/80 pt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Reste à payer :</span>
                      <span className="text-base font-black text-slate-900">{remaining.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setPayingInvoice(inv);
                      setPaymentAmount(remaining);
                      setCashTendered(remaining);
                      setPaymentMethod("CASH");
                      setPaymentRef("");
                    }}
                    className="mt-4 w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs transition shadow-sm"
                  >
                    💳 Encaisser ({remaining.toLocaleString("fr-FR")} FCFA)
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal d'encaissement */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Encaissement de la facture</h3>
                <p className="text-xs text-slate-500 font-mono">{payingInvoice.invoice_number || payingInvoice.id}</p>
              </div>
              <button onClick={() => setPayingInvoice(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Client :</span>
                <span className="font-bold text-slate-800">{payingInvoice.customer_name || "Client comptoir"}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Montant net à régler :</span>
                <span className="font-black text-emerald-800 text-sm">
                  {Math.max(0, (Number(payingInvoice.total_amount) || 0) - (Number(payingInvoice.amount_paid) || 0)).toLocaleString("fr-FR")} FCFA
                </span>
              </div>
            </div>

            {/* Choix du mode de paiement */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mode de règlement</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["CASH", "💵 Espèces"],
                  ["MTN_MOMO", "🟡 MTN MoMo (PawaPay)"],
                  ["MOOV_MONEY", "🔵 Moov Money (PawaPay)"],
                  ["ORANGE_MONEY", "🟠 Orange Money (PawaPay)"],
                  ["WAVE", "🐧 Wave"],
                  ["CHECK", "📄 Chèque"],
                  ["TRANSFER", "🏦 Virement"],
                  ["CREDIT", "⏳ Crédit autorisé"],
                ].map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setPaymentMethod(code)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black border transition text-left ${
                      paymentMethod === code
                        ? "bg-emerald-800 text-white border-emerald-800 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Saisie montant et calcul de monnaie si espèces */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Montant encaissé (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setPaymentAmount(val);
                    if (paymentMethod === "CASH") setCashTendered(val);
                  }}
                  className="mt-1 w-full px-3 py-2 text-base font-black rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {paymentMethod === "CASH" && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-amber-900">
                    <span>Espèces reçues du client :</span>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                      className="w-32 px-2 py-1 bg-white border border-amber-300 rounded font-black text-right"
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm font-black text-amber-900 border-t border-amber-200/60 pt-2">
                    <span>Monnaie à rendre :</span>
                    <span className="text-base text-emerald-700">
                      {Math.max(0, cashTendered - paymentAmount).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod !== "CASH" && paymentMethod !== "CREDIT" && (
                <div>
                  <label className="text-xs font-bold text-slate-700">Référence de transaction (ID MoMo / Chèque / Virement)</label>
                  <input
                    type="text"
                    placeholder="Ex: TX-984210"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="flex-1 py-3 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={submittingPayment || paymentAmount <= 0}
                onClick={handleRecordPayment}
                className="flex-1 py-3 text-xs font-black rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition disabled:opacity-50"
              >
                {submittingPayment ? "Validation..." : "Valider le règlement ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ouverture de caisse */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Ouverture de session de caisse</h3>
            <p className="text-xs text-slate-500">
              Sélectionnez votre caisse et renseignez le fond de caisse initial disponible en tiroir.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Caisse</label>
                <select
                  value={selectedRegisterId}
                  onChange={(e) => setSelectedRegisterId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                >
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.inventory_stores?.name ? `(${r.inventory_stores.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Fond de caisse initial (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full px-3 py-2 text-base font-black rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleOpenSession}
                className="flex-1 py-2.5 text-xs font-black rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Ouvrir la caisse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mouvement de caisse */}
      {showMovementModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Mouvement de caisse</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Type de mouvement</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as any)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                >
                  <option value="EXPENSE">Dépense de caisse</option>
                  <option value="CASH_IN">Entrée diverse d'espèces</option>
                  <option value="CASH_OUT">Sortie diverse d'espèces</option>
                  <option value="BANK_DEPOSIT">Dépôt en banque</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Montant (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(Number(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2 text-base font-black rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Motif ou justificatif</label>
                <input
                  type="text"
                  placeholder="Ex: Achat fournitures bureau"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setShowMovementModal(false)}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-slate-300"
              >
                Annuler
              </button>
              <button
                onClick={handleAddMovement}
                className="flex-1 py-2.5 text-xs font-black rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Clôture de Caisse (Z) */}
      {showCloseModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Clôture journalière de caisse (Ticket Z)</h3>
            <p className="text-xs text-slate-500">
              Comptez les espèces réelles dans le tiroir et saisissez le montant pour vérifier l'écart.
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Fond initial :</span>
                <span className="font-bold">{(Number(activeSession.opening_float) || 0).toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Solde théorique attendu :</span>
                <span className="font-black text-slate-900">{(Number(activeSession.expected_cash) || 0).toLocaleString("fr-FR")} FCFA</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Espèces physiques comptées (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  value={countedCash}
                  onChange={(e) => setCountedCash(Number(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2 text-base font-black rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {countedCash !== activeSession.expected_cash && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-black text-red-900">
                    <span>Écart constaté :</span>
                    <span>
                      {countedCash - activeSession.expected_cash > 0 ? "+" : ""}
                      {(countedCash - activeSession.expected_cash).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-red-800">Motif obligatoire de l'écart :</label>
                    <input
                      type="text"
                      placeholder="Ex: Erreur rendu monnaie client"
                      value={differenceReason}
                      onChange={(e) => setDifferenceReason(e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-red-300 rounded font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-slate-300"
              >
                Annuler
              </button>
              <button
                onClick={handleCloseSession}
                className="flex-1 py-2.5 text-xs font-black rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950"
              >
                Confirmer la clôture Z
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Z généré */}
      {ticketZ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center font-mono">
            <div className="text-3xl">🧾</div>
            <h3 className="text-base font-black uppercase tracking-wider text-slate-900">Ticket Z — Clôture Caisse</h3>
            <p className="text-[11px] text-slate-500">Rapport journalier officiel</p>

            <div className="border-t border-b border-dashed border-slate-300 py-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>Ouverture :</span>
                <span>{new Date(ticketZ.openedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex justify-between">
                <span>Clôture :</span>
                <span>{new Date(ticketZ.closedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex justify-between">
                <span>Fond initial :</span>
                <span>{ticketZ.openingFloat.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span>Total collecté :</span>
                <span className="font-bold">{ticketZ.totalCollected.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span>Espèces attendues :</span>
                <span>{ticketZ.expectedCash.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Espèces comptées :</span>
                <span>{ticketZ.closingCashCounted.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between font-black text-amber-900">
                <span>Écart :</span>
                <span>{ticketZ.cashDifference.toLocaleString("fr-FR")} FCFA</span>
              </div>
            </div>

            <button
              onClick={() => setTicketZ(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-sans text-xs font-black"
            >
              Fermer le rapport
            </button>
          </div>
        </div>
      )}

      {/* Reçu imprimable après encaissement */}
      {lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center font-mono">
            <div className="text-3xl">✅</div>
            <h3 className="text-base font-black uppercase text-slate-900">Reçu d'encaissement</h3>
            <p className="text-xs text-slate-500 font-bold">{lastReceipt.invoiceNumber}</p>

            <div className="border-t border-b border-dashed border-slate-300 py-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>Total Facture :</span>
                <span>{lastReceipt.totalAmount.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800">
                <span>Total Réglé :</span>
                <span>{lastReceipt.amountPaid.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="text-[10px] text-slate-400 pt-1">
                Date : {new Date(lastReceipt.timestamp).toLocaleString("fr-FR")}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-sans text-xs font-bold hover:bg-slate-50"
              >
                🖨 Imprimer reçu (58/80mm)
              </button>
              <button
                onClick={() => setLastReceipt(null)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white font-sans text-xs font-black hover:bg-emerald-800"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
