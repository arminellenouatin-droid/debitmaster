// DebitManager shell: every connected screen names the validated active establishment before the SaaS brand.
import Link from "next/link";
import { getActiveTenantContext } from "@/lib/active-tenant";

const navigation = [
  ["⌂", "Dashboard", "/dashboard"],
  ["▦", "Plan de salle", "/dashboard/tables"],
  ["＋", "Ventes", "/dashboard/orders"],
  ["◉", "Cuisine", "/dashboard/kitchen"],
  ["▤", "Gestion des stocks", "/dashboard/stock"],
  ["♙", "Personnel", "/dashboard/personnel"],
  ["◫", "Finance", "/dashboard/finance"],
  ["✉", "Messages", "/dashboard/messages"],
  ["⚙", "Profil", "/dashboard/settings"],
];

export async function DashboardShell({ children, firstName }: { children: React.ReactNode; firstName: string }) {
  const activeContext = await getActiveTenantContext();
  const companyName = activeContext.company?.name ?? "Aucun établissement sélectionné";
  const role = activeContext.role === "ADMINISTRATEUR" && activeContext.employeeId === null ? "Propriétaire" : activeContext.role || "Membre de l’équipe";
  const visibleNavigation = activeContext.role === "SERVEUR" ? navigation.filter(([, label]) => ["Dashboard", "Ventes"].includes(label)).concat([["＋", "Commandes", "/dashboard/orders"]]) : activeContext.role === "MAGASINIER" ? navigation.filter(([, label]) => ["Dashboard", "Gestion des stocks", "Profil"].includes(label)) : activeContext.role === "GERANT" ? navigation.filter(([, label]) => ["Dashboard", "Ventes", "Profil"].includes(label) || (label === "Plan de salle" && activeContext.permissions.has("tables.view")) || (label === "Personnel" && activeContext.permissions.has("team.view")) || (label === "Finance" && activeContext.permissions.has("finance.view"))) : navigation;

  return <div className="min-h-screen bg-[var(--background)] lg:pl-64"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--primary)] px-5 py-6 text-white lg:flex"><Link href="/" className="flex items-center gap-3 border-b border-white/15 pb-7"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-[var(--primary)]">D</span><span className="font-black tracking-tight">DebitManager <span className="font-normal text-white/60">Pro</span></span></Link><div className="mt-8 rounded-lg bg-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Établissement actif</p><p className="mt-2 truncate font-black" title={companyName}>{companyName}</p><p className="mt-1 text-xs text-white/60">{role}</p></div><nav className="mt-8 flex-1 space-y-1">{visibleNavigation.map(([icon, label, href]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center text-base">{icon}</span>{label}</Link>)}</nav><form action="/api/auth/logout" method="post"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center">↪</span>Se déconnecter</button></form></aside><header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)]/95 px-5 py-3 backdrop-blur lg:px-8"><Link href="/" className="flex shrink-0 items-center gap-2 font-black text-[var(--primary)] lg:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] text-sm text-white">D</span>DebitManager</Link><div className="min-w-0"><p className="hidden text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)] sm:block">Établissement actif</p><p className="max-w-[46vw] truncate text-sm font-black text-[var(--primary)] sm:max-w-[44vw] lg:max-w-[52vw]" title={companyName}>{companyName}</p></div><div className="flex shrink-0 items-center gap-3"><span className="hidden text-sm font-bold text-[var(--muted)] md:block">Bonjour, {firstName || "gérant"}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--primary)]">{(firstName || "G").slice(0, 1).toUpperCase()}</span></div></header><main className="px-5 pb-24 pt-8 lg:px-8 lg:pb-10">{children}</main><nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[var(--line)] bg-[var(--surface)] px-2 lg:hidden">{visibleNavigation.slice(0, 5).map(([icon, label, href]) => <Link key={href} href={href} className="flex min-w-14 flex-col items-center gap-1 text-[10px] font-black text-[var(--muted)]"><span className="text-lg text-[var(--primary)]">{icon}</span>{label}</Link>)}</nav></div>;
}
