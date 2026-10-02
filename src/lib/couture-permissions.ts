export const couturePermissionCatalog = [
  { key: "dashboard.view", label: "Consulter le tableau de bord", group: "Pilotage" },
  { key: "sites.view", label: "Consulter les sites (boutiques et ateliers)", group: "Sites" },
  { key: "sites.manage", label: "Gérer les sites", group: "Sites" },
  { key: "team.view", label: "Consulter l’équipe", group: "Équipe" },
  { key: "team.manage", label: "Gérer les collaborateurs et rôles", group: "Équipe" },
  { key: "audit.view", label: "Consulter le journal d’audit", group: "Sécurité" },
  { key: "catalog.view", label: "Consulter le catalogue mode", group: "Catalogue" },
  { key: "catalog.manage", label: "Gérer le catalogue mode (modèles, gammes, prix)", group: "Catalogue" },
  { key: "customers.view", label: "Consulter les fiches clients et mensurations", group: "Clients" },
  { key: "customers.manage", label: "Gérer les clients et mensurations", group: "Clients" },
  { key: "sales.view", label: "Consulter les ventes et commandes", group: "Ventes" },
  { key: "sales.create", label: "Enregistrer une vente, commande, confection ou retouche", group: "Ventes" },
  { key: "sales.multi_currency", label: "Encaisser au comptoir en multidevise (FCFA/USD/EUR)", group: "Caisse" },
  { key: "production.view", label: "Consulter le circuit de fabrication", group: "Atelier" },
  { key: "production.manage", label: "Piloter et prioriser la production", group: "Atelier" },
  { key: "production.assign", label: "Assigner les tâches aux ouvriers", group: "Atelier" },
  { key: "production.quality_control", label: "Valider le contrôle qualité", group: "Atelier" },
  { key: "piecework.view", label: "Consulter le barème et la paie à la tâche", group: "Atelier" },
  { key: "piecework.manage", label: "Gérer le barème de paie à la tâche", group: "Atelier" },
  { key: "piecework.declare", label: "Déclarer l’achèvement d’une tâche", group: "Atelier" },
  { key: "supplies.view", label: "Consulter les stocks de tissus et fournitures", group: "Fournitures" },
  { key: "supplies.manage", label: "Gérer les fournitures et réceptions", group: "Fournitures" },
  { key: "supplies.request", label: "Demander des fournitures pour la production", group: "Fournitures" },
  { key: "purchases.view", label: "Consulter les achats et demandes de fournitures", group: "Achats" },
  { key: "purchases.request", label: "Créer une demande d’achat de fournitures", group: "Achats" },
  { key: "purchases.approve_small", label: "Valider les achats < 50 000 FCFA (comptable)", group: "Achats" },
  { key: "purchases.approve_large", label: "Valider les achats ≥ 50 000 FCFA (direction/RH)", group: "Achats" },
  { key: "petty_cash.view", label: "Consulter la petite caisse d’atelier", group: "Trésorerie" },
  { key: "petty_cash.spend", label: "Engager une dépense de petite caisse", group: "Trésorerie" },
  { key: "petty_cash.visa", label: "Viser les dépenses et renouveler la petite caisse", group: "Trésorerie" },
  { key: "stock.view", label: "Consulter le stock de produits finis", group: "Stocks" },
  { key: "stock.manage", label: "Gérer les réceptions et expéditions boutique", group: "Stocks" },
  { key: "stock.transfer", label: "Transférer des stocks entre boutiques ou atelier", group: "Stocks" },
  { key: "inventory.view", label: "Consulter les inventaires physiques", group: "Inventaires" },
  { key: "inventory.count", label: "Saisir les comptages d’inventaire", group: "Inventaires" },
  { key: "inventory.validate", label: "Valider les écarts d’inventaire", group: "Inventaires" },
  { key: "treasury.view", label: "Consulter la trésorerie et les caisses", group: "Comptabilité" },
  { key: "accounting.view", label: "Consulter la comptabilité SYSCOHADA consolidée", group: "Comptabilité" },
  { key: "hr.view", label: "Consulter les dossiers du personnel", group: "Personnel" },
  { key: "hr.manage", label: "Gérer les plannings et conditions RH", group: "Personnel" },
  { key: "attendance.view", label: "Consulter les présences géolocalisées", group: "Personnel" },
  { key: "attendance.track", label: "Enregistrer sa présence géolocalisée", group: "Personnel" },
  { key: "payroll.view", label: "Consulter les décomptes de paie", group: "Paie" },
  { key: "payroll.calculate", label: "Calculer la paie à la tâche et salaires", group: "Paie" },
  { key: "payroll.approve", label: "Valider et autoriser les virements de paie", group: "Paie" },
  { key: "incentives.view", label: "Consulter les points, primes et classements", group: "Motivation" },
  { key: "incentives.manage", label: "Gérer les seuils de primes et récompenses", group: "Motivation" },
  { key: "reports.view", label: "Consulter les tableaux de bord et rapports", group: "Pilotage" },
  { key: "reports.export", label: "Exporter les données et rapports financiers", group: "Pilotage" },
] as const;

export type CouturePermission = (typeof couturePermissionCatalog)[number]["key"];
export const couturePermissionKeys = new Set<string>(couturePermissionCatalog.map(({ key }) => key));

export const coutureRoleLabels: Record<string, string> = {
  DIRECTEUR_GERANT: "Directeur / Gérant",
  CHEF_AGENCE: "Chef d’agence",
  VENDEUR: "Vendeur / Vendeuse",
  CHEF_ATELIER: "Chef d’atelier",
  OUVRIER: "Ouvrier de production",
  MAGASINIER_ATELIER: "Magasinier atelier",
  MAGASINIER_BOUTIQUE: "Magasinier boutique",
  ACHETEUR: "Chargé des achats",
  COMPTABLE: "Comptable",
  RH: "Responsable RH / Direction",
  INVENTAIRE: "Responsable d’inventaire",
};

