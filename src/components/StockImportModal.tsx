// DebitMaster Modal d'Importation de Stock : Excel (.xlsx, .xls) et CSV.
// Concerne exclusivement les produits physiques avec stock (les services sont automatiquement écartés).
"use client";

import { useState } from "react";

type Store = { id: string; name: string; stock_family?: string };

interface StockImportModalProps {
  tenantId: string;
  stores?: Store[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockImportModal({
  tenantId,
  stores = [],
  isOpen,
  onClose,
  onSuccess,
}: StockImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [storeId, setStoreId] = useState<string>("");
  const [mode, setMode] = useState<"ADD" | "REPLACE">("ADD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [details, setDetails] = useState<{
    processed: number;
    created: number;
    updated: number;
    skippedServices: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV.");
      return;
    }

    setLoading(true);
    setError("");
    setResultMessage("");
    setDetails(null);

    try {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("mode", mode);
      if (storeId) formData.set("storeId", storeId);
      formData.set("file", file);

      const res = await fetch("/api/stock/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'importation du stock.");
      }

      setResultMessage(data.message || "Importation terminée avec succès !");
      if (data.results) {
        setDetails(data.results);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'importation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Gestion des stocks physique
            </span>
            <h2 className="text-xl font-black text-[var(--primary)] sm:text-2xl">
              Importer les stocks (Excel / CSV)
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Mettez à jour ou initialisez le stock de vos produits en quelques secondes via un fichier.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-sm font-black text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            ✕
          </button>
        </div>

        {/* Info box: Exclusion stricte des services */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-extrabold flex items-center gap-1.5">
            <span>ℹ️</span> Produits physiques avec stock uniquement
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
            Ce module traite les articles disposant d’un stock matériel (boissons, repas, marchandises, fournitures). Les services (sans gestion de stock) sont automatiquement écartés.
          </p>
        </div>

        {/* Download templates */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs border border-slate-200">
          <span className="font-bold text-slate-700">Modèles de fichier types :</span>
          <div className="flex gap-2">
            <a
              href="/api/stock/template?format=xlsx"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-black text-emerald-700 hover:bg-emerald-100"
            >
              <span>📥</span> Modèle Excel (.xlsx)
            </a>
            <a
              href="/api/stock/template?format=csv"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-black text-slate-700 hover:bg-slate-100"
            >
              <span>📥</span> Modèle CSV
            </a>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
            {error}
          </div>
        )}

        {resultMessage && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <p className="font-extrabold text-emerald-800">{resultMessage}</p>
            {details && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded bg-white/70 p-2">
                  <span className="font-bold">Total lignes traitées :</span> {details.processed}
                </div>
                <div className="rounded bg-white/70 p-2">
                  <span className="font-bold">Nouveaux créés :</span> {details.created}
                </div>
                <div className="rounded bg-white/70 p-2">
                  <span className="font-bold">Stocks mis à jour :</span> {details.updated}
                </div>
                <div className="rounded bg-white/70 p-2 text-amber-800">
                  <span className="font-bold">Services ignorés :</span> {details.skippedServices}
                </div>
              </div>
            )}
            {details?.errors && details.errors.length > 0 && (
              <div className="mt-2 border-t border-emerald-200 pt-2 text-[11px] text-red-700">
                <p className="font-bold">Remarques :</p>
                <ul className="list-disc pl-4">
                  {details.errors.slice(0, 3).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleImport} className="mt-5 space-y-4">
          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-[var(--primary)]">
              Fichier Excel ou CSV à importer <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              required
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-xs font-bold file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white hover:file:bg-[var(--primary)]/90"
            />
            {file && (
              <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                ✓ {file.name} ({(file.size / 1024).toFixed(1)} Ko)
              </p>
            )}
          </div>

          {/* Target Store Selection */}
          {stores.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-[var(--primary)]">
                Magasin de destination
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-xs font-bold text-[var(--primary)]"
              >
                <option value="">Magasin principal par défaut</option>
                {stores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.stock_family ? `(${st.stock_family})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode: Add or Replace */}
          <div>
            <label className="block text-xs font-bold text-[var(--primary)]">
              Méthode d'application des quantités
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("ADD")}
                className={`rounded-xl border p-2.5 text-left text-xs transition ${
                  mode === "ADD"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-black ring-1 ring-emerald-500"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] font-bold hover:bg-[var(--surface-muted)]"
                }`}
              >
                <span className="block font-black text-[var(--primary)]">Ajouter au stock existant (+)</span>
                <span className="text-[10px] text-[var(--muted)]">Approvisionnement / entrée</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("REPLACE")}
                className={`rounded-xl border p-2.5 text-left text-xs transition ${
                  mode === "REPLACE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-black ring-1 ring-emerald-500"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] font-bold hover:bg-[var(--surface-muted)]"
                }`}
              >
                <span className="block font-black text-[var(--primary)]">Remplacer le stock actuel (=)</span>
                <span className="text-[10px] text-[var(--muted)]">Inventaire / réalignement direct</span>
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse justify-end gap-2 border-t border-[var(--line)] pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-11 rounded-xl border border-[var(--line)] px-4 text-xs font-black text-[var(--primary)] hover:bg-[var(--surface-muted)]"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="h-11 rounded-xl bg-[var(--primary)] px-5 text-xs font-black text-white hover:bg-[var(--primary)]/90 disabled:opacity-50"
            >
              {loading ? "Importation en cours…" : "Valider et importer le stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
