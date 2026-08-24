/* Maquette accueilmarketing: entrée claire, surface ivoire, vert profond, ambre, Inter et inscription en un parcours guidé. */
import Link from "next/link";

const benefits = [
  ["01", "Commandes", "Du comptoir au service, chaque commande reste visible."],
  ["02", "Stocks", "Les niveaux et mouvements avant la rupture."],
  ["03", "Équipe", "Les rôles et accès de chaque collaborateur."],
  ["04", "Trésorerie", "Les encaissements et rapports au même endroit."],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3 font-black tracking-tight text-[var(--primary)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)] text-lg text-white">D</span>
          <span>DebitManager <span className="font-normal text-[var(--muted)]">Pro</span></span>
        </Link>
        <div className="flex items-center gap-3 text-sm font-bold">
          <Link href="/connexion" className="hidden px-3 py-2 text-[var(--muted)] hover:text-[var(--primary)] sm:block">Se connecter</Link>
          <Link href="/inscription" className="rounded-lg bg-[var(--primary)] px-4 py-3 text-white transition hover:bg-[var(--primary-soft)] active:scale-[0.98]">Créer mon espace</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-20 pt-10 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-12">
        <div className="max-w-2xl">
          <p className="mb-5 text-xs font-black uppercase tracking-[0.2em] text-[var(--secondary)]">Le poste de pilotage des établissements africains</p>
          <h1 className="max-w-xl text-5xl font-black leading-[0.98] tracking-[-0.05em] text-[var(--primary)] sm:text-7xl">Gérez mieux. <span className="text-[var(--secondary)]">Servez juste.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">DebitManager réunit commandes, stocks, équipe et trésorerie pour les bars, maquis, restaurants et lounges.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/inscription" className="inline-flex items-center gap-3 rounded-lg bg-[var(--primary)] px-6 py-4 text-sm font-black text-white shadow-[0_16px_30px_-18px_var(--primary)] transition hover:bg-[var(--primary-soft)] active:scale-[0.98]">Commencer maintenant <span aria-hidden>→</span></Link>
            <Link href="/connexion" className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-6 py-4 text-sm font-black text-[var(--primary)] transition hover:border-[var(--primary)]">J’ai déjà un compte</Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--line)] pt-5 text-xs font-bold text-[var(--muted)]"><span>Responsive mobile</span><span>Isolation par établissement</span><span>Moneroo uniquement</span></div>
        </div>

        <div className="overflow-hidden rounded-xl bg-[var(--primary)] p-3 text-white shadow-[0_24px_60px_-26px_var(--primary)]">
          <div className="rounded-lg bg-[var(--primary-soft)] p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-white/15 pb-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Vue d’ensemble</p><p className="mt-2 text-xl font-black">Maquis Master</p></div><span className="rounded-full bg-[var(--primary-container)]/25 px-3 py-1.5 text-xs font-bold text-[var(--primary-container)]">En ligne</span></div>
            <div className="mt-8"><p className="text-sm text-white/65">Chiffre d’affaires du jour</p><p className="mt-2 text-5xl font-black tracking-tight">4,250,000 <span className="text-base font-bold text-white/65">FCFA</span></p><p className="mt-3 text-sm font-bold text-[var(--primary-container)]">↑ Activité visible en temps réel</p></div>
            <div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-lg bg-white/10 p-4"><p className="text-xs font-bold text-white/60">Commandes</p><p className="mt-3 text-2xl font-black">45</p></div><div className="rounded-lg bg-[var(--secondary-container)] p-4 text-[var(--primary)]"><p className="text-xs font-black">Stock critique</p><p className="mt-3 text-2xl font-black">3</p></div></div>
          </div>
          <div className="flex items-center justify-between px-2 pb-1 pt-4 text-xs font-bold text-white/55"><span>DebitManager Pro</span><span>Tableau de bord</span></div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)] px-5 py-16 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1440px]"><div className="max-w-xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--secondary)]">Un espace pour chaque décision</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.04em] text-[var(--primary)] sm:text-5xl">Votre établissement mérite mieux qu’un empilement d’outils.</h2></div><div className="mt-12 grid gap-0 border-y border-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">{benefits.map(([number, title, text]) => <div key={number} className="border-b border-[var(--line)] px-1 py-7 sm:border-r sm:px-6 lg:border-b-0 lg:first:pl-0 lg:last:border-r-0"><span className="text-xs font-black text-[var(--secondary)]">{number}</span><h3 className="mt-7 text-lg font-black text-[var(--primary)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p></div>)}</div></div></section>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-8 text-xs font-bold text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><span>DebitManager Pro</span><span>Commandes · Stocks · Équipe · Trésorerie</span></footer>
    </main>
  );
}
