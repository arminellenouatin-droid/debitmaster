// DebitManager Power navigation: owners and supervisors keep the management cockpit; service roles get focused, stock-free workspaces.
import Link from "next/link";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { subscriptionDisplayStatus } from "@/lib/subscription-plans";
import { DashboardHeader } from "@/components/DashboardHeader";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const navigation: ReadonlyArray<readonly [string, string, string]> = [
  ["⌂", "Dashboard", "/dashboard"],
  ["📦", "Produits et services", "/dashboard/catalog"],
  ["🍽", "Repas / Cuisine", "/dashboard/meals"],
  ["▦", "Plan de salle", "/dashboard/tables"],
  ["＋", "Ventes", "/dashboard/orders"],
  ["◉", "Commandes", "/dashboard/orders"],
  ["▰", "Vente", "/dashboard/sales"],
  ["▤", "Gestion des stocks", "/dashboard/stock"],
  ["⇩", "Approvisionnement", "/dashboard/supply"],
  ["◌", "WIFI", "/dashboard/wifi"],
  ["♙", "Personnel", "/dashboard/personnel"],
  ["◫", "Finance", "/dashboard/finance"],
  ["✉", "Messages", "/dashboard/messages"],
  ["✦", "Gestion Power", "/dashboard/power"],
  ["⚙", "Profil", "/dashboard/settings"],
];

type NavItem = readonly [string, string, string];

const serviceNavigation: Record<"GYM" | "LAVAGE" | "AUBERGE", ReadonlyArray<NavItem>> = {
  GYM: [
    ["⌂", "Dashboard", "/dashboard"],
    ["📦", "Produits et services", "/dashboard/catalog"],
    ["▰", "Vente", "/dashboard/service-sales"],
    ["▤", "Liste des services", "/dashboard/services?activity=GYM"],
    ["◫", "Abonnements", "/dashboard/subscriptions"],
    ["⚙", "Profil", "/dashboard/settings"],
  ],
  LAVAGE: [
    ["⌂", "Dashboard", "/dashboard"],
    ["📦", "Produits et services", "/dashboard/catalog"],
    ["▰", "Vente", "/dashboard/service-sales"],
    ["▤", "Liste des prestations", "/dashboard/services?activity=LAVAGE"],
    ["◫", "Caisse lavage", "/dashboard/cash"],
    ["⚙", "Profil", "/dashboard/settings"],
  ],
  AUBERGE: [
    ["⌂", "Dashboard", "/dashboard"],
    ["📦", "Produits et services", "/dashboard/catalog"],
    ["▰", "Vente", "/dashboard/service-sales"],
    ["◫", "Liste et occupation", "/dashboard/occupancy"],
    ["▤", "Caisse auberge", "/dashboard/cash"],
    ["⚙", "Profil", "/dashboard/settings"],
  ],
} as const;

