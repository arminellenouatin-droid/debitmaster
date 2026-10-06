"use client";

import { useEffect, useState } from "react";

type Store = { id: string; name: string };
type Category = { id: string; name: string };

type InventoryItem = {
  id: string;
  product_id: string;
  product_name: string;
  internal_code: string;
  unit_cost_xof: number;
  theoretical_quantity: number;
  counted_quantity: number | null;
  recounted_quantity: number | null;
  final_quantity: number | null;
  variance_quantity: number;
  variance_amount_xof: number;
  status: "PENDING" | "MATCHED" | "DISCREPANCY" | "RECOUNTED" | "ADJUSTED";
  justification?: string;
};

type InventorySession = {
  id: string;
  session_number: string;
  store_id: string;
  inventory_type: "GENERAL" | "PARTIAL" | "CYCLIC";
  category_id?: string;
  status: "DRAFT" | "IN_PROGRESS" | "COUNTED" | "VALIDATED" | "CANCELLED";
  is_blind_count: boolean;
  total_theoretical_value_xof: number;
  total_counted_value_xof: number;
  total_variance_value_xof: number;
  total_items_count: number;
  discrepancies_count: number;
  notes?: string;
  started_at: string;
  validated_at?: string;
  created_at: string;
  commerce_inventory_items?: InventoryItem[];
};

