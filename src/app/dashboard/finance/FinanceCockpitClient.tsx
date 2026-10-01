"use client";

import { useEffect, useState } from "react";

type TreasuryAccount = {
  id: string;
  name: string;
  account_type: "CASH" | "BANK" | "MOBILE_MONEY";
  account_number?: string;
  bank_name?: string;
  initial_balance_xof: number;
  current_balance_xof: number;
  status: string;
};

type TreasuryTransaction = {
  id: string;
  account_id: string;
  transaction_type: "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT";
  amount_xof: number;
  balance_after_xof: number;
  reference: string;
  category?: string;
  description?: string;
  created_at: string;
};

type Expense = {
  id: string;
  expense_number: string;
  title: string;
  category: string;
  amount_xof: number;
  tax_amount_xof: number;
  total_amount_xof: number;
  paid_from_account_id: string;
  beneficiary?: string;
  receipt_reference?: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "PAID" | "REJECTED";
  approval_threshold_exceeded: boolean;
  notes?: string;
  expense_date: string;
  created_at: string;
  account?: { name: string; account_type: string };
};

type FixedAsset = {
  id: string;
  asset_code: string;
  name: string;
  syscohada_account: string;
  category: string;
  acquisition_date: string;
  acquisition_cost_xof: number;
  salvage_value_xof: number;
  lifespan_years: number;
  depreciation_method: string;
  location?: string;
  serial_number?: string;
  supplier_name?: string;
  accumulated_depreciation_xof: number;
  net_book_value_xof: number;
  status: "ACTIVE" | "SCRAPPED" | "SOLD";
  disposal_date?: string;
  disposal_proceeds_xof?: number;
  commerce_asset_depreciation_lines?: Array<{
    id: string;
    period_year: number;
    base_amount_xof: number;
    depreciation_amount_xof: number;
    accumulated_depreciation_xof: number;
    net_book_value_xof: number;
  }>;
};

const CATEGORIES_DEPENSES: Record<string, string> = {
  LOYER: "Loyer & Charges locatives",
  ENERGIE_EAU: "Électricité, Eau & Gaz",
  FOURNITURES: "Fournitures de bureau & Consommables",
  TRANSPORT_CARBURANT: "Transport & Carburant",
  SALAIRES_PRIMES: "Salaires, Primes & Gratifications",
  ENTRETIEN_REPARATION: "Entretien, Réparation & Maintenance",
  IMPOTS_TAXES: "Impôts, Taxes & Droits",
  FRAIS_BANCAIRES: "Frais bancaires & Commissions",
  MARKETING_COMMUNICATION: "Marketing, Publicité & Communication",
  DIVERS: "Charges diverses",
};

const CATEGORIES_IMMOBILISATIONS: Record<string, string> = {
  MATERIEL_INFORMATIQUE: "Matériel informatique & Télécoms",
  MATERIEL_EXPLOITATION: "Matériel d'exploitation & Outillage",
  MOBILIER_BUREAU: "Mobilier de bureau & Agencement",
  VEHICULE_TRANSPORT: "Matériel de transport & Logistique",
  INSTALLATION_AGENCEMENT: "Installations générales & Locaux",
  LOGICIEL_LICENCE: "Logiciels, Licences & Brevets",
  AUTRE: "Autres immobilisations",
};