export async function DashboardShell({ children, firstName }: { children: React.ReactNode; firstName: string }) {
  const activeContext = await getActiveTenantContext();
  const companyName = activeContext.company?.name ?? "Aucun établissement sélectionné";
  let avatarUrl: string | null = null;
  if (activeContext.user) {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("avatar_path")
      .eq("id", activeContext.user.id)
      .maybeSingle();
    if (profile?.avatar_path) {
      const { data: signed } = await admin.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
  }
  const isOwner = activeContext.role === "ADMINISTRATEUR" && activeContext.employeeId === null;
  const isPowerSupervisor =
    activeContext.role === "SUPERVISEUR" &&
    (activeContext.company?.activity_type === "HOTEL_AUBERGE" || activeContext.company?.activity_type === "POWER") &&
    activeContext.permissions.has("power.view");
  let assignedServiceRole: keyof typeof serviceNavigation | null = null;
  if (activeContext.employeeId && activeContext.tenantId) {
    const admin = createSupabaseAdminClient();
    const { data: assignment } = await admin
      .from("employee_activity_assignments")
      .select("activity_id")
      .eq("employee_id", activeContext.employeeId)
      .eq("tenant_id", activeContext.tenantId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (assignment?.activity_id) {
      const { data: activity } = await admin
        .from("company_activities")
        .select("activity_code")
        .eq("id", assignment.activity_id)
        .eq("tenant_id", activeContext.tenantId)
        .maybeSingle();
      if (activity?.activity_code === "GYM" || activity?.activity_code === "LAVAGE" || activity?.activity_code === "LODGING")
        assignedServiceRole = activity.activity_code === "LODGING" ? "AUBERGE" : activity.activity_code;
    }
  }
  const serviceRole: keyof typeof serviceNavigation | null =
    activeContext.role === "GYM" || activeContext.role === "LAVAGE" || activeContext.role === "AUBERGE"
      ? (activeContext.role as keyof typeof serviceNavigation)
      : assignedServiceRole;
  const role = isOwner ? "Propriétaire" : activeContext.role || "Membre de l’équipe";
  const subscriptionStatus = activeContext.company
    ? subscriptionDisplayStatus(
        activeContext.company.status,
        activeContext.company.trial_ends_at,
        activeContext.company.subscription_expires_at
      )
    : "Indisponible";

  const baseNavigation: ReadonlyArray<NavItem> = serviceRole
    ? serviceNavigation[serviceRole]
    : isPowerSupervisor
    ? navigation.filter(([, label]) => label !== "Ventes")
    : activeContext.role === "SERVEUR"
    ? navigation.filter(([, label]) => ["Dashboard", "Commandes", "Profil"].includes(label))
    : activeContext.role === "CHEF_CUISINE" || activeContext.role === "CUISINIER"
    ? navigation.filter(([, label]) => ["Dashboard", "Produits et services", "Repas / Cuisine", "Profil"].includes(label))
    : activeContext.role === "MAGASINIER"
    ? navigation.filter(([, label]) => ["Dashboard", "Produits et services", "Gestion des stocks", "Profil"].includes(label))
    : activeContext.role === "GERANT" || activeContext.role === "GERANT_ADJOINT"
    ? navigation.filter(
        ([, label]) =>
          ["Dashboard", "Produits et services", "Commandes", "Profil"].includes(label) ||
          (label === "Plan de salle" && activeContext.permissions.has("tables.view")) ||
          (label === "Personnel" && activeContext.permissions.has("team.view")) ||
          (label === "Finance" && activeContext.permissions.has("finance.view")) ||
          (label === "WIFI" && activeContext.permissions.has("services.view"))
      )
    : navigation.filter(([, label]) => label !== "Ventes" && label !== "Approvisionnement");

  const visibleNavigation: ReadonlyArray<NavItem> =
    (activeContext.company?.activity_type === "HOTEL_AUBERGE" || activeContext.company?.activity_type === "POWER") &&
    activeContext.permissions.has("power.view") &&
    !serviceRole &&
    !baseNavigation.some(([, label]) => label === "Gestion Power")
      ? [
          ...baseNavigation.slice(0, -1),
          navigation.find(([, label]) => label === "Gestion Power")!,
          baseNavigation[baseNavigation.length - 1],
        ]
      : baseNavigation;

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      {/* Desktop Luxury Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-[#063327] via-[#04281f] to-[#021a14] px-5 py-6 text-white shadow-xl lg:flex">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-3 border-b border-white/10 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-xl font-black text-slate-950 shadow-md shadow-amber-500/20 transition group-hover:scale-105">
            D
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black tracking-tight text-white">DebitMaster</span>
              <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-300">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-emerald-300/70 font-medium">Système de Caisse Afrique</p>
          </div>
        </Link>

        {/* Active Company Pill */}
        <div className="mt-5 rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-300">Établissement actif</p>
          <p className="mt-1 truncate font-black text-sm text-white" title={companyName}>
            {companyName}
          </p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-200/80">{role}</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-300">
              En ligne
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleNavigation.map(([icon, label, href]) => (
            <Link
              key={`${label}-${href}`}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-100/80 transition hover:bg-white/10 hover:text-white"
            >
              <span className="w-5 text-center text-sm text-amber-400">{icon}</span>
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Logout Form */}
        <form action="/api/auth/logout" method="post" className="border-t border-white/10 pt-4">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-red-300/80 transition hover:bg-red-500/10 hover:text-red-200"
          >
            <span className="w-5 text-center">↪</span>
            <span>Se déconnecter</span>
          </button>
        </form>
      </aside>

      {/* Shared Header with Notifications & Roles */}
      <DashboardHeader
        firstName={firstName}
        companyName={companyName}
        tenantId={activeContext.company?.id ?? ""}
        role={role}
        isOwner={isOwner}
        subscriptionStatus={subscriptionStatus}
        avatarUrl={avatarUrl}
        navigationItems={visibleNavigation}
      />

      {/* Main Content Area */}
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>

      {/* Mobile Floating Bottom Bar (Modern thumb navigation) */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex h-16 items-center justify-around rounded-2xl border border-slate-200/80 bg-white/95 px-2 shadow-2xl backdrop-blur-xl lg:hidden">
        {visibleNavigation.slice(0, 5).map(([icon, label, href]) => (
          <Link
            key={`${label}-${href}`}
            href={href}
            className="flex min-w-[54px] flex-col items-center justify-center gap-1 rounded-xl p-1 text-[10px] font-black text-slate-600 transition active:scale-95 hover:text-emerald-700"
          >
            <span className="text-base text-emerald-800 leading-none">{icon}</span>
            <span className="truncate max-w-[65px]">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
