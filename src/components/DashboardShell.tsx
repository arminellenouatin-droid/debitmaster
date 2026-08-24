/* Maquette tableaudeboard: sidebar vert profond, topbar claire, navigation métier persistante et adaptation mobile. */
import Link from "next/link";

const navigation = [
  ["⌂", "Dashboard", "/dashboard"],
  ["▦", "Tables", "/dashboard/tables"],
  ["＋", "Orders", "/dashboard/orders"],
  ["◉", "Cuisine", "/dashboard/kitchen"],
  ["▤", "Stock", "/dashboard/stock"],
  ["♙", "Personnel", "/dashboard/personnel"],
  ["◫", "Finance", "/dashboard/finance"],
  ["✉", "Messages", "/dashboard/messages"],
  ["⚙", "Settings", "/dashboard/settings"],
];

export function DashboardShell({ children, firstName }: { children: React.ReactNode; firstName: string }) {
  return <div className="min-h-screen bg-[var(--background)] lg:pl-64"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--primary)] px-5 py-6 text-white lg:flex"><Link href="/" className="flex items-center gap-3 border-b border-white/15 pb-7"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-[var(--primary)]">D</span><span className="font-black tracking-tight">DebitManager <span className="font-normal text-white/60">Pro</span></span></Link><div className="mt-8 rounded-lg bg-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Espace actif</p><p className="mt-2 font-black">{firstName || "Gérant"}</p><p className="mt-1 text-xs text-white/60">Données de votre établissement</p></div><nav className="mt-8 flex-1 space-y-1">{navigation.map(([icon, label, href]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center text-base">{icon}</span>{label}</Link>)}</nav><form action="/api/auth/logout" method="post"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white"><span className="w-5 text-center">↪</span>Se déconnecter</button></form></aside><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/95 px-5 backdrop-blur lg:px-8"><Link href="/" className="flex items-center gap-2 font-black text-[var(--primary)] lg:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] text-sm text-white">D</span>DebitManager</Link><div className="hidden text-sm font-bold text-[var(--muted)] lg:block">Pilotage quotidien</div><div className="flex items-center gap-3"><span className="hidden text-sm font-bold text-[var(--muted)] sm:block">Bonjour, {firstName || "gérant"}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--primary)]">{(firstName || "G").slice(0, 1).toUpperCase()}</span></div></header><main className="px-5 pb-24 pt-8 lg:px-8 lg:pb-10">{children}</main><nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[var(--line)] bg-[var(--surface)] px-2 lg:hidden">{navigation.slice(0, 5).map(([icon, label, href]) => <Link key={href} href={href} className="flex min-w-14 flex-col items-center gap-1 text-[10px] font-black text-[var(--muted)]"><span className="text-lg text-[var(--primary)]">{icon}</span>{label}</Link>)}</nav></div>;
}
