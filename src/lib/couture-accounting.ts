export type CoutureAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "EXPENSE" | "REVENUE" | "OFF_BALANCE";

export type CoutureSyscohadaAccount = {
  accountNumber: string;
  accountName: string;
  accountClass: number;
  accountType: CoutureAccountType;
};

export const coutureSyscohadaCatalog: CoutureSyscohadaAccount[] = [
  // Classe 1 : Capitaux
  { accountNumber: "101", accountName: "Capital social", accountClass: 1, accountType: "EQUITY" },
  { accountNumber: "131", accountName: "Résultat net de l’exercice (bénéfice)", accountClass: 1, accountType: "EQUITY" },
  { accountNumber: "139", accountName: "Résultat net de l’exercice (perte)", accountClass: 1, accountType: "EQUITY" },

  // Classe 2 : Immobilisations
  { accountNumber: "215", accountName: "Matériel industriel & machines de confection", accountClass: 2, accountType: "ASSET" },
  { accountNumber: "241", accountName: "Matériel de bureau et informatique", accountClass: 2, accountType: "ASSET" },
  { accountNumber: "244", accountName: "Matériel et mobilier de boutique", accountClass: 2, accountType: "ASSET" },

  // Classe 3 : Stocks
  { accountNumber: "311", accountName: "Stocks de tissus et matières premières", accountClass: 3, accountType: "ASSET" },
  { accountNumber: "321", accountName: "Stocks de fournitures et mercerie", accountClass: 3, accountType: "ASSET" },
  { accountNumber: "351", accountName: "Stocks de vêtements finis confectionnés", accountClass: 3, accountType: "ASSET" },
  { accountNumber: "352", accountName: "Stocks d’accessoires de mode", accountClass: 3, accountType: "ASSET" },

  // Classe 4 : Tiers
  { accountNumber: "401", accountName: "Fournisseurs de tissus et mercerie", accountClass: 4, accountType: "LIABILITY" },
  { accountNumber: "411", accountName: "Clients atelier et boutiques", accountClass: 4, accountType: "ASSET" },
  { accountNumber: "421", accountName: "Personnel, rémunérations dues (salaires & tâche)", accountClass: 4, accountType: "LIABILITY" },
  { accountNumber: "431", accountName: "Sécurité sociale et charges sociales", accountClass: 4, accountType: "LIABILITY" },
  { accountNumber: "443", accountName: "État, TVA facturée sur ventes", accountClass: 4, accountType: "LIABILITY" },
  { accountNumber: "445", accountName: "État, TVA récupérable sur achats", accountClass: 4, accountType: "ASSET" },

  // Classe 5 : Trésorerie
  { accountNumber: "521", accountName: "Banques locales", accountClass: 5, accountType: "ASSET" },
  { accountNumber: "571", accountName: "Caisses des boutiques", accountClass: 5, accountType: "ASSET" },
  { accountNumber: "572", accountName: "Petite caisse atelier", accountClass: 5, accountType: "ASSET" },
  { accountNumber: "573", accountName: "Comptes Mobile Money", accountClass: 5, accountType: "ASSET" },
  { accountNumber: "585", accountName: "Virements internes de fonds", accountClass: 5, accountType: "ASSET" },

  // Classe 6 : Charges
  { accountNumber: "601", accountName: "Achats de tissus et matières premières", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "602", accountName: "Achats de fournitures (fils, boutons, zips)", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "605", accountName: "Achats d’accessoires de mode revendus", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "612", accountName: "Transports et transferts inter-sites", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "624", accountName: "Entretien machines et matériel couture", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "661", accountName: "Rémunérations fixes du personnel", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "662", accountName: "Rémunérations ouvriers à la tâche (pièces)", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "663", accountName: "Primes et gratifications vendeurs / commerciaux", accountClass: 6, accountType: "EXPENSE" },
  { accountNumber: "676", accountName: "Pertes de change sur devises", accountClass: 6, accountType: "EXPENSE" },

  // Classe 7 : Produits
  { accountNumber: "701", accountName: "Ventes de vêtements prêts-à-porter", accountClass: 7, accountType: "REVENUE" },
  { accountNumber: "702", accountName: "Ventes d’accessoires de mode", accountClass: 7, accountType: "REVENUE" },
  { accountNumber: "706", accountName: "Prestations de service (confection sur mesure, retouche)", accountClass: 7, accountType: "REVENUE" },
  { accountNumber: "776", accountName: "Gains de change sur devises", accountClass: 7, accountType: "REVENUE" },
];

