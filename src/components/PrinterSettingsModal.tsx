// DebitMaster Modal de Configuration & Test des Pilotes d'Imprimantes
"use client";

import { useEffect, useState } from "react";
import {
  type PrinterType,
  type PrinterConfig,
  getSavedPrinterConfig,
  savePrinterConfig,
  printTestTicket,
} from "@/lib/printing/printer-driver";

interface PrinterSettingsModalProps {
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PrinterSettingsModal({ companyName, isOpen, onClose }: PrinterSettingsModalProps) {
  const [config, setConfig] = useState<PrinterConfig>(getSavedPrinterConfig());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isOpen) {
      setConfig(getSavedPrinterConfig());
      setNotice("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    savePrinterConfig(config);
    setNotice("Configuration d'imprimante enregistrée !");
    setTimeout(() => {
      onClose();
    }, 1000);
  }

  function handleTest() {
    savePrinterConfig(config);
    printTestTicket(companyName, config.type);
    setNotice("Ordre d'impression envoyé à l'imprimante !");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Matériel &amp; Périphériques
            </span>
            <h2 className="text-xl font-black text-[var(--primary)] sm:text-2xl">
              Pilotes d'Imprimante &amp; Impression
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Connectez n'importe quel type d'imprimante (thermique ticket ou bureau A4) à DebitMaster.
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

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            ✓ {notice}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* Choice of printer type */}
          <div>
            <label className="block text-xs font-bold text-[var(--primary)] mb-2">
              Modèle d'imprimante connecté
            </label>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  type: "THERMAL_80MM" as PrinterType,
                  title: "Thermique 80 mm",
                  sub: "Caisse POS standard (Epson, Star, Xprinter, Sunmi)",
                  badge: "Recommandé Caisse",
                },
                {
                  type: "THERMAL_58MM" as PrinterType,
                  title: "Thermique 58 mm",
                  sub: "Mini imprimante mobile Bluetooth / portable",
                  badge: "Mobile",
                },
                {
                  type: "A4_STANDARD" as PrinterType,
                  title: "Format A4 Bureau",
                  sub: "Imprimante laser ou jet d'encre standard",
                  badge: "Factures & Rapports",
                },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setConfig({ ...config, type: item.type })}
                  className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                    config.type === item.type
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-black ring-2 ring-emerald-500 shadow-sm"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <div>
                    <span className="rounded bg-emerald-700/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                      {item.badge}
                    </span>
                    <p className="mt-2 text-sm font-black text-[var(--primary)]">{item.title}</p>
                    <p className="mt-1 text-[10px] leading-tight text-[var(--muted)]">{item.sub}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <span
                      className={`h-4 w-4 rounded-full border-2 ${
                        config.type === item.type
                          ? "border-emerald-700 bg-emerald-700"
                          : "border-slate-300"
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Thermal Options */}
          {config.type !== "A4_STANDARD" && (
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
              <p className="text-xs font-black text-slate-800">Personnalisation des tickets thermiques</p>
              <div>
                <label className="block text-[11px] font-bold text-slate-600">Message de bas de ticket</label>
                <input
                  type="text"
                  value={config.footerText ?? ""}
                  onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                  placeholder="Ex: Merci de votre visite ! À très bientôt."
                  className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cutPaper"
                  checked={config.cutPaper ?? true}
                  onChange={(e) => setConfig({ ...config, cutPaper: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
                <label htmlFor="cutPaper" className="text-xs font-bold text-slate-700">
                  Découpe automatique du papier / Saut de ligne de fin
                </label>
              </div>
            </div>
          )}

          {/* Test print button */}
          <div className="rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold text-emerald-900">Tester votre imprimante connectée</p>
              <p className="text-[11px] text-emerald-700">
                Imprime un ticket ou document de calibration selon le pilote sélectionné.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTest}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-800"
            >
              <span>🖨</span> Lancer l'impression test
            </button>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-[var(--line)] pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-[var(--line)] px-4 text-xs font-black text-[var(--primary)] hover:bg-[var(--surface-muted)]"
            >
              Fermer
            </button>
            <button
              type="submit"
              className="h-11 rounded-xl bg-[var(--primary)] px-5 text-xs font-black text-white hover:bg-[var(--primary)]/90"
            >
              Enregistrer les préférences d'impression
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
