/* Maquettes modules: route protégée de secours structurée, navigation persistante, état vide explicite sans données fictives. */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";

const modules: Record<string, { title: string; eyebrow: string; description: string; action: string; sections: string[] }> = {
  tables: { title: "Plan de salle", eyebrow: "Tables", description: "Visualisez les tables et leur statut avant d’envoyer une commande.", action: "Ajouter une table", sections: ["Tables libres", "Tables occupées", "Tables réservées"] },
  orders: { title: "Prise de commande", eyebrow: "Orders", description: "Sélectionnez une table, composez le panier et envoyez la commande au service.", action: "Nouvelle commande", sections: ["Catégories", "Panier actif", "Commandes récentes"] },
  stock: { title: "Gestion des stocks", eyebrow: "Stock", description: "Suivez les niveaux, les mouvements et les produits à réapprovisionner.", action: "Ajouter un produit", sections: ["Alertes de stock", "Valeur du stock", "Mouvements récents"] },
  personnel: { title: "Gestion du personnel", eyebrow: "Personnel", description: "Gérez les membres de l’équipe, leurs rôles et leurs accès tenant.", action: "Ajouter un collaborateur", sections: ["Équipe active", "Invitations en attente", "Permissions"] },
  finance: { title: "Trésorerie & comptabilité", eyebrow: "Finance", description: "Rassemblez les encaissements, sorties et rapports de votre établissement.", action: "Voir les rapports", sections: ["Solde du jour", "Flux entrants", "Flux sortants"] },
  messages: { title: "Messagerie interne", eyebrow: "Messages", description: "Échangez avec l’équipe sans quitter l’espace de travail.", action: "Nouveau message", sections: ["Conversations", "Groupes", "Messages non lus"] },
  settings: { title: "Paramètres", eyebrow: "Settings", description: "Configurez votre profil, votre établissement et vos préférences.", action: "Modifier le profil", sections: ["Profil", "Établissement", "Sécurité"] },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const config = modules[module] ?? { title: "Module DebitManager", eyebrow: "Espace de travail", description: "Cette section sera disponible selon les permissions de votre rôle.", action: "Revenir au dashboard", sections: ["État du module"] };
  return <DashboardShell firstName={auth.user.user_metadata?.first_name ?? "gérant"}><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">{config.eyebrow}</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">{config.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{config.description}</p></div><button className="h-11 rounded-lg bg-[var(--primary)] px-5 text-sm font-black text-white transition hover:bg-[var(--primary-soft)]">{config.action}</button></div><div className="mt-8 grid gap-5 md:grid-cols-3">{config.sections.map((section) => <section key={section} className="min-h-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><h2 className="font-black text-[var(--primary)]">{section}</h2><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-black text-[var(--muted)]">À configurer</span></div><div className="mt-10 rounded-lg border border-dashed border-[var(--line)] p-4 text-sm leading-6 text-[var(--muted)]">Les données réelles de votre établissement apparaîtront ici après configuration.</div></section>)}</div></DashboardShell>;
}