export const coutureCraftLabels: Record<string, string> = {
  COUPEUR: "Coupeur",
  COUTURIER: "Couturier",
  BRODEUR_MAIN: "Brodeur main",
  BRODEUR_MACHINE: "Brodeur machine",
  FINISSEUR: "Finisseur",
};

export const coutureSiteTypeLabels: Record<string, string> = {
  BOUTIQUE: "Boutique (point de vente)",
  ATELIER: "Atelier (unité de production)",
};

export type CoutureAccessMode = "ACTIVE" | "GRACE" | "READ_ONLY" | "BLOCKED";

export function coutureAccessMode(
  company: { status?: string | null; trial_ends_at?: string | null; subscription_expires_at?: string | null },
  now = Date.now()
): CoutureAccessMode {
  const status = String(company.status ?? "").toUpperCase();
  if (["SUSPENDED", "CANCELLED"].includes(status)) return "BLOCKED";
  if (status === "EXPIRED") return "READ_ONLY";
  const cutoffValue = company.subscription_expires_at || company.trial_ends_at;
  if (!cutoffValue) return status === "EXPIRED" ? "READ_ONLY" : "ACTIVE";
  const cutoff = new Date(cutoffValue).getTime();
  if (!Number.isFinite(cutoff) || now <= cutoff) return "ACTIVE";
  if (now <= cutoff + 5 * 24 * 60 * 60 * 1000) return "GRACE";
  return "READ_ONLY";
}

export const defaultCoutureRolePermissions: Record<string, CouturePermission[]> = {
  DIRECTEUR_GERANT: [
    "dashboard.view", "sites.view", "sites.manage", "team.view", "team.manage", "audit.view",
    "catalog.view", "catalog.manage", "customers.view", "customers.manage",
    "sales.view", "sales.create", "sales.multi_currency",
    "production.view", "production.manage", "production.assign", "production.quality_control",
    "piecework.view", "piecework.manage",
    "supplies.view", "supplies.manage", "supplies.request",
    "purchases.view", "purchases.request", "purchases.approve_small", "purchases.approve_large",
    "petty_cash.view", "petty_cash.spend", "petty_cash.visa",
    "stock.view", "stock.manage", "stock.transfer",
    "inventory.view", "inventory.count", "inventory.validate",
    "treasury.view", "accounting.view",
    "hr.view", "hr.manage", "attendance.view", "attendance.track",
    "payroll.view", "payroll.calculate", "payroll.approve",
    "incentives.view", "incentives.manage", "reports.view", "reports.export",
  ],
  CHEF_AGENCE: [
    "dashboard.view", "sites.view", "team.view",
    "catalog.view", "customers.view", "customers.manage",
    "sales.view", "sales.create", "sales.multi_currency",
    "stock.view", "stock.manage", "stock.transfer",
    "inventory.view", "inventory.count",
    "attendance.view", "attendance.track",
    "incentives.view", "reports.view",
  ],
  VENDEUR: [
    "dashboard.view", "sites.view",
    "catalog.view", "customers.view", "customers.manage",
    "sales.view", "sales.create", "sales.multi_currency",
    "stock.view", "attendance.track",
    "incentives.view", "reports.view",
  ],
  CHEF_ATELIER: [
    "dashboard.view", "sites.view", "team.view",
    "catalog.view", "customers.view",
    "production.view", "production.manage", "production.assign", "production.quality_control",
    "piecework.view", "piecework.manage",
    "supplies.view", "supplies.request",
    "purchases.request",
    "stock.view", "stock.transfer",
    "attendance.view", "attendance.track", "reports.view",
  ],
  OUVRIER: [
    "dashboard.view",
    "production.view", "piecework.view", "piecework.declare",
    "attendance.track",
  ],
  MAGASINIER_ATELIER: [
    "dashboard.view", "sites.view",
    "supplies.view", "supplies.manage", "supplies.request",
    "purchases.request",
    "petty_cash.view", "petty_cash.spend",
    "inventory.view", "inventory.count",
    "attendance.track",
  ],
  MAGASINIER_BOUTIQUE: [
    "dashboard.view", "sites.view",
    "catalog.view",
    "stock.view", "stock.manage", "stock.transfer",
    "inventory.view", "inventory.count",
    "attendance.track",
  ],
  ACHETEUR: [
    "dashboard.view", "sites.view",
    "supplies.view",
    "purchases.view", "purchases.request",
    "attendance.track", "reports.view",
  ],
  COMPTABLE: [
    "dashboard.view", "sites.view",
    "sales.view", "supplies.view",
    "purchases.view", "purchases.approve_small",
    "petty_cash.view", "petty_cash.visa",
    "treasury.view", "accounting.view",
    "payroll.view", "payroll.calculate",
    "reports.view", "reports.export",
  ],
  RH: [
    "dashboard.view", "sites.view", "team.view", "team.manage",
    "purchases.view", "purchases.approve_large",
    "hr.view", "hr.manage", "attendance.view",
    "payroll.view", "payroll.approve",
    "incentives.view", "incentives.manage",
    "reports.view",
  ],
  INVENTAIRE: [
    "dashboard.view", "sites.view",
    "catalog.view", "stock.view", "supplies.view",
    "inventory.view", "inventory.count", "inventory.validate",
    "attendance.track", "reports.view",
  ],
};
