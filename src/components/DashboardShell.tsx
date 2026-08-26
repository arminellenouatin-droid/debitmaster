// DebitManager shell: navigation tenant-scoped, subscription actions separate from operations, shared account and notification header.
import Link from "next/link";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { subscriptionDisplayStatus } from "@/lib/subscription-plans";
import { DashboardHeader } from "@/components/DashboardHeader";

const navigation: ReadonlyArray<readonly [string, string, string]> = [
  ["⌂", "Dashboard", "/dashboard"],
  ["▦", "Plan de salle", "/dashboard/tables"],
  ["＋", "Ventes", "/dashboard/orders"],
  ["◉", "Commandes", "/dashboard/orders"],
  ["▰", "Vente", "/dashboard/sales"],
  ["▤", "Gestion des stocks", "/dashboard/stock"],
  ["⇩", "Approvisionnement", "/dashboard/supply"],
  ["♙", "Personnel", "/dashboard/personnel"],
  ["◫", "Finance", "/dashboard/finance"],
  ["✉", "Messages", "/dashboard/messages"],
  ["✦", "Gestion Power", "/dashboard/power"],
  ["⚙", "Profil", "/dashboard/settings"],
];

export async function DashboardShell({ children, firstName }: { children: React.ReactNode; firstName: string }) {
  const activeContext = await getActiveTenantContext();
  const companyName = activeContext.company?.name ?? "Aucun établissement sélectionné";
  const isOwner = activeContext.role === "ADMINISTRATEUR" && activeContext.employeeId === null;
  const role = isOwner ? "Propriétaire" : activeContext.role || "Membre de l’équipe";
  const subscriptionStatus = activeContext.company ? subscriptionDisplayStatus(activeContext.company.status, activeContext.company.trial_ends_at, activeContext.company.subscription_expires_at) : "Indisponible";
  const baseNavigation = activeContext.role === "SERVEUR"
    ? navigation.filter(([, label]) => ["Dashboard", "Commandes", "Profil"].includes(label))
    : activeContext.role === "MAGASINIER"
      ? navigation.filter(([, label]) => ["Dashboard", "Gestion des stocks", "Profil"].includes(label))
      : activeContext.role === "GERANT"
        ? navigation.filter(([, label]) => ["Dashboard", "Commandes", "Profil"].includes(label) || (label === "Plan de salle" && activeContext.permissions.has("tables.view")) || (label === "Personnel" && activeContext.permissions.has("team.view")) || (label === "Finance" && activeContext.permissions.has("finance.view")))
        : navigation.filter(([, label]) => label !== "Ventes" && label !== "Approvisionnement");
  const visibleNavigation = activeContext.company?.activity_type === "POWER" && activeContext.permissions.has("power.view") && !baseNavigation.some(([, label]) => label === "Gestion Power")
    ? [...baseNavigation.slice(0, -1), navigation.find(([, label]) => label === "Gestion Power")!, baseNavigation[baseNavigation.length - 1]]
    : baseNavigation;

  return <div className="min-h-screen bg-[var(--background)] lg:pl-64">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--primary)] px-5 py-6 text-white lg:flex"><Link href="/" className="flex items-center gap-3 border-b border-white/15 pb-7"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-[var(--primary)]">D</span><span className="font-black tracking-tight">DebitManager <span className="font-normal text-white/60">Pro</span></span></Link><div className="mt-8 rounded-lg bg-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Établissement actif</p><p className="mt-2 truncate font-black" title={companyName}>{companyName}</p><p className="mt-1 text-xs text-white/60">{role}</p></div><nav className="mt-8 flex-1 space-y-1">{visibleNavigation.map(([icon, label, href]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center text-base">{icon}</span>{label}</Link>)}</nav><form action="/api/auth/logout" method="post"><button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center">↪</span>Se déconnecter</button></form></aside>
    <DashboardHeader firstName={firstName} companyName={companyName} tenantId={activeContext.company?.id ?? ""} role={role} isOwner={isOwner} subscriptionStatus={subscriptionStatus} />
    <main className="px-5 pb-24 pt-8 lg:px-8 lg:pb-10">{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[var(--line)] bg-[var(--surface)] px-2 lg:hidden">{visibleNavigation.slice(0, 5).map(([icon, label, href]) => <Link key={href} href={href} className="flex min-w-14 flex-col items-center gap-1 text-[10px] font-black text-[var(--muted)]"><span className="text-lg text-[var(--primary)]">{icon}</span>{label}</Link>)}</nav>
  </div>;
}
