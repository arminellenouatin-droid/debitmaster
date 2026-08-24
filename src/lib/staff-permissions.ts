// DebitManager authorization vocabulary: UI labels are not authorization; API policies remain the enforcement boundary.
export const permissionCatalog = [
  { key: "orders.view", label: "Consulter les commandes", group: "Commandes" },
  { key: "orders.create", label: "Créer une commande", group: "Commandes" },
  { key: "orders.prepare", label: "Préparer une commande", group: "Commandes" },
  { key: "orders.deliver", label: "Livrer une commande au client", group: "Commandes" },
  { key: "orders.receive", label: "Accuser réception d’une commande", group: "Commandes" },
  { key: "orders.handoff", label: "Remettre une commande au service", group: "Commandes" },
  { key: "tables.view", label: "Consulter le plan de salle", group: "Tables" },
  { key: "tables.manage", label: "Gérer les tables", group: "Tables" },
  { key: "stock.view", label: "Consulter le stock", group: "Stocks" },
  { key: "stock.adjust", label: "Ajuster le stock", group: "Stocks" },
  { key: "stock.receive", label: "Enregistrer une réception de livraison", group: "Stocks" },
  { key: "stock.issue", label: "Préparer une sortie de stock quotidienne", group: "Stocks" },
  { key: "stock.handoff", label: "Remettre un stock à un responsable", group: "Stocks" },
  { key: "stock.audit", label: "Contrôler les stocks et mouvements", group: "Pilotage" },
  { key: "stock.accept_kitchen", label: "Recevoir les vivres cuisine", group: "Stocks" },
  { key: "reports.daily_close", label: "Contrôler la clôture journalière", group: "Pilotage" },
  { key: "products.manage", label: "Gérer les produits", group: "Catalogue" },
  { key: "team.view", label: "Consulter l’équipe", group: "Équipe" },
  { key: "team.manage", label: "Gérer l’équipe", group: "Équipe" },
  { key: "finance.view", label: "Consulter la trésorerie", group: "Finance" },
  { key: "payments.create", label: "Préparer un encaissement", group: "Finance" },
  { key: "reports.view", label: "Consulter les rapports", group: "Pilotage" },
  { key: "messages.view", label: "Consulter les messages", group: "Messagerie" },
  { key: "messages.send", label: "Envoyer des messages", group: "Messagerie" },
] as const;

export const defaultRolePermissions: Record<string, string[]> = {
  SERVEUR: ["orders.view", "orders.create", "orders.receive", "orders.deliver", "tables.view", "payments.create"],
  SUPERVISEUR: ["orders.view", "stock.view", "stock.audit", "team.view", "reports.view", "reports.daily_close", "messages.view", "messages.send", "tables.view"],
  MAGASINIER: ["stock.view", "stock.receive", "stock.issue", "stock.handoff", "products.manage"],
  GERANT: ["orders.view", "orders.prepare", "orders.handoff", "stock.view", "team.view", "finance.view", "reports.view", "reports.daily_close", "messages.view", "messages.send"],
  BARMAN: ["orders.view", "orders.create", "stock.view", "tables.view", "payments.create"],
  SECRETAIRE: ["orders.view", "team.view", "reports.view", "messages.view", "messages.send", "tables.view"],
  COMPTABLE: ["finance.view", "reports.view"],
  APPROVISIONNEMENT: ["stock.view", "stock.receive", "stock.issue", "reports.view"],
  CUISINIER: ["orders.view", "orders.prepare", "orders.handoff"],
  CHEF_CUISINE: ["orders.view", "orders.prepare", "stock.view", "stock.accept_kitchen", "messages.view", "messages.send"],
  ADMINISTRATEUR: permissionCatalog.map((permission) => permission.key),
};

export const roleLabels: Record<string, string> = {
  SERVEUR: "Serveur", SUPERVISEUR: "Superviseur", MAGASINIER: "Magasinier", GERANT: "Gérant", BARMAN: "Barman", SECRETAIRE: "Secrétaire", COMPTABLE: "Comptable", APPROVISIONNEMENT: "Approvisionnement", CUISINIER: "Cuisinier", CHEF_CUISINE: "Chef cuisine", ADMINISTRATEUR: "Administrateur",
};
