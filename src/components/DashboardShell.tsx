// DebitManager Power navigation: owners and supervisors keep the management cockpit; service roles get focused, stock-free workspaces.
import Link from "next/link";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { subscriptionDisplayStatus } from "@/lib/subscription-plans";
import { DashboardHeader } from "@/components/DashboardHeader";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const navigation: ReadonlyArray<readonly [string, string, string]> = [
  ["⌂", "Dashboard", "/dashboard"], ["▦", "Plan de salle", "/dashboard/tables"], ["＋", "Ventes", "/dashboard/orders"], ["◉", "Commandes", "/dashboard/orders"], ["▰", "Vente", "/dashboard/sales"], ["▤", "Gestion des stocks", "/dashboard/stock"], ["⇩", "Approvisionnement", "/dashboard/supply"], ["♙", "Personnel", "/dashboard/personnel"], ["◫", "Finance", "/dashboard/finance"], ["✉", "Messages", "/dashboard/messages"], ["✦", "Gestion Power", "/dashboard/power"], ["⚙", "Profil", "/dashboard/settings"],
];
type NavItem = readonly [string, string, string];
const serviceNavigation: Record<"GYM" | "LAVAGE" | "AUBERGE", ReadonlyArray<NavItem>> = {
  GYM: [["⌂", "Dashboard", "/dashboard"], ["▰", "Vente", "/dashboard/service-sales"], ["♙", "Clients", "/dashboard/clients"], ["◫", "Abonnement", "/dashboard/subscriptions"], ["▤", "Caisse", "/dashboard/cash"], ["⚙", "Profil", "/dashboard/settings"]],
  LAVAGE: [["⌂", "Dashboard", "/dashboard"], ["▰", "Vente", "/dashboard/service-sales"], ["♙", "Clients", "/dashboard/clients"], ["▤", "Caisse", "/dashboard/cash"], ["⚙", "Profil", "/dashboard/settings"]],
  AUBERGE: [["⌂", "Dashboard", "/dashboard"], ["▰", "Vente", "/dashboard/service-sales"], ["◫", "Occupation", "/dashboard/occupancy"], ["♙", "Clients", "/dashboard/clients"], ["⚙", "Profil", "/dashboard/settings"]],
} as const;

export async function DashboardShell({ children, firstName }: { children: React.ReactNode; firstName: string }) {
  const activeContext = await getActiveTenantContext();
  const companyName = activeContext.company?.name ?? "Aucun établissement sélectionné";
  let avatarUrl: string | null = null;
  if (activeContext.user) {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("avatar_path").eq("id", activeContext.user.id).maybeSingle();
    if (profile?.avatar_path) {
      const { data: signed } = await admin.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
  }
  const isOwner = activeContext.role === "ADMINISTRATEUR" && activeContext.employeeId === null;
  const isPowerSupervisor = activeContext.role === "SUPERVISEUR" && activeContext.company?.activity_type === "POWER" && activeContext.permissions.has("power.view");
  let assignedServiceRole: keyof typeof serviceNavigation | null = null;
  if (activeContext.employeeId && activeContext.tenantId) {
    const admin = createSupabaseAdminClient();
    const { data: assignment } = await admin.from("employee_activity_assignments").select("activity_id").eq("employee_id", activeContext.employeeId).eq("tenant_id", activeContext.tenantId).eq("is_active", true).limit(1).maybeSingle();
    if (assignment?.activity_id) {
      const { data: activity } = await admin.from("company_activities").select("activity_code").eq("id", assignment.activity_id).eq("tenant_id", activeContext.tenantId).maybeSingle();
      if (activity?.activity_code === "GYM" || activity?.activity_code === "LAVAGE" || activity?.activity_code === "LODGING") assignedServiceRole = activity.activity_code === "LODGING" ? "AUBERGE" : activity.activity_code;
    }
  }
  const serviceRole: keyof typeof serviceNavigation | null = activeContext.role === "GYM" || activeContext.role === "LAVAGE" || activeContext.role === "AUBERGE" ? activeContext.role as keyof typeof serviceNavigation : assignedServiceRole;
  const role = isOwner ? "Propriétaire" : activeContext.role || "Membre de l’équipe";
  const subscriptionStatus = activeContext.company ? subscriptionDisplayStatus(activeContext.company.status, activeContext.company.trial_ends_at, activeContext.company.subscription_expires_at) : "Indisponible";
  const baseNavigation: ReadonlyArray<NavItem> = serviceRole ? serviceNavigation[serviceRole] : isPowerSupervisor ? navigation.filter(([, label]) => label !== "Ventes") : activeContext.role === "SERVEUR" ? navigation.filter(([, label]) => ["Dashboard", "Commandes", "Profil"].includes(label)) : activeContext.role === "MAGASINIER" ? navigation.filter(([, label]) => ["Dashboard", "Gestion des stocks", "Profil"].includes(label)) : activeContext.role === "GERANT" ? navigation.filter(([, label]) => ["Dashboard", "Commandes", "Profil"].includes(label) || (label === "Plan de salle" && activeContext.permissions.has("tables.view")) || (label === "Personnel" && activeContext.permissions.has("team.view")) || (label === "Finance" && activeContext.permissions.has("finance.view"))) : navigation.filter(([, label]) => label !== "Ventes" && label !== "Approvisionnement");
  const visibleNavigation: ReadonlyArray<NavItem> = activeContext.company?.activity_type === "POWER" && activeContext.permissions.has("power.view") && !serviceRole && !baseNavigation.some(([, label]) => label === "Gestion Power") ? [...baseNavigation.slice(0, -1), navigation.find(([, label]) => label === "Gestion Power")!, baseNavigation[baseNavigation.length - 1]] : baseNavigation;
  return <div className="min-h-screen bg-[var(--background)] lg:pl-64">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--primary)] px-5 py-6 text-white lg:flex"><Link href="/" className="flex items-center gap-3 border-b border-white/15 pb-7"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-[var(--primary)]">D</span><span className="font-black tracking-tight">DebitManager <span className="font-normal text-white/60">Pro</span></span></Link><div className="mt-8 rounded-lg bg-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Établissement actif</p><p className="mt-2 truncate font-black" title={companyName}>{companyName}</p><p className="mt-1 text-xs text-white/60">{role}</p></div><nav className="mt-8 flex-1 space-y-1">{visibleNavigation.map(([icon, label, href]) => <Link key={`${label}-${href}`} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center text-base">{icon}</span>{label}</Link>)}</nav><form action="/api/auth/logout" method="post"><button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center">↪</span>Se déconnecter</button></form></aside>
    <DashboardHeader firstName={firstName} companyName={companyName} tenantId={activeContext.company?.id ?? ""} role={role} isOwner={isOwner} subscriptionStatus={subscriptionStatus} avatarUrl={avatarUrl} />
    <main className="px-5 pb-24 pt-8 lg:px-8 lg:pb-10">{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[var(--line)] bg-[var(--surface)] px-2 lg:hidden">{visibleNavigation.slice(0, 5).map(([icon, label, href]) => <Link key={`${label}-${href}`} href={href} className="flex min-w-14 flex-col items-center gap-1 text-[10px] font-black text-[var(--muted)]"><span className="text-lg text-[var(--primary)]">{icon}</span>{label}</Link>)}</nav>
  </div>;
}
