"use client";

import { useEffect, useState } from "react";

type Account = {
  id: string;
  account_number: string;
  account_name: string;
  account_class: number;
  account_type: string;
  is_system: boolean;
};

type Journal = {
  id: string;
  code: string;
  name: string;
};

type JournalEntryLine = {
  id: string;
  account_number: string;
  account_name: string;
  debit_amount_xof: number;
  credit_amount_xof: number;
  partner_name?: string;
  line_description?: string;
};

type JournalEntry = {
  id: string;
  entry_number: string;
  journal_code: string;
  entry_date: string;
  fiscal_year: number;
  reference: string;
  description: string;
  total_debit_xof: number;
  total_credit_xof: number;
  is_balanced: boolean;
  lines?: JournalEntryLine[];
};

type TrialBalanceRow = {
  account_number: string;
  account_name: string;
  account_class: number;
  total_debit_xof: number;
  total_credit_xof: number;
  debit_balance_xof: number;
  credit_balance_xof: number;
};

type IncomeStatement = {
  chiffreAffaires: number;
  ventesMarchandises: number;
  achatsMarchandises: number;
  variationStocks: number;
  coutAchatMarchandisesVendues: number;
  margeCommerciale: number;
  autresChargesExternes: number;
  valeurAjoutee: number;
  impotsTaxes: number;
  chargesPersonnel: number;
  excedentBrutExploitation: number;
  dotationsAmortissements: number;
  resultatExploitation: number;
  resultatFinancier: number;
  resultatHao: number;
  resultatNet: number;
  isBenefice: boolean;
};

type BalanceSheet = {
  actif: {
    actifImmoBrut: number;
    amortissementsImmo: number;
    actifImmoNet: number;
    stocksMarchandises: number;
    creancesClients: number;
    actifCirculant: number;
    tresorerieActif: number;
    totalActif: number;
  };
  passif: {
    capitalSocial: number;
    reserves: number;
    reportANouveau: number;
    resultatNetExercice: number;
    capitauxPropres: number;
    dettesFinancieres: number;
    dettesFournisseurs: number;
    dettesFiscalesSociales: number;
    dettesCirculantes: number;
    totalPassif: number;
  };
  equilibreBilan: boolean;
};