export const coutureStandardJournals = [
  { code: "VE", name: "Journal des Ventes" },
  { code: "AC", name: "Journal des Achats" },
  { code: "BQ", name: "Journal de Banque" },
  { code: "CA", name: "Journal de Caisse" },
  { code: "OD", name: "Opérations Diverses" },
  { code: "PA", name: "Journal de la Paie (Salaires & Tâche)" },
] as const;

export type CoutureJournalCode = (typeof coutureStandardJournals)[number]["code"];

/**
 * Génère le numéro séquentiel de pièce comptable : ECR-YYYY-XXXXXX.
 */
export function generateCoutureEntryNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `ECR-${year}-${padded}`;
}

/**
 * Génère le numéro séquentiel de virement de trésorerie : VIR-YYYY-XXXXXX.
 */
export function generateCoutureTreasuryTransferNumber(sequenceNumber: number, year = new Date().getFullYear()): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(6, "0");
  return `VIR-${year}-${padded}`;
}

export type JournalEntryLineDraft = {
  accountNumber: string;
  label: string;
  debit: number;
  credit: number;
  currency?: string;
  amountInRefCurrency?: number;
};

export type BalancedEntryDraft = {
  journalCode: CoutureJournalCode;
  entryDate: string;
  fiscalYear: number;
  periodMonth: number;
  reference: string;
  description: string;
  sourceModule: "SALES" | "PURCHASES" | "PETTY_CASH" | "PAYROLL" | "TREASURY" | "MANUAL_OD";
  sourceId?: string;
  currency: string;
  lines: JournalEntryLineDraft[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
};

/**
 * Valide et garantit la règle de la partie double : Somme(Débits) === Somme(Crédits).
 */
export function validateBalancedEntry(lines: JournalEntryLineDraft[]): {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    totalDebit += Math.max(0, Math.round(Number(line.debit) || 0));
    totalCredit += Math.max(0, Math.round(Number(line.credit) || 0));
  }

  const difference = totalDebit - totalCredit;
  return {
    isBalanced: difference === 0 && totalDebit > 0,
    totalDebit,
    totalCredit,
    difference,
  };
}

/**
 * Construit une écriture comptable SYSCOHADA pour une Vente.
 * Exemples :
 * - Vente simple prêt-à-porter : Débit 571 (Caisse) ou 411 (Client), Crédit 701 (Vente vêtements), 443 (TVA éventuelle).
 * - Confection / Retouche : Débit 571/411, Crédit 706 (Prestations de service).
 */
export function buildSaleJournalEntry(params: {
  saleNumber: string;
  saleType: "READY_TO_WEAR" | "BESPOKE_ORDER" | "CUSTOMER_FABRIC_CONFECTION" | "ALTERATION";
  totalAmountXof: number;
  paidAmountXof: number;
  vatAmountXof?: number;
  paymentMethod?: "CASH" | "BANK" | "MOBILE_MONEY" | "CREDIT";
  entryDate?: string;
}): BalancedEntryDraft {
  const total = Math.max(0, Math.round(params.totalAmountXof));
  const vat = Math.max(0, Math.round(params.vatAmountXof || 0));
  const revenueAmount = Math.max(0, total - vat);
  const paid = Math.min(total, Math.max(0, Math.round(params.paidAmountXof)));
  const remaining = total - paid;

  const date = params.entryDate || new Date().toISOString().slice(0, 10);
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth() + 1;

  const lines: JournalEntryLineDraft[] = [];

  // Compte de produit (701 pour vêtements, 706 pour confection/retouche)
  const revenueAccount = params.saleType === "CUSTOMER_FABRIC_CONFECTION" || params.saleType === "ALTERATION"
    ? "706"
    : "701";

  // Crédit produit
  lines.push({
    accountNumber: revenueAccount,
    label: `Vente ${params.saleType} #${params.saleNumber}`,
    debit: 0,
    credit: revenueAmount,
  });

  // Crédit TVA si existante
  if (vat > 0) {
    lines.push({
      accountNumber: "443",
      label: `TVA facturée #${params.saleNumber}`,
      debit: 0,
      credit: vat,
    });
  }

  // Débit trésorerie pour la part payée
  if (paid > 0) {
    let treasuryAccount = "571"; // Caisse par défaut
    if (params.paymentMethod === "BANK") treasuryAccount = "521";
    if (params.paymentMethod === "MOBILE_MONEY") treasuryAccount = "573";

    lines.push({
      accountNumber: treasuryAccount,
      label: `Règlement vente #${params.saleNumber}`,
      debit: paid,
      credit: 0,
    });
  }

  // Débit compte client 411 pour le reste dû éventuel
  if (remaining > 0) {
    lines.push({
      accountNumber: "411",
      label: `Créance client vente #${params.saleNumber}`,
      debit: remaining,
      credit: 0,
    });
  }

  const check = validateBalancedEntry(lines);

  return {
    journalCode: "VE",
    entryDate: date,
    fiscalYear: year,
    periodMonth: month,
    reference: params.saleNumber,
    description: `Facturation vente ${params.saleType}`,
    sourceModule: "SALES",
    currency: "FCFA",
    lines,
    totalDebit: check.totalDebit,
    totalCredit: check.totalCredit,
    isBalanced: check.isBalanced,
  };
}