export function InventaireClient({
  tenantId,
  companyName,
  userRole,
  canValidate,
}: {
  tenantId: string;
  companyName: string;
  userRole: string;
  canValidate: boolean;
}) {
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal new session
  const [showNewModal, setShowNewModal] = useState(false);
  const [newStoreId, setNewStoreId] = useState("");
  const [newType, setNewType] = useState<"GENERAL" | "PARTIAL" | "CYCLIC">("GENERAL");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newBlindCount, setNewBlindCount] = useState(false);
  const [newNotes, setNewNotes] = useState("");

  // Counting form state
  const [counts, setCounts] = useState<Record<string, { count1?: number; recount?: number; justification?: string }>>({});
  const [savingCounts, setSavingCounts] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Charger les sessions
  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commerce/inventory/sessions");
      if (res.ok) {
        const d = await res.json();
        setSessions(d.sessions || []);
        setStores(d.stores || []);
        setCategories(d.categories || []);
        if (d.stores?.length > 0 && !newStoreId) {
          setNewStoreId(d.stores[0].id);
        }
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  // Sélectionner et charger une session avec ses lignes
  async function selectSession(session: InventorySession) {
    try {
      const res = await fetch(`/api/commerce/inventory/sessions/${session.id}`);
      if (res.ok) {
        const d = await res.json();
        setActiveSession(d.session);
        // Initialiser l'état local des comptages
        const initialCounts: Record<string, { count1?: number; recount?: number; justification?: string }> = {};
        for (const item of d.session.commerce_inventory_items || []) {
          initialCounts[item.id] = {
            count1: item.counted_quantity !== null ? Number(item.counted_quantity) : undefined,
            recount: item.recounted_quantity !== null ? Number(item.recounted_quantity) : undefined,
            justification: item.justification || "",
          };
        }
        setCounts(initialCounts);
      }
    } catch {
      setError("Impossible de charger les lignes de comptage de cette session.");
    }
  }

  // Création de session
  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newStoreId) {
      alert("Veuillez sélectionner un magasin.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/commerce/inventory/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: newStoreId,
          inventoryType: newType,
          categoryId: newType === "PARTIAL" ? newCategoryId : null,
          isBlindCount: newBlindCount,
          notes: newNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de création de la session.");
        return;
      }
      setSuccessMsg(data.message);
      setShowNewModal(false);
      setNewNotes("");
      await loadSessions();
      if (data.session) {
        selectSession(data.session);
      }
    } catch {
      setError("Erreur réseau lors de la création.");
    }
  }

  // Enregistrement des comptages
  async function handleSaveCounts() {
    if (!activeSession) return;
    setSavingCounts(true);
    setError(null);
    try {
      const payloadItems = (activeSession.commerce_inventory_items || []).map((it) => {
        const c = counts[it.id] || {};
        return {
          itemId: it.id,
          countedQuantity: c.count1 !== undefined ? c.count1 : null,
          recountedQuantity: c.recount !== undefined ? c.recount : null,
          justification: c.justification || "",
        };
      });

      const res = await fetch(`/api/commerce/inventory/sessions/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec d'enregistrement des comptages.");
      } else {
        setSuccessMsg(data.message);
        selectSession(activeSession);
        loadSessions();
      }
    } catch {
      setError("Erreur réseau lors de l'enregistrement des comptages.");
    } finally {
      setSavingCounts(false);
    }
  }

  // Validation définitive et ajustement des stocks
  async function handleValidateSession() {
    if (!activeSession) return;
    if (!confirm(`Confirmez-vous la validation de l'inventaire ${activeSession.session_number} ? Les stocks physiques du magasin seront définitivement ajustés.`)) {
      return;
    }

    setError(null);
    try {
      const res = await fetch(`/api/commerce/inventory/sessions/${activeSession.id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de validation de la session.");
      } else {
        setSuccessMsg(data.message);
        selectSession(activeSession);
        loadSessions();
      }
    } catch {
      setError("Erreur réseau lors de la validation.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-emerald-950 via-[#063327] to-slate-900 p-6 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-xs font-black text-amber-300">
              MODULE COMMERCE · SPRINT 8
            </span>
            <span className="text-xs text-emerald-300/70">Rôle : {userRole}</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>📋</span> Responsable d’Inventaire Physique
          </h1>
          <p className="mt-1 text-xs text-emerald-200/80">
            {companyName} · Sessions d’inventaire, gel du théorique, comptages, écarts et régularisations automatiques
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 shadow-md transition"
          >
            <span>+</span> Nouvelle Session d’Inventaire
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

      {/* Main Grid: Sessions List (Left) vs Active Counting Cockpit (Right) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_2.2fr]">
        {/* Sessions List */}
        <div className="space-y-4">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
            <span>Sessions d’Inventaire</span>
            <span className="text-xs font-bold text-slate-500">{sessions.length} session(s)</span>
          </h2>

          <div className="space-y-2">
            {sessions.map((sess) => {
              const store = stores.find((s) => s.id === sess.store_id);
              const isSelected = activeSession?.id === sess.id;
              return (
                <div
                  key={sess.id}
                  onClick={() => selectSession(sess)}
                  className={`cursor-pointer rounded-2xl border p-4 transition shadow-sm ${
                    isSelected
                      ? "border-emerald-700 bg-emerald-50/50 ring-2 ring-emerald-600/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-slate-900">{sess.session_number}</p>
                      <p className="text-xs text-slate-500 font-bold">{store?.name || "Magasin Central"}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        sess.status === "VALIDATED"
                          ? "bg-emerald-100 text-emerald-800"
                          : sess.status === "COUNTED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {sess.status === "VALIDATED" ? "Validé & Clôturé" : sess.status === "COUNTED" ? "Compté" : "En cours"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                    <span>{sess.inventory_type === "GENERAL" ? "Général" : sess.inventory_type === "PARTIAL" ? "Partiel" : "Tournant"}</span>
                    <span>{sess.total_items_count} article(s)</span>
                    <span className="font-bold text-slate-800">
                      {new Date(sess.started_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              );
            })}
            {sessions.length === 0 && !loading && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                Aucune session d’inventaire. Cliquez sur « Nouvelle Session » pour débuter.
              </div>
            )}
          </div>
        </div>

        {/* Active Session Counting Cockpit */}
        <div className="space-y-4">
          {activeSession ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              {/* Session Overview Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-slate-900">{activeSession.session_number}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                      {stores.find((s) => s.id === activeSession.store_id)?.name}
                    </span>
                    {activeSession.is_blind_count && (
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700">
                        Comptage à l’aveugle
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Ouvert le {new Date(activeSession.started_at).toLocaleString("fr-FR")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    🖨 Fiche de comptage vierge
                  </button>

                  {activeSession.status !== "VALIDATED" && (
                    <button
                      disabled={savingCounts}
                      onClick={handleSaveCounts}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-500 transition disabled:opacity-50"
                    >
                      {savingCounts ? "Enregistrement..." : "💾 Sauvegarder les comptages"}
                    </button>
                  )}

                  {canValidate && activeSession.status !== "VALIDATED" && (
                    <button
                      onClick={handleValidateSession}
                      className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 transition"
                    >
                      ✓ Valider & Régulariser le Stock
                    </button>
                  )}
                </div>
              </div>

              {/* Financial & Discrepancies Summary */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-slate-50 p-4 text-xs">
                <div>
                  <p className="text-slate-400 font-bold">Valeur Théorique</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    {new Intl.NumberFormat("fr-FR").format(activeSession.total_theoretical_value_xof)} FCFA
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">Valeur Comptée</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    {new Intl.NumberFormat("fr-FR").format(activeSession.total_counted_value_xof || activeSession.total_theoretical_value_xof)} FCFA
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">Écart Net Global</p>
                  <p className={`text-sm font-black mt-0.5 ${
                    activeSession.total_variance_value_xof < 0
                      ? "text-rose-600"
                      : activeSession.total_variance_value_xof > 0
                      ? "text-blue-600"
                      : "text-emerald-700"
                  }`}>
                    {activeSession.total_variance_value_xof > 0 ? "+" : ""}
                    {new Intl.NumberFormat("fr-FR").format(activeSession.total_variance_value_xof)} FCFA
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">Lignes en Écart</p>
                  <p className="text-sm font-black text-rose-700 mt-0.5">
                    {activeSession.discrepancies_count} anomalie(s)
                  </p>
                </div>
              </div>

              {/* Counting Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-black text-slate-600">
                    <tr>
                      <th className="p-2.5">Article</th>
                      <th className="p-2.5 text-center">Théorique</th>
                      <th className="p-2.5 text-center">Comptage 1</th>
                      <th className="p-2.5 text-center">Recomptage</th>
                      <th className="p-2.5 text-center">Écart</th>
                      <th className="p-2.5 text-right">Valorisation Écart</th>
                      <th className="p-2.5">Motif / Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {(activeSession.commerce_inventory_items || []).map((item) => {
                      const c = counts[item.id] || {};
                      const count1Val = c.count1;
                      const recountVal = c.recount;
                      const finalQty = recountVal !== undefined ? recountVal : count1Val !== undefined ? count1Val : Number(item.theoretical_quantity);
                      const variance = finalQty - Number(item.theoretical_quantity);
                      const varianceVal = variance * Number(item.unit_cost_xof);
                      const isLocked = activeSession.status === "VALIDATED";

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            <p className="font-bold text-slate-900">{item.product_name}</p>
                            <p className="text-[10px] text-slate-400">Réf : {item.internal_code || "N/A"}</p>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-600">
                            {activeSession.is_blind_count && !isLocked && count1Val === undefined ? (
                              <span className="text-slate-300">Masqué</span>
                            ) : (
                              item.theoretical_quantity
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              disabled={isLocked}
                              value={count1Val !== undefined ? count1Val : ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? undefined : Number(e.target.value);
                                setCounts({
                                  ...counts,
                                  [item.id]: { ...counts[item.id], count1: val },
                                });
                              }}
                              className="w-16 rounded-lg border border-slate-200 p-1 text-center font-bold text-slate-900 focus:border-emerald-600 disabled:bg-slate-100"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              disabled={isLocked}
                              value={recountVal !== undefined ? recountVal : ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? undefined : Number(e.target.value);
                                setCounts({
                                  ...counts,
                                  [item.id]: { ...counts[item.id], recount: val },
                                });
                              }}
                              className="w-16 rounded-lg border border-slate-200 p-1 text-center font-bold text-blue-900 focus:border-blue-600 disabled:bg-slate-100"
                            />
                          </td>
                          <td className="p-2.5 text-center font-black">
                            {variance === 0 ? (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800">
                                0
                              </span>
                            ) : variance < 0 ? (
                              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">
                                {variance}
                              </span>
                            ) : (
                              <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
                                +{variance}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold">
                            <span className={varianceVal < 0 ? "text-rose-600" : varianceVal > 0 ? "text-blue-600" : "text-slate-400"}>
                              {varianceVal > 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(varianceVal)} FCFA
                            </span>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              disabled={isLocked}
                              placeholder="Casse, vol, erreur..."
                              value={c.justification || ""}
                              onChange={(e) => {
                                setCounts({
                                  ...counts,
                                  [item.id]: { ...counts[item.id], justification: e.target.value },
                                });
                              }}
                              className="w-full rounded-lg border border-slate-200 p-1 text-xs text-slate-700 disabled:bg-slate-100"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-400">
              <span className="text-3xl">👈</span>
              <p className="mt-2 text-sm font-bold text-slate-700">Sélectionnez une session d’inventaire dans la liste</p>
              <p className="text-xs text-slate-400 mt-1">Vous pourrez y effectuer les comptages physiques ou valider les écarts.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nouvelle Session d'Inventaire */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Ouvrir une Session d’Inventaire</h3>
            <p className="mt-1 text-xs text-slate-500">
              Le stock théorique actuel de chaque article sera automatiquement gelé à l’ouverture.
            </p>

            <form onSubmit={handleCreateSession} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Magasin à inventorier *</label>
                <select
                  value={newStoreId}
                  onChange={(e) => setNewStoreId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Type d’inventaire</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as typeof newType)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                  >
                    <option value="GENERAL">Inventaire Général (Tous les produits)</option>
                    <option value="PARTIAL">Inventaire Partiel (Par catégorie)</option>
                    <option value="CYCLIC">Inventaire Tournant (Contrôle rapide)</option>
                  </select>
                </div>
                {newType === "PARTIAL" && (
                  <div>
                    <label className="text-xs font-bold text-slate-700">Catégorie cible</label>
                    <select
                      value={newCategoryId}
                      onChange={(e) => setNewCategoryId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold"
                    >
                      <option value="">Sélectionner une catégorie...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                <input
                  type="checkbox"
                  id="blindCount"
                  checked={newBlindCount}
                  onChange={(e) => setNewBlindCount(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                />
                <label htmlFor="blindCount" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Activer le comptage à l’aveugle (recommandé pour éviter les fraudes : masque le stock théorique aux opérateurs)
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Notes & Instructions</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="Instructions pour les équipes de comptage..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                >
                  Lancer l’Inventaire & Geler le Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impression A4 Fiche de Comptage Vierge */}
      {showPrintModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl">
            <div className="flex justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">{companyName}</h2>
                <p className="text-xs text-slate-500">
                  Magasin : {stores.find((s) => s.id === activeSession.store_id)?.name} · Fiche de Comptage Terrain
                </p>
                <p className="text-xs text-slate-500">Date d’ouverture : {new Date(activeSession.started_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-800">
                  FICHE DE COMPTAGE
                </span>
                <p className="mt-1 text-lg font-black text-emerald-900">{activeSession.session_number}</p>
              </div>
            </div>

            <table className="mt-6 w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 font-black text-slate-800 border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300">N°</th>
                  <th className="p-2 border-r border-slate-300">Code / Réf</th>
                  <th className="p-2 border-r border-slate-300">Désignation Produit</th>
                  <th className="p-2 border-r border-slate-300 text-center w-24">Comptage 1</th>
                  <th className="p-2 border-r border-slate-300 text-center w-24">Recomptage</th>
                  <th className="p-2 text-center w-32">Visa Compteur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {(activeSession.commerce_inventory_items || []).map((it, idx) => (
                  <tr key={it.id} className="h-10">
                    <td className="p-2 border-r border-slate-300 font-bold">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-300">{it.internal_code || "-"}</td>
                    <td className="p-2 border-r border-slate-300 font-bold">{it.product_name}</td>
                    <td className="p-2 border-r border-slate-300"></td>
                    <td className="p-2 border-r border-slate-300"></td>
                    <td className="p-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-10 flex justify-between border-t border-slate-300 pt-6 text-xs text-slate-600">
              <div>
                <p className="font-bold">Nom & Signature Compteur 1</p>
                <div className="mt-12 h-0.5 w-40 bg-slate-300" />
              </div>
              <div>
                <p className="font-bold">Nom & Signature Superviseur / Recompteur</p>
                <div className="mt-12 h-0.5 w-40 bg-slate-300" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                onClick={() => setShowPrintModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                🖨 Imprimer la fiche (A4)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