export function ComptabiliteClient({
  tenantId,
  companyName,
  userRole,
  canPostEntries,
}: {
  tenantId: string;
  companyName: string;
  userRole: string;
  canPostEntries: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"JOURNAL" | "COA" | "TRIAL_BALANCE" | "STATEMENTS">("JOURNAL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Données
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Balance & États
  const [balanceRows, setBalanceRows] = useState<TrialBalanceRow[]>([]);
  const [balanceTotals, setBalanceTotals] = useState({
    totalDebit: 0,
    totalCredit: 0,
    totalDebitBalance: 0,
    totalCreditBalance: 0,
    isBalanced: true,
  });
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);

  // Filtres
  const [journalFilter, setJournalFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Formulaire Nouvelle Écriture d'OD
  const [entryJournal, setEntryJournal] = useState("OD");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [entryRef, setEntryRef] = useState("");
  const [entryDesc, setEntryDesc] = useState("");
  const [entryLines, setEntryLines] = useState<Array<{
    accountNumber: string;
    accountName: string;
    debitAmountXof: number;
    creditAmountXof: number;
    partnerName: string;
    lineDescription: string;
  }>>([
    { accountNumber: "601", accountName: "Achats de marchandises", debitAmountXof: 0, creditAmountXof: 0, partnerName: "", lineDescription: "" },
    { accountNumber: "401", accountName: "Fournisseurs, dettes en compte", debitAmountXof: 0, creditAmountXof: 0, partnerName: "", lineDescription: "" },
  ]);

  // Formulaire Nouveau Compte
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("ASSET");

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [chartRes, entriesRes] = await Promise.all([
        fetch("/api/commerce/accounting/chart"),
        fetch("/api/commerce/accounting/entries"),
      ]);

      if (chartRes.ok) {
        const d = await chartRes.json();
        setAccounts(d.accounts || []);
        setJournals(d.journals || []);
      }

      if (entriesRes.ok) {
        const d = await entriesRes.json();
        setEntries(d.entries || []);
      }
    } catch {
      setError("Impossible de contacter le serveur comptable.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBalanceAndStatements() {
    try {
      const [balRes, statRes] = await Promise.all([
        fetch("/api/commerce/accounting/reports/trial-balance"),
        fetch("/api/commerce/accounting/reports/financial-statements"),
      ]);

      if (balRes.ok) {
        const d = await balRes.json();
        setBalanceRows(d.rows || []);
        setBalanceTotals(d.totals || { totalDebit: 0, totalCredit: 0, totalDebitBalance: 0, totalCreditBalance: 0, isBalanced: true });
      }

      if (statRes.ok) {
        const d = await statRes.json();
        setIncomeStatement(d.compteDeResultat || null);
        setBalanceSheet(d.bilan || null);
      }
    } catch {
      console.error("Erreur de chargement des états financiers.");
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "TRIAL_BALANCE" || activeTab === "STATEMENTS") {
      loadBalanceAndStatements();
    }
  }, [activeTab]);

  // Calcul temps réel de l'équilibre de la pièce
  const formTotalDebit = entryLines.reduce((sum, l) => sum + (Number(l.debitAmountXof) || 0), 0);
  const formTotalCredit = entryLines.reduce((sum, l) => sum + (Number(l.creditAmountXof) || 0), 0);
  const formIsBalanced = formTotalDebit > 0 && formTotalDebit === formTotalCredit;

  function updateEntryLine(idx: number, field: string, value: string | number) {
    const updated = [...entryLines];
    if (field === "accountNumber") {
      const acc = accounts.find((a) => a.account_number === value);
      updated[idx].accountNumber = String(value);
      if (acc) updated[idx].accountName = acc.account_name;
    } else if (field === "debitAmountXof") {
      updated[idx].debitAmountXof = Math.max(0, Number(value) || 0);
      if (updated[idx].debitAmountXof > 0) updated[idx].creditAmountXof = 0;
    } else if (field === "creditAmountXof") {
      updated[idx].creditAmountXof = Math.max(0, Number(value) || 0);
      if (updated[idx].creditAmountXof > 0) updated[idx].debitAmountXof = 0;
    } else {
      // @ts-expect-error dynamic property update
      updated[idx][field] = value;
    }
    setEntryLines(updated);
  }

  function addEntryLine() {
    setEntryLines([
      ...entryLines,
      { accountNumber: "521", accountName: "Banques locales", debitAmountXof: 0, creditAmountXof: 0, partnerName: "", lineDescription: "" },
    ]);
  }

  function removeEntryLine(idx: number) {
    if (entryLines.length <= 2) return;
    setEntryLines(entryLines.filter((_, i) => i !== idx));
  }

  // Soumission de la pièce d'écriture
  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!formIsBalanced) {
      setError("La pièce comptable n'est pas équilibrée (Total Débit ≠ Total Crédit).");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/commerce/accounting/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalCode: entryJournal,
          entryDate,
          reference: entryRef,
          description: entryDesc,
          lines: entryLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de validation de l'écriture.");
      setSuccessMsg(data.message);
      setShowEntryModal(false);
      setEntryDesc("");
      setEntryRef("");
      setEntryLines([
        { accountNumber: "601", accountName: "Achats de marchandises", debitAmountXof: 0, creditAmountXof: 0, partnerName: "", lineDescription: "" },
        { accountNumber: "401", accountName: "Fournisseurs, dettes en compte", debitAmountXof: 0, creditAmountXof: 0, partnerName: "", lineDescription: "" },
      ]);
      loadInitialData();
      if (activeTab === "TRIAL_BALANCE" || activeTab === "STATEMENTS") {
        loadBalanceAndStatements();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  // Création d'un sous-compte
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/commerce/accounting/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: newAccNumber,
          accountName: newAccName,
          accountType: newAccType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création de compte.");
      setSuccessMsg(data.message);
      setShowAccountModal(false);
      setNewAccNumber("");
      setNewAccName("");
      loadInitialData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  const filteredEntries = entries.filter((ent) => {
    if (journalFilter && ent.journal_code !== journalFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        ent.entry_number.toLowerCase().includes(q) ||
        ent.description.toLowerCase().includes(q) ||
        ent.reference.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-600/10 px-2.5 py-1 text-xs font-bold text-indigo-800">
              SYSCOHADA Révisé
            </span>
            <span className="text-xs font-medium text-slate-700">Sprint 10 : Comptabilité Générale & États Financiers</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
            Comptabilité & États Financiers OHADA
          </h1>
          <p className="mt-1 text-sm text-slate-700 font-medium">
            Établissement : <span className="font-semibold text-slate-900">{companyName}</span> · Rôle :{" "}
            <span className="font-semibold text-slate-900">{userRole}</span>
          </p>
        </div>

        {/* Actions rapides */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAccountModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
          >
            <span>+</span> Nouveau Sous-Compte
          </button>
          {canPostEntries && (
            <button
              onClick={() => setShowEntryModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <span>✍️</span> Saisir Écriture (OD)
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-sm flex items-center justify-between">
          <p>⚠️ {error}</p>
          <button onClick={() => setError(null)} className="text-rose-500 font-bold hover:text-rose-700">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm flex items-center justify-between">
          <p>✅ {successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 font-bold hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Sélecteur d'Onglets */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("JOURNAL")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "JOURNAL"
              ? "border-indigo-600 text-indigo-800"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          📖 Journal des Écritures ({entries.length})
        </button>
        <button
          onClick={() => setActiveTab("COA")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "COA"
              ? "border-indigo-600 text-indigo-800"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          📋 Plan de Comptes ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab("TRIAL_BALANCE")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "TRIAL_BALANCE"
              ? "border-indigo-600 text-indigo-800"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          ⚖️ Balance Générale
        </button>
        <button
          onClick={() => setActiveTab("STATEMENTS")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "STATEMENTS"
              ? "border-indigo-600 text-indigo-800"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          📊 Compte de Résultat & Bilan OHADA
        </button>
      </div>

      {/* ONGLET 1 : JOURNAL DES ÉCRITURES */}
      {activeTab === "JOURNAL" && (
        <div className="space-y-4">
          {/* Filtres de recherche */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Filtrer par Journal :</span>
              <select
                value={journalFilter}
                onChange={(e) => setJournalFilter(e.target.value)}
                className="rounded-xl border border-slate-300 p-2 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                <option value="">Tous les journaux</option>
                {journals.map((j) => (
                  <option key={j.id} value={j.code}>{j.code} - {j.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rechercher par n°, réf., motif..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-xl border border-slate-300 p-2 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Tableau du Journal */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Pièce N°</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Journal</th>
                    <th className="px-5 py-3">Réf.</th>
                    <th className="px-5 py-3">Libellé de l’opération</th>
                    <th className="px-5 py-3 text-right">Débit</th>
                    <th className="px-5 py-3 text-right">Crédit</th>
                    <th className="px-5 py-3 text-center">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-700">
                        Aucune pièce comptable enregistrée.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((ent) => (
                      <tr key={ent.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-black text-slate-900 whitespace-nowrap">{ent.entry_number}</td>
                        <td className="px-5 py-3 whitespace-nowrap">{new Date(ent.entry_date).toLocaleDateString("fr-FR")}</td>
                        <td className="px-5 py-3">
                          <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {ent.journal_code}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-800">{ent.reference}</td>
                        <td className="px-5 py-3 max-w-xs truncate">{ent.description}</td>
                        <td className="px-5 py-3 text-right font-black text-slate-900">
                          {Number(ent.total_debit_xof).toLocaleString("fr-FR")} FCFA
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-900">
                          {Number(ent.total_credit_xof).toLocaleString("fr-FR")} FCFA
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => setSelectedEntry(ent)}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-200 transition"
                          >
                            Lignes ({ent.lines?.length || 0})
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DÉTAILS DES LIGNES D'UNE PIÈCE COMPTABLE */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                  Journal {selectedEntry.journal_code} · {selectedEntry.entry_number}
                </span>
                <h3 className="text-lg font-black text-slate-900">{selectedEntry.description}</h3>
                <p className="text-xs text-slate-700 font-medium">
                  Date : {new Date(selectedEntry.entry_date).toLocaleDateString("fr-FR")} · Réf : {selectedEntry.reference}
                </p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-700 hover:text-slate-900 font-black text-lg">✕</button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Compte</th>
                    <th className="px-4 py-2.5">Intitulé & Tiers</th>
                    <th className="px-4 py-2.5 text-right">Débit (FCFA)</th>
                    <th className="px-4 py-2.5 text-right">Crédit (FCFA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {selectedEntry.lines?.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-black text-slate-900">{line.account_number}</td>
                      <td className="px-4 py-2">
                        <p className="font-semibold text-slate-800">{line.account_name}</p>
                        {line.partner_name && <p className="text-[10px] text-slate-700">{line.partner_name}</p>}
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">
                        {Number(line.debit_amount_xof) > 0 ? Number(line.debit_amount_xof).toLocaleString("fr-FR") : "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">
                        {Number(line.credit_amount_xof) > 0 ? Number(line.credit_amount_xof).toLocaleString("fr-FR") : "-"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={2} className="px-4 py-2.5 text-right uppercase">Totaux Équilibrés :</td>
                    <td className="px-4 py-2.5 text-right text-emerald-800">
                      {Number(selectedEntry.total_debit_xof).toLocaleString("fr-FR")} FCFA
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-800">
                      {Number(selectedEntry.total_credit_xof).toLocaleString("fr-FR")} FCFA
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : PLAN DE COMPTES SYSCOHADA */}
      {activeTab === "COA" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Plan Comptable Général SYSCOHADA Révisé (Classes 1 à 8)</h2>
            <button
              onClick={() => setShowAccountModal(true)}
              className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              + Ajouter Sous-Compte
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Numéro</th>
                  <th className="px-5 py-3">Intitulé</th>
                  <th className="px-5 py-3">Classe</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-center">Origine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-2.5 font-black text-slate-900">{acc.account_number}</td>
                    <td className="px-5 py-2.5 font-semibold text-slate-800">{acc.account_name}</td>
                    <td className="px-5 py-2.5">Classe {acc.account_class}</td>
                    <td className="px-5 py-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                        {acc.account_type}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        acc.is_system ? "bg-slate-100 text-slate-700" : "bg-indigo-100 text-indigo-800"
                      }`}>
                        {acc.is_system ? "Standard OHADA" : "Personnalisé"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 3 : BALANCE GÉNÉRALE */}
      {activeTab === "TRIAL_BALANCE" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h2 className="text-base font-black text-slate-900">Balance Générale des Comptes (6 Colonnes)</h2>
              <p className="text-xs text-slate-700 font-medium">Contrôle strict de l'équilibre arithmétique de la période</p>
            </div>
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                balanceTotals.isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}>
                {balanceTotals.isBalanced ? "✓ Balance Équilibrée" : "⚠️ Déséquilibre Détecté"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3" rowSpan={2}>N° Compte</th>
                    <th className="px-4 py-3" rowSpan={2}>Intitulé du Compte</th>
                    <th className="px-4 py-1.5 text-center border-b border-slate-200" colSpan={2}>Mouvements Période</th>
                    <th className="px-4 py-1.5 text-center border-b border-slate-200" colSpan={2}>Soldes de Clôture</th>
                  </tr>
                  <tr>
                    <th className="px-4 py-1.5 text-right">Débit</th>
                    <th className="px-4 py-1.5 text-right">Crédit</th>
                    <th className="px-4 py-1.5 text-right text-emerald-800">Débiteur</th>
                    <th className="px-4 py-1.5 text-right text-indigo-800">Créditeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {balanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-700">
                        Aucun mouvement comptable pour générer la balance.
                      </td>
                    </tr>
                  ) : (
                    balanceRows.map((r) => (
                      <tr key={r.account_number} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-2 font-black text-slate-900">{r.account_number}</td>
                        <td className="px-4 py-2 font-semibold text-slate-800">{r.account_name}</td>
                        <td className="px-4 py-2 text-right">{r.total_debit_xof > 0 ? r.total_debit_xof.toLocaleString("fr-FR") : "-"}</td>
                        <td className="px-4 py-2 text-right">{r.total_credit_xof > 0 ? r.total_credit_xof.toLocaleString("fr-FR") : "-"}</td>
                        <td className="px-4 py-2 text-right font-bold text-emerald-800">
                          {r.debit_balance_xof > 0 ? r.debit_balance_xof.toLocaleString("fr-FR") : "-"}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-indigo-800">
                          {r.credit_balance_xof > 0 ? r.credit_balance_xof.toLocaleString("fr-FR") : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                  {balanceRows.length > 0 && (
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={2} className="px-4 py-3 text-right uppercase">Totaux Généraux :</td>
                      <td className="px-4 py-3 text-right">{balanceTotals.totalDebit.toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right">{balanceTotals.totalCredit.toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right text-emerald-800">{balanceTotals.totalDebitBalance.toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right text-indigo-800">{balanceTotals.totalCreditBalance.toLocaleString("fr-FR")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 4 : COMPTE DE RÉSULTAT & BILAN OHADA */}
      {activeTab === "STATEMENTS" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* COMPTE DE RÉSULTAT */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">SYSCOHADA Révisé</span>
              <h2 className="text-lg font-black text-slate-900">Compte de Résultat de la Période</h2>
            </div>
            {incomeStatement ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-slate-700">+ Ventes de marchandises (701)</span>
                  <span className="font-bold text-slate-900">{incomeStatement.ventesMarchandises.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-rose-800">
                  <span>- Achats nets & Variations de stocks (601 &plusmn; 6031)</span>
                  <span className="font-bold">{incomeStatement.coutAchatMarchandisesVendues.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-amber-50 px-3 rounded-lg font-black text-amber-900">
                  <span>= Marge Commerciale Brute</span>
                  <span>{incomeStatement.margeCommerciale.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-rose-800">
                  <span>- Charges externes & Fournitures (605, 62, 63)</span>
                  <span className="font-bold">{incomeStatement.autresChargesExternes.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-slate-100 px-3 rounded-lg font-black text-slate-900">
                  <span>= Valeur Ajoutée (VA)</span>
                  <span>{incomeStatement.valeurAjoutee.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-rose-800">
                  <span>- Charges de personnel (661) & Impôts (641)</span>
                  <span className="font-bold">{(incomeStatement.chargesPersonnel + incomeStatement.impotsTaxes).toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-slate-100 px-3 rounded-lg font-black text-slate-900">
                  <span>= Excédent Brut d'Exploitation (EBE)</span>
                  <span>{incomeStatement.excedentBrutExploitation.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-rose-800">
                  <span>- Dotations aux amortissements (681)</span>
                  <span className="font-bold">{incomeStatement.dotationsAmortissements.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-indigo-50 px-3 rounded-lg font-black text-indigo-900">
                  <span>= Résultat d'Exploitation (REX)</span>
                  <span>{incomeStatement.resultatExploitation.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="pt-2 border-t-2 border-slate-300 flex justify-between items-center py-2.5 px-3 rounded-xl bg-slate-900 text-white font-black text-sm">
                  <span>RÉSULTAT NET (BÉNÉFICE / PERTE)</span>
                  <span className={incomeStatement.isBenefice ? "text-emerald-400" : "text-rose-400"}>
                    {incomeStatement.resultatNet >= 0 ? "+" : ""}{incomeStatement.resultatNet.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-slate-700">Chargement du compte de résultat...</p>
            )}
          </div>

          {/* BILAN SYSCOHADA */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">SYSCOHADA Révisé</span>
              <h2 className="text-lg font-black text-slate-900">Bilan Synthétique (Actif vs Passif)</h2>
            </div>
            {balanceSheet ? (
              <div className="space-y-4 text-xs">
                {/* Section Actif */}
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-wider text-[11px] mb-2">ACTIF DU BILAN</h3>
                  <div className="space-y-1.5 border-l-2 border-emerald-500 pl-3">
                    <div className="flex justify-between">
                      <span className="text-slate-700">Actif Immobilisé Net (Classe 2)</span>
                      <span className="font-bold text-slate-900">{balanceSheet.actif.actifImmoNet.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Actif Circulant (Stocks & Créances 31/411)</span>
                      <span className="font-bold text-slate-900">{balanceSheet.actif.actifCirculant.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Trésorerie Actif (Banques & Caisses 52/57)</span>
                      <span className="font-bold text-slate-900">{balanceSheet.actif.tresorerieActif.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 font-black text-emerald-800">
                      <span>TOTAL ACTIF</span>
                      <span>{balanceSheet.actif.totalActif.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                  </div>
                </div>

                {/* Section Passif */}
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-wider text-[11px] mb-2">PASSIF DU BILAN</h3>
                  <div className="space-y-1.5 border-l-2 border-indigo-500 pl-3">
                    <div className="flex justify-between">
                      <span className="text-slate-700">Capitaux Propres & Résultat Net (Classe 1)</span>
                      <span className="font-bold text-slate-900">{balanceSheet.passif.capitauxPropres.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-700">Dettes Circulantes (Fournisseurs 401 & TVA)</span>
                      <span className="font-bold text-slate-900">{balanceSheet.passif.dettesCirculantes.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 font-black text-indigo-800">
                      <span>TOTAL PASSIF</span>
                      <span>{balanceSheet.passif.totalPassif.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-center">
                  <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black ${
                    balanceSheet.equilibreBilan ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {balanceSheet.equilibreBilan ? "✓ Bilan Rigoureusement Équilibré (Actif = Passif)" : "Écart Actif / Passif détecté"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-slate-700">Chargement du bilan...</p>
            )}
          </div>
        </div>
      )}

      {/* MODAL NOUVELLE ÉCRITURE D'OD */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateEntry} className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900">Saisie d’une pièce comptable (Opérations Diverses)</h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Journal</label>
                <select
                  value={entryJournal}
                  onChange={(e) => setEntryJournal(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                >
                  {journals.map((j) => (
                    <option key={j.id} value={j.code}>{j.code} - {j.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date d’écriture</label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pièce de référence</label>
                <input
                  type="text"
                  placeholder="Ex: QUITT-001, OD-PAIE"
                  value={entryRef}
                  onChange={(e) => setEntryRef(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Libellé général de l’opération</label>
              <input
                type="text"
                required
                placeholder="Ex: Régularisation de fin de mois, Écriture de dotation amortissement"
                value={entryDesc}
                onChange={(e) => setEntryDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>

            {/* Lignes de débit/crédit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lignes d'écriture (Partie Double)</p>
                <button
                  type="button"
                  onClick={addEntryLine}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  + Ajouter une ligne
                </button>
              </div>

              <div className="space-y-2">
                {entryLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="col-span-3">
                      <select
                        value={line.accountNumber}
                        onChange={(e) => updateEntryLine(idx, "accountNumber", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-1.5 font-bold focus:border-slate-900 focus:outline-none"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.account_number}>
                            {a.account_number} - {a.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Tiers / Détail..."
                        value={line.partnerName}
                        onChange={(e) => updateEntryLine(idx, "partnerName", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-1.5 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Débit (FCFA)"
                        value={line.debitAmountXof || ""}
                        onChange={(e) => updateEntryLine(idx, "debitAmountXof", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-1.5 text-right font-black focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Crédit (FCFA)"
                        value={line.creditAmountXof || ""}
                        onChange={(e) => updateEntryLine(idx, "creditAmountXof", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-1.5 text-right font-black focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {entryLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeEntryLine(idx)}
                          className="text-rose-500 font-bold hover:text-rose-700 text-sm px-2"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Barre de contrôle d'équilibre en temps réel */}
              <div className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-bold"
                style={{
                  backgroundColor: formIsBalanced ? "#f0fdf4" : "#fff1f2",
                  borderColor: formIsBalanced ? "#86efac" : "#fca5a5"
                }}
              >
                <div>
                  <span>Total Débit : <strong className="text-slate-900">{formTotalDebit.toLocaleString("fr-FR")} FCFA</strong></span>
                  <span className="mx-3">|</span>
                  <span>Total Crédit : <strong className="text-slate-900">{formTotalCredit.toLocaleString("fr-FR")} FCFA</strong></span>
                </div>
                <div>
                  {formIsBalanced ? (
                    <span className="text-emerald-800 font-black">✓ Pièce équilibrée</span>
                  ) : (
                    <span className="text-rose-800 font-black">
                      Écart : {Math.abs(formTotalDebit - formTotalCredit).toLocaleString("fr-FR")} FCFA
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!formIsBalanced}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                Enregistrer la pièce
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NOUVEAU COMPTE */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateAccount} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Ajouter un sous-compte SYSCOHADA</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de compte (ex: 4111, 4012, 5211)</label>
              <input
                type="text"
                required
                placeholder="Ex: 41110"
                value={newAccNumber}
                onChange={(e) => setNewAccNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Intitulé du compte</label>
              <input
                type="text"
                required
                placeholder="Ex: Clients Grands Comptes Cotonou"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type de compte</label>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                <option value="ASSET">Actif (Classe 2, 3, 411, 5)</option>
                <option value="LIABILITY">Passif / Dettes (Classe 16, 401, 42, 44)</option>
                <option value="EQUITY">Capitaux Propres (Classe 10, 11, 12)</option>
                <option value="EXPENSE">Charge (Classe 6)</option>
                <option value="REVENUE">Produit (Classe 7)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Créer le sous-compte
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