export function FinanceCockpitClient({
  tenantId,
  companyName,
  userRole,
  canApproveExpenses,
}: {
  tenantId: string;
  companyName: string;
  userRole: string;
  canApproveExpenses: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"TREASURY" | "EXPENSES" | "ASSETS">("TREASURY");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Données de Trésorerie
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [treasurySummary, setTreasurySummary] = useState({
    cashTotal: 0,
    bankTotal: 0,
    momoTotal: 0,
    netLiquidity: 0,
  });

  // Données Dépenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState({
    totalExpensesXof: 0,
    pendingApprovalXof: 0,
    categoryTotals: {} as Record<string, number>,
  });

  // Données Immobilisations
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [assetSummary, setAssetSummary] = useState({
    totalAcquisitionCost: 0,
    totalAccumulatedDeprec: 0,
    totalNetBookValue: 0,
  });
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState(false);

  // Formulaire Nouveau Compte
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<"CASH" | "BANK" | "MOBILE_MONEY">("CASH");
  const [accNumber, setAccNumber] = useState("");
  const [accBankName, setAccBankName] = useState("");
  const [accInitBal, setAccInitBal] = useState(0);

  // Formulaire Virement Interne
  const [trfSourceId, setTrfSourceId] = useState("");
  const [trfDestId, setTrfDestId] = useState("");
  const [trfAmount, setTrfAmount] = useState(0);
  const [trfFee, setTrfFee] = useState(0);
  const [trfNotes, setTrfNotes] = useState("");

  // Formulaire Dépense
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState("LOYER");
  const [expAmount, setExpAmount] = useState(0);
  const [expTax, setExpTax] = useState(0);
  const [expAccount, setExpAccount] = useState("");
  const [expBeneficiary, setExpBeneficiary] = useState("");
  const [expReceiptRef, setExpReceiptRef] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expNotes, setExpNotes] = useState("");

  // Formulaire Immobilisation
  const [astName, setAstName] = useState("");
  const [astAccount, setAstAccount] = useState("241");
  const [astCategory, setAstCategory] = useState("MATERIEL_EXPLOITATION");
  const [astCost, setAstCost] = useState(0);
  const [astSalvage, setAstSalvage] = useState(0);
  const [astYears, setAstYears] = useState(5);
  const [astDate, setAstDate] = useState(new Date().toISOString().split("T")[0]);
  const [astLocation, setAstLocation] = useState("");
  const [astSerial, setAstSerial] = useState("");
  const [astSupplier, setAstSupplier] = useState("");

  // Formulaire Sortie Immobilisation
  const [disposeStatus, setDisposeStatus] = useState<"SCRAPPED" | "SOLD">("SCRAPPED");
  const [disposeProceeds, setDisposeProceeds] = useState(0);
  const [disposeNotes, setDisposeNotes] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [accRes, expRes, astRes] = await Promise.all([
        fetch("/api/commerce/treasury/accounts"),
        fetch("/api/commerce/expenses"),
        fetch("/api/commerce/assets"),
      ]);

      if (accRes.ok) {
        const d = await accRes.json();
        setAccounts(d.accounts || []);
        setTransactions(d.transactions || []);
        setTreasurySummary(d.summary || { cashTotal: 0, bankTotal: 0, momoTotal: 0, netLiquidity: 0 });
        if (d.accounts?.length > 0) {
          if (!expAccount) setExpAccount(d.accounts[0].id);
          if (!trfSourceId) setTrfSourceId(d.accounts[0].id);
          if (d.accounts.length > 1 && !trfDestId) setTrfDestId(d.accounts[1].id);
        }
      }

      if (expRes.ok) {
        const d = await expRes.json();
        setExpenses(d.expenses || []);
        setExpenseSummary(d.summary || { totalExpensesXof: 0, pendingApprovalXof: 0, categoryTotals: {} });
      }

      if (astRes.ok) {
        const d = await astRes.json();
        setAssets(d.assets || []);
        setAssetSummary(d.summary || { totalAcquisitionCost: 0, totalAccumulatedDeprec: 0, totalNetBookValue: 0 });
      }
    } catch {
      setError("Impossible de contacter le serveur pour charger les finances.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Création d'un compte
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/commerce/treasury/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accName,
          accountType: accType,
          accountNumber: accNumber,
          bankName: accBankName,
          initialBalanceXof: accInitBal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création de compte.");
      setSuccessMsg(data.message);
      setShowAccountModal(false);
      setAccName("");
      setAccNumber("");
      setAccBankName("");
      setAccInitBal(0);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  // Virement interne
  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/commerce/treasury/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccountId: trfSourceId,
          destinationAccountId: trfDestId,
          amountXof: trfAmount,
          transferFeeXof: trfFee,
          notes: trfNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de virement.");
      setSuccessMsg(data.message);
      setShowTransferModal(false);
      setTrfAmount(0);
      setTrfFee(0);
      setTrfNotes("");
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  // Création dépense
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/commerce/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: expTitle,
          category: expCategory,
          amountXof: expAmount,
          taxAmountXof: expTax,
          paidFromAccountId: expAccount,
          beneficiary: expBeneficiary,
          receiptReference: expReceiptRef,
          expenseDate: expDate,
          notes: expNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement de dépense.");
      setSuccessMsg(data.message);
      setShowExpenseModal(false);
      setExpTitle("");
      setExpAmount(0);
      setExpTax(0);
      setExpBeneficiary("");
      setExpReceiptRef("");
      setExpNotes("");
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  // Approbation d'une dépense en attente
  async function handleApproveExpense(expenseId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/commerce/expenses/${expenseId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec d'approbation.");
      setSuccessMsg(data.message);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  // Création immobilisation
  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/commerce/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: astName,
          syscohadaAccount: astAccount,
          category: astCategory,
          acquisitionCostXof: astCost,
          salvageValueXof: astSalvage,
          lifespanYears: astYears,
          acquisitionDate: astDate,
          location: astLocation,
          serialNumber: astSerial,
          supplierName: astSupplier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création d'immobilisation.");
      setSuccessMsg(data.message);
      setShowAssetModal(false);
      setAstName("");
      setAstCost(0);
      setAstSalvage(0);
      setAstLocation("");
      setAstSerial("");
      setAstSupplier("");
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  // Consulter le plan d'amortissement détaillé
  async function viewAssetSchedule(assetId: string) {
    try {
      const res = await fetch(`/api/commerce/assets/${assetId}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedAsset(d.asset);
      }
    } catch {
      setError("Impossible de charger le plan d'amortissement.");
    }
  }

  // Cession / Rebut d'immobilisation
  async function handleDisposeAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(null);
    try {
      const res = await fetch(`/api/commerce/assets/${selectedAsset.id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: disposeStatus,
          proceedsXof: disposeProceeds,
          notes: disposeNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de sortie d'actif.");
      setSuccessMsg(data.message);
      setShowDisposeModal(false);
      setSelectedAsset(null);
      setDisposeProceeds(0);
      setDisposeNotes("");
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-600/10 px-2.5 py-1 text-xs font-bold text-emerald-800">
              Module Commerce & Boutique
            </span>
            <span className="text-xs font-medium text-slate-700">Sprint 9 : Trésorerie, Charges & Actifs</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
            Gestion Financière & Immobilisations
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
            <span>🏦</span> Nouveau Compte
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            <span>⇄</span> Virement Interne
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
          >
            <span>💸</span> Saisir Dépense
          </button>
          <button
            onClick={() => setShowAssetModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition"
          >
            <span>🏢</span> Nouvelle Immo
          </button>
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

      {/* Cartes KPI Synthèse */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Disponibilités Nettes</p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {treasurySummary.netLiquidity.toLocaleString("fr-FR")} <span className="text-sm font-normal text-slate-700">FCFA</span>
          </p>
          <p className="mt-1 text-xs text-slate-700 font-medium">
            Caisses ({treasurySummary.cashTotal.toLocaleString("fr-FR")}) + Banques & MoMo
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Dépenses Réalisées</p>
          <p className="mt-2 text-2xl font-black text-amber-700">
            {expenseSummary.totalExpensesXof.toLocaleString("fr-FR")} <span className="text-sm font-normal text-slate-700">FCFA</span>
          </p>
          <p className="mt-1 text-xs text-slate-700 font-medium">
            Total des charges décaissées de la période
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">À Valider (Seuil &ge; 100k)</p>
            {expenseSummary.pendingApprovalXof > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 animate-pulse">
                Action Requise
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-black text-rose-700">
            {expenseSummary.pendingApprovalXof.toLocaleString("fr-FR")} <span className="text-sm font-normal text-slate-700">FCFA</span>
          </p>
          <p className="mt-1 text-xs text-slate-700 font-medium">
            Dépenses en attente d’accord Promoteur/Gérant
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Valeur Nette Actifs (VNC)</p>
          <p className="mt-2 text-2xl font-black text-indigo-700">
            {assetSummary.totalNetBookValue.toLocaleString("fr-FR")} <span className="text-sm font-normal text-slate-700">FCFA</span>
          </p>
          <p className="mt-1 text-xs text-slate-700 font-medium">
            Brut : {assetSummary.totalAcquisitionCost.toLocaleString("fr-FR")} · Amort : {assetSummary.totalAccumulatedDeprec.toLocaleString("fr-FR")}
          </p>
        </div>
      </div>

      {/* Sélecteur d'Onglets */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("TREASURY")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "TREASURY"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          🏦 Trésorerie & Comptes ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab("EXPENSES")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "EXPENSES"
              ? "border-amber-600 text-amber-800"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          💸 Dépenses & Charges ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("ASSETS")}
          className={`pb-3 text-sm font-bold transition border-b-2 ${
            activeTab === "ASSETS"
              ? "border-indigo-600 text-indigo-800"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          🏢 Registre des Immobilisations ({assets.length})
        </button>
      </div>

      {/* CONTENU ONGLET 1 : TRÉSORERIE */}
      {activeTab === "TREASURY" && (
        <div className="space-y-6">
          {/* Grille des comptes de trésorerie */}
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3">Comptes de liquidités</h2>
            {accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-white">
                <p className="text-sm font-medium text-slate-700">Aucun compte de trésorerie configuré.</p>
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
                >
                  Ajouter un premier compte
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((acc) => (
                  <div key={acc.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xl">
                        {acc.account_type === "CASH" ? "💵" : acc.account_type === "BANK" ? "🏦" : "📱"}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 uppercase">
                        {acc.account_type === "CASH" ? "Caisse" : acc.account_type === "BANK" ? "Banque" : "Mobile Money"}
                      </span>
                    </div>
                    <p className="mt-2 text-base font-black text-slate-900">{acc.name}</p>
                    {acc.account_number && (
                      <p className="text-xs text-slate-700 font-medium">N° : {acc.account_number}</p>
                    )}
                    {acc.bank_name && (
                      <p className="text-xs text-slate-700 font-medium">Établissement : {acc.bank_name}</p>
                    )}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">Solde actuel :</span>
                      <span className="text-lg font-black text-emerald-800">
                        {Number(acc.current_balance_xof).toLocaleString("fr-FR")} FCFA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Journal des dernières opérations de trésorerie */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Derniers mouvements de trésorerie</h2>
              <span className="text-xs text-slate-700 font-medium">{transactions.length} opération(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Réf.</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3 text-right">Montant</th>
                    <th className="px-5 py-3 text-right">Solde Après</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-700">
                        Aucun mouvement de trésorerie enregistré.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isPositive = tx.transaction_type === "INCOME" || tx.transaction_type === "TRANSFER_IN";
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-3 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleDateString("fr-FR")} {new Date(tx.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              isPositive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-900">{tx.reference}</td>
                          <td className="px-5 py-3">{tx.description || tx.category || "-"}</td>
                          <td className={`px-5 py-3 text-right font-black ${isPositive ? "text-emerald-800" : "text-rose-800"}`}>
                            {isPositive ? "+" : "-"}{Number(tx.amount_xof).toLocaleString("fr-FR")} FCFA
                          </td>
                          <td className="px-5 py-3 text-right text-slate-900 font-bold">
                            {Number(tx.balance_after_xof).toLocaleString("fr-FR")} FCFA
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 2 : DÉPENSES */}
      {activeTab === "EXPENSES" && (
        <div className="space-y-6">
          {/* Liste des dépenses */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Registre des dépenses & charges</h2>
                <p className="text-xs text-slate-700 font-medium">Justification obligatoire pour toute sortie de fonds</p>
              </div>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
              >
                + Enregistrer une Dépense
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Réf.</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Titre & Bénéficiaire</th>
                    <th className="px-5 py-3">Catégorie SYSCOHADA</th>
                    <th className="px-5 py-3">Compte Payeur</th>
                    <th className="px-5 py-3 text-right">Montant</th>
                    <th className="px-5 py-3 text-center">Statut</th>
                    <th className="px-5 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-700">
                        Aucune dépense enregistrée.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-black text-slate-900 whitespace-nowrap">{exp.expense_number}</td>
                        <td className="px-5 py-3 whitespace-nowrap">{new Date(exp.expense_date).toLocaleDateString("fr-FR")}</td>
                        <td className="px-5 py-3">
                          <p className="font-bold text-slate-900">{exp.title}</p>
                          {exp.beneficiary && <p className="text-[10px] text-slate-700">Bénéficiaire : {exp.beneficiary}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800">
                            {CATEGORIES_DEPENSES[exp.category] || exp.category}
                          </span>
                        </td>
                        <td className="px-5 py-3">{exp.account?.name || "-"}</td>
                        <td className="px-5 py-3 text-right font-black text-slate-900">
                          {Number(exp.total_amount_xof).toLocaleString("fr-FR")} FCFA
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            exp.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : exp.status === "PENDING_APPROVAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {exp.status === "PAID" ? "Payée" : exp.status === "PENDING_APPROVAL" ? "En attente accord" : exp.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {exp.status === "PENDING_APPROVAL" && canApproveExpenses && (
                            <button
                              onClick={() => handleApproveExpense(exp.id)}
                              className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 transition"
                            >
                              Approuver
                            </button>
                          )}
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

      {/* CONTENU ONGLET 3 : IMMOBILISATIONS */}
      {activeTab === "ASSETS" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Registre des immobilisations & matériels</h2>
                <p className="text-xs text-slate-700 font-medium">Calcul et suivi automatique de l’amortissement linéaire SYSCOHADA</p>
              </div>
              <button
                onClick={() => setShowAssetModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition"
              >
                + Enregistrer Immobilisation
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Code Immo</th>
                    <th className="px-5 py-3">Désignation</th>
                    <th className="px-5 py-3">Compte OHADA</th>
                    <th className="px-5 py-3">Acquisition</th>
                    <th className="px-5 py-3 text-right">Valeur Brute</th>
                    <th className="px-5 py-3 text-right">Amort. Cumulés</th>
                    <th className="px-5 py-3 text-right">Valeur Nette (VNC)</th>
                    <th className="px-5 py-3 text-center">Statut</th>
                    <th className="px-5 py-3 text-center">Plan d’Amort.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {assets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-8 text-center text-slate-700">
                        Aucune immobilisation enregistrée.
                      </td>
                    </tr>
                  ) : (
                    assets.map((ast) => (
                      <tr key={ast.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-black text-slate-900 whitespace-nowrap">{ast.asset_code}</td>
                        <td className="px-5 py-3">
                          <p className="font-bold text-slate-900">{ast.name}</p>
                          <p className="text-[10px] text-slate-700">{CATEGORIES_IMMOBILISATIONS[ast.category] || ast.category}</p>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-800">{ast.syscohada_account}</td>
                        <td className="px-5 py-3 whitespace-nowrap">{new Date(ast.acquisition_date).toLocaleDateString("fr-FR")}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          {Number(ast.acquisition_cost_xof).toLocaleString("fr-FR")} FCFA
                        </td>
                        <td className="px-5 py-3 text-right text-rose-800 font-bold">
                          {Number(ast.accumulated_depreciation_xof).toLocaleString("fr-FR")} FCFA
                        </td>
                        <td className="px-5 py-3 text-right font-black text-indigo-700">
                          {Number(ast.net_book_value_xof).toLocaleString("fr-FR")} FCFA
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ast.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : ast.status === "SOLD"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-200 text-slate-800"
                          }`}>
                            {ast.status === "ACTIVE" ? "En service" : ast.status === "SOLD" ? "Cédée" : "Mise au rebut"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => viewAssetSchedule(ast.id)}
                            className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Détails & Plan 📊
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

      {/* MODAL PLAN D'AMORTISSEMENT DÉTAILLÉ */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">{selectedAsset.asset_code}</span>
                <h3 className="text-xl font-black text-slate-900">{selectedAsset.name}</h3>
                <p className="text-xs text-slate-700 font-medium">
                  Compte OHADA : {selectedAsset.syscohada_account} · Durée : {selectedAsset.lifespan_years} an(s) · Coût : {Number(selectedAsset.acquisition_cost_xof).toLocaleString("fr-FR")} FCFA
                </p>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-700 hover:text-slate-900 font-black text-lg">✕</button>
            </div>

            {/* Tableau du plan */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Année</th>
                    <th className="px-4 py-3 text-right">Base Amortissable</th>
                    <th className="px-4 py-3 text-right">Dotation Annuelle</th>
                    <th className="px-4 py-3 text-right">Amort. Cumulés</th>
                    <th className="px-4 py-3 text-right">VNC Finale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {selectedAsset.commerce_asset_depreciation_lines?.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-black text-slate-900">{line.period_year}</td>
                      <td className="px-4 py-2.5 text-right">{Number(line.base_amount_xof).toLocaleString("fr-FR")} FCFA</td>
                      <td className="px-4 py-2.5 text-right font-bold text-amber-700">{Number(line.depreciation_amount_xof).toLocaleString("fr-FR")} FCFA</td>
                      <td className="px-4 py-2.5 text-right text-rose-800">{Number(line.accumulated_depreciation_xof).toLocaleString("fr-FR")} FCFA</td>
                      <td className="px-4 py-2.5 text-right font-black text-indigo-700">{Number(line.net_book_value_xof).toLocaleString("fr-FR")} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bouton Sortie / Cession */}
            {selectedAsset.status === "ACTIVE" && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowDisposeModal(true)}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
                >
                  Sortir l’actif (Cession ou Rebut)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL NOUVEAU COMPTE */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateAccount} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Nouveau compte de trésorerie</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom du compte</label>
              <input
                type="text"
                required
                placeholder="Ex: Caisse Principale, Compte BOA, MTN MoMo Marchand"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type de compte</label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as "CASH" | "BANK" | "MOBILE_MONEY")}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                <option value="CASH">Caisse physique (Espèces)</option>
                <option value="BANK">Compte Bancaire</option>
                <option value="MOBILE_MONEY">Compte Mobile Money (MTN, Moov, Wave...)</option>
              </select>
            </div>
            {accType !== "CASH" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom de la Banque / Opérateur</label>
                  <input
                    type="text"
                    placeholder="Ex: BOA Bénin, Ecobank, MTN Bénin"
                    value={accBankName}
                    onChange={(e) => setAccBankName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">N° de compte / RIB / N° Téléphone</label>
                  <input
                    type="text"
                    placeholder="Ex: BJ061... ou 97 00 00 00"
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Solde d’ouverture (FCFA)</label>
              <input
                type="number"
                min="0"
                value={accInitBal}
                onChange={(e) => setAccInitBal(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
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
                Créer le compte
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL VIREMENT INTERNE */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleTransfer} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Virement interne de trésorerie</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Compte Source (Débité)</label>
              <select
                value={trfSourceId}
                onChange={(e) => setTrfSourceId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({Number(acc.current_balance_xof).toLocaleString("fr-FR")} FCFA dispo)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Compte Destination (Crédité)</label>
              <select
                value={trfDestId}
                onChange={(e) => setTrfDestId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({Number(acc.current_balance_xof).toLocaleString("fr-FR")} FCFA dispo)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Montant à transférer (FCFA)</label>
              <input
                type="number"
                min="1"
                required
                value={trfAmount}
                onChange={(e) => setTrfAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Frais de transfert éventuels (FCFA)</label>
              <input
                type="number"
                min="0"
                value={trfFee}
                onChange={(e) => setTrfFee(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Motif / Notes</label>
              <input
                type="text"
                placeholder="Ex: Dépôt caisse en banque ou retrait MoMo"
                value={trfNotes}
                onChange={(e) => setTrfNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                Valider le Virement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NOUVELLE DÉPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateExpense} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900">Enregistrer une dépense / charge</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Intitulé de la dépense</label>
              <input
                type="text"
                required
                placeholder="Ex: Loyer magasin mois en cours, Facture SBEE électricité"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie SYSCOHADA</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                {Object.entries(CATEGORIES_DEPENSES).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Montant HT (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">TVA (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  value={expTax}
                  onChange={(e) => setExpTax(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Compte payeur</label>
              <select
                value={expAccount}
                onChange={(e) => setExpAccount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({Number(acc.current_balance_xof).toLocaleString("fr-FR")} FCFA)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bénéficiaire (Optionnel)</label>
              <input
                type="text"
                placeholder="Ex: Propriétaire bailleur, SBEE, Fournisseur X"
                value={expBeneficiary}
                onChange={(e) => setExpBeneficiary(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Référence reçu / facture justificative</label>
              <input
                type="text"
                placeholder="Ex: FAC-SBEE-2026-9921"
                value={expReceiptRef}
                onChange={(e) => setExpReceiptRef(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition"
              >
                Enregistrer la dépense
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NOUVELLE IMMOBILISATION */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateAsset} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900">Enregistrer une immobilisation</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Désignation de l’actif</label>
              <input
                type="text"
                required
                placeholder="Ex: Climatiseur Split 2CV Magasin, Tricycle de livraison"
                value={astName}
                onChange={(e) => setAstName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie</label>
                <select
                  value={astCategory}
                  onChange={(e) => setAstCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                >
                  {Object.entries(CATEGORIES_IMMOBILISATIONS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Compte SYSCOHADA</label>
                <select
                  value={astAccount}
                  onChange={(e) => setAstAccount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                >
                  <option value="21">21 - Immobilisations incorporelles</option>
                  <option value="23">23 - Bâtiments & Installations</option>
                  <option value="241">241 - Matériel & Outillage</option>
                  <option value="244">244 - Matériel de bureau & Informatique</option>
                  <option value="245">245 - Matériel de transport</option>
                  <option value="248">248 - Autres immobilisations</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Coût d’Acquisition (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={astCost}
                  onChange={(e) => setAstCost(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Valeur Résiduelle</label>
                <input
                  type="number"
                  min="0"
                  value={astSalvage}
                  onChange={(e) => setAstSalvage(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Durée (Années)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={astYears}
                  onChange={(e) => setAstYears(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Localisation / Rayon</label>
              <input
                type="text"
                placeholder="Ex: Caisse 1, Magasin central, Bureau gérant"
                value={astLocation}
                onChange={(e) => setAstLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssetModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition"
              >
                Générer l’Immo & le Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL SORTIE D'IMMOBILISATION */}
      {showDisposeModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleDisposeAsset} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Sortir l’immobilisation {selectedAsset.asset_code}</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type de sortie</label>
              <select
                value={disposeStatus}
                onChange={(e) => setDisposeStatus(e.target.value as "SCRAPPED" | "SOLD")}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              >
                <option value="SCRAPPED">Mise au rebut (Casse / Perte / Obsolescence)</option>
                <option value="SOLD">Cession / Vente d’occasion</option>
              </select>
            </div>
            {disposeStatus === "SOLD" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prix de cession encaissé (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={disposeProceeds}
                  onChange={(e) => setDisposeProceeds(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Observations / Justification</label>
              <textarea
                placeholder="Ex: Panne irrémédiable du compresseur ou vente au tiers X"
                value={disposeNotes}
                onChange={(e) => setDisposeNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDisposeModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
              >
                Confirmer la Sortie
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
