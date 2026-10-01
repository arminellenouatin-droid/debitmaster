import Link from "next/link";
import type { CommerceAccessMode } from "@/lib/commerce-auth";
import { CommerceCompanySwitcher } from "@/components/CommerceCompanySwitcher";

type NavItem = { label: string; href: string; permission?: string; ownerOnly?: boolean };
const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard#commerce-home" },
  { label: "Catalogue", href: "/dashboard/commerce/catalogue", permission: "catalog.view" },
  { label: "Stock", href: "/dashboard/commerce/stock", permission: "stock.view" },
  { label: "Clients", href: "/dashboard/commerce/clients", permission: "customers.view" },
  { label: "Fournisseurs", href: "/dashboard/commerce/fournisseurs", permission: "suppliers.view" },
  { label: "Magasins", href: "/dashboard#commerce-stores", permission: "stores.view" },
  { label: "Équipe et rôles", href: "/dashboard#commerce-team", permission: "team.view" },
  { label: "Journal d’audit", href: "/dashboard#commerce-audit", permission: "audit.view" },
  { label: "Abonnement", href: "/dashboard/subscription", ownerOnly: true },
];

export function CommerceDashboardShell({ children, firstName, companyName, tenantId, role, isOwner, accessMode, permissions }: {
  children: React.ReactNode;
  firstName: string;
  companyName: string;
  tenantId: string;
  role: string;
  isOwner: boolean;
  accessMode: CommerceAccessMode;
  permissions: string[];
}) {
  const visibleItems = navItems.filter((item) => (!item.ownerOnly || isOwner) && (!item.permission || permissions.includes(item.permission)));
  const accessMessage = accessMode === "GRACE"
    ? "Période de grâce : les données restent consultables, mais les changements de configuration sont suspendus."
    : accessMode === "READ_ONLY"
    ? "Abonnement arrivé à échéance : vos données restent consultables en lecture seule."
    : accessMode === "BLOCKED"
    ? "L’accès opérationnel est suspendu. Le promoteur peut consulter le statut et renouveler l’abonnement."
    : "";

  return <div className="min-h-screen bg-[var(--background)] text-[var(--primary)] lg:pl-64">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-[#063327] via-[#04281f] to-[#021a14] px-5 py-6 text-white shadow-xl lg:flex">
      <Link href="/" className="flex items-center gap-3 border-b border-white/10 pb-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-slate-950">D</span>
        <span><strong className="block text-base font-black">DebitMaster</strong><small className="text-[10px] font-semibold text-emerald-200">Boutique &amp; Commerce</small></span>
      </Link>
      <div className="mt-5 rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10">
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-300">Établissement actif</p>
        <p className="mt-1 truncate text-sm font-black" title={companyName}>{companyName}</p>
        <p className="mt-1 text-xs font-semibold text-emerald-200/80">{role}</p>
      </div>
      <nav aria-label="Navigation Commerce" className="mt-6 flex-1 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => <Link key={item.href} href={item.href} className="flex min-h-11 items-center rounded-xl px-3.5 text-sm font-bold text-emerald-100/85 transition hover:bg-white/10 hover:text-white">{item.label}</Link>)}
      </nav>
      <form action="/api/auth/logout" method="post" className="border-t border-white/10 pt-4"><button type="submit" className="min-h-11 w-full rounded-xl px-3.5 text-left text-sm font-bold text-red-200 hover:bg-red-500/10">Se déconnecter</button></form>
    </aside>
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Commerce d’achat-vente · établissement actif</p><p className="max-w-[70vw] truncate text-sm font-black text-[var(--primary)] sm:max-w-[30rem]">{companyName}</p></div>
        <div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-[var(--muted)] sm:inline">Bonjour, {firstName}</span>{isOwner && <CommerceCompanySwitcher tenantId={tenantId} />}{isOwner && <Link href="/dashboard/subscription" className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-black text-white">Abonnement</Link>}</div>
      </div>
    </header>
    {accessMessage && <div className={`border-b px-4 py-3 text-sm font-bold sm:px-6 lg:px-8 ${accessMode === "BLOCKED" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`} role="status"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><span>{accessMessage}</span>{isOwner && <Link href="/dashboard/subscription" className="underline underline-offset-2">Voir l’abonnement</Link>}</div></div>}
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
    <nav aria-label="Navigation Commerce mobile" className="fixed inset-x-3 bottom-3 z-30 flex h-14 items-center justify-around overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 px-2 shadow-2xl backdrop-blur lg:hidden">
      {visibleItems.slice(0, 4).map((item) => <Link key={item.href} href={item.href} className="flex min-h-11 shrink-0 items-center px-2 text-[10px] font-black text-emerald-900">{item.label}</Link>)}
    </nav>
  </div>;
}