/**
 * Construit une écriture comptable SYSCOHADA pour une Dépense de Petite Caisse d'Atelier.
 * Débit 602 (Achats fournitures mercerie), Crédit 572 (Petite caisse atelier).
 */
export function buildPettyCashJournalEntry(params: {
  expenseNumber: string;
  amountXof: number;
  description: string;
  entryDate?: string;
}): BalancedEntryDraft {
  const amount = Math.max(0, Math.round(params.amountXof));
  const date = params.entryDate || new Date().toISOString().slice(0, 10);
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth() + 1;

  const lines: JournalEntryLineDraft[] = [
    {
      accountNumber: "602",
      label: `Dépense petite caisse : ${params.description}`,
      debit: amount,
      credit: 0,
    },
    {
      accountNumber: "572",
      label: `Sortie petite caisse #${params.expenseNumber}`,
      debit: 0,
      credit: amount,
    },
  ];

  const check = validateBalancedEntry(lines);

  return {
    journalCode: "CA",
    entryDate: date,
    fiscalYear: year,
    periodMonth: month,
    reference: params.expenseNumber,
    description: `Petite caisse atelier : ${params.description}`,
    sourceModule: "PETTY_CASH",
    currency: "FCFA",
    lines,
    totalDebit: check.totalDebit,
    totalCredit: check.totalCredit,
    isBalanced: check.isBalanced,
  };
}

/**
 * Construit une écriture comptable SYSCOHADA pour la Paie Hebdomadaire des Ouvriers à la Tâche.
 * Débit 662 (Rémunérations ouvriers à la tâche), Crédit 421 (Personnel, rémunérations dues).
 * Et lors du paiement effectif : Débit 421, Crédit 571 (Caisse) ou 521 (Banque).
 */
export function buildPieceworkPayrollJournalEntry(params: {
  payrollNumber: string;
  workerName: string;
  netPayXof: number;
  entryDate?: string;
  isDisbursed?: boolean;
  disbursementAccount?: "571" | "521" | "573";
}): BalancedEntryDraft {
  const amount = Math.max(0, Math.round(params.netPayXof));
  const date = params.entryDate || new Date().toISOString().slice(0, 10);
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth() + 1;

  const lines: JournalEntryLineDraft[] = [];

  if (params.isDisbursed) {
    // Écriture de paiement direct : Débit 662, Crédit Caisse/Banque
    const disbAccount = params.disbursementAccount || "571";
    lines.push(
      {
        accountNumber: "662",
        label: `Paie à la tâche ${params.workerName} #${params.payrollNumber}`,
        debit: amount,
        credit: 0,
      },
      {
        accountNumber: disbAccount,
        label: `Paiement paie ouvrier ${params.workerName}`,
        debit: 0,
        credit: amount,
      }
    );
  } else {
    // Constatation de la charge : Débit 662, Crédit 421
    lines.push(
      {
        accountNumber: "662",
        label: `Paie à la tâche due ${params.workerName} #${params.payrollNumber}`,
        debit: amount,
        credit: 0,
      },
      {
        accountNumber: "421",
        label: `Dette rémunération ${params.workerName} #${params.payrollNumber}`,
        debit: 0,
        credit: amount,
      }
    );
  }

  const check = validateBalancedEntry(lines);

  return {
    journalCode: "PA",
    entryDate: date,
    fiscalYear: year,
    periodMonth: month,
    reference: params.payrollNumber,
    description: `Décompte paie à la tâche : ${params.workerName}`,
    sourceModule: "PAYROLL",
    currency: "FCFA",
    lines,
    totalDebit: check.totalDebit,
    totalCredit: check.totalCredit,
    isBalanced: check.isBalanced,
  };
}

/**
 * Calcul de consolidation multidevise : convertit un montant d'une devise source
 * vers la devise de référence de l'établissement selon le taux applicable.
 */
export function convertToConsolidatedReference(
  amount: number,
  fromCurrency: string,
  referenceCurrency = "FCFA",
  exchangeRate = 1
): number {
  const amt = Number(amount) || 0;
  if (fromCurrency === referenceCurrency || exchangeRate <= 0) {
    return Math.round(amt);
  }
  return Math.round(amt * exchangeRate);
}
