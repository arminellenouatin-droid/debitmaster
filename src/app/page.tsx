// DebitManager product UI: accueil SaaS éditorial, blocs d’activation hiérarchisés, données réelles ou états vides explicites.
import Link from "next/link";

const modules = [
  { number: "01", title: "Commandes", text: "Chaque commande, du comptoir au service, dans un même fil." },
  { number: "02", title: "Stocks", text: "Les mouvements visibles avant que la rupture ne vous surprenne." },
  { number: "03", title: "Équipe", text: "Les bons accès, pour les bonnes personnes, au bon moment." },
  { number: "04", title: "Trésorerie", text: "Ventes, paiements et rapports réunis dans un espace fiable." },
];

function Arrow() {
  return <span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">↗</span>;
}

function Pulse() {
  return <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--success)] shadow-[0_0_0_5px_color-mix(in_oklab,var(--success),transparent_85%)]" />;
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="relative z-10 border-b border-[var(--line)] bg-[color:var(--canvas)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
          <Link href="/" className="group flex items-center gap-3 font-sans text-[0.72rem] font-black uppercase tracking-[0.16em]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-lg font-black text-white shadow-[0_8px_20px_-10px_var(--accent)]">D</span>
            <span>Debit<span className="text-[var(--accent)]">Manager</span></span>
          </Link>
          <nav className="flex items-center gap-3 font-sans text-sm font-bold">
            <Link href="/connexion" className="hidden px-3 py-2 text-[var(--muted)] transition-colors hover:text-[var(--ink)] sm:block">Se connecter</Link>
            <Link href="/inscription" className="rounded-full bg-[var(--ink)] px-4 py-2.5 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--accent)] active:scale-[0.98] sm:px-5">Créer mon espace <span className="ml-1">↗</span></Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-14 md:grid-cols-[0.95fr_1.05fr] md:items-center md:px-10 md:pb-28 md:pt-24">
        <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-[var(--accent-soft)] opacity-70 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-sans text-[0.65rem] font-black uppercase tracking-[0.16em] text-[var(--muted)] shadow-sm"><Pulse /> Pilotage en temps réel</div>
          <p className="mt-8 font-sans text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Le poste de pilotage des établissements africains</p>
          <h1 className="mt-4 max-w-xl font-serif text-[3.7rem] leading-[0.93] tracking-[-0.055em] md:text-[5.5rem]">Moins de dispersion.<br /><em className="text-[var(--accent)]">Plus de maîtrise.</em></h1>
          <p className="mt-7 max-w-xl font-sans text-base leading-7 text-[var(--muted)] md:text-lg">DebitManager rassemble commandes, stocks, équipe et trésorerie dans un espace pensé pour les bars, maquis et restaurants qui veulent décider avec des données fiables.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3 font-sans">
            <Link href="/inscription" className="group flex items-center gap-4 rounded-full bg-[var(--accent)] px-6 py-4 text-sm font-black text-white shadow-[0_16px_30px_-14px_var(--accent)] transition hover:-translate-y-1 active:scale-[0.98]">Configurer mon établissement <Arrow /></Link>
            <Link href="/connexion" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-4 text-sm font-black transition hover:border-[var(--accent)] hover:text-[var(--accent)]">J’ai déjà un compte</Link>
          </div>
          <div className="mt-10 flex items-center gap-5 border-t border-[var(--line)] pt-5 font-sans text-xs text-[var(--muted)]"><span className="font-black text-[var(--ink)]">Un socle clair</span><span className="h-1 w-1 rounded-full bg-[var(--line)]" /><span>Sans données fictives</span><span className="h-1 w-1 rounded-full bg-[var(--line)]" /><span>Mobile d’abord</span></div>
        </div>

        <div className="relative rounded-[2rem] border border-[var(--ink)]/10 bg-[var(--ink)] p-3 text-white shadow-[0_30px_70px_-28px_var(--ink)] md:p-4">
          <div className="rounded-[1.35rem] bg-[#34302d] p-5 md:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5 font-sans"><div><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/45">Espace gérant</p><p className="mt-1 text-sm font-bold">Vue d’ensemble</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-[0.65rem] font-bold text-white/65">À configurer</span></div>
            <div className="mt-8 flex items-end justify-between gap-4"><div><p className="font-sans text-sm text-white/50">Votre établissement commence ici.</p><p className="mt-2 max-w-xs font-serif text-4xl leading-none tracking-tight md:text-5xl">Une vue claire pour décider vite.</p></div><div className="hidden h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-serif text-2xl md:flex">↗</div></div>
            <div className="mt-9 grid grid-cols-2 gap-3 font-sans"><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/45">Commandes</p><p className="mt-4 text-xl font-black">À configurer</p><p className="mt-1 text-xs text-white/40">Votre première vue</p></div><div className="rounded-2xl bg-[var(--accent)] p-4"><p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/70">Prochaine étape</p><p className="mt-4 text-xl font-black">Créer l’espace</p><p className="mt-1 text-xs text-white/70">Moins de 2 minutes</p></div></div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 font-sans text-xs text-white/45"><span>Dernière synchronisation</span><span className="font-bold text-white/65">En attente de configuration</span></div>
          </div>
          <div className="flex items-center justify-between px-3 pb-1 pt-4 font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/35"><span>DebitManager / aperçu</span><span>01 — 04</span></div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)] px-5 py-14 md:px-10 md:py-20"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="font-sans text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Un socle, pas un empilement d’outils</p><h2 className="mt-3 max-w-lg font-serif text-4xl leading-[0.98] tracking-tight md:text-5xl">Chaque opération garde sa place.</h2></div><p className="max-w-xs font-sans text-sm leading-6 text-[var(--muted)]">Commencez par votre établissement. Les autres modules s’ouvrent au rythme de votre activité.</p></div><div className="mt-12 grid gap-8 md:grid-cols-4">{modules.map((module) => <div key={module.number} className="group border-t-2 border-[var(--line)] pt-5 transition-colors hover:border-[var(--accent)]"><div className="flex items-center justify-between"><span className="font-sans text-xs font-black text-[var(--accent)]">{module.number}</span><Arrow /></div><h3 className="mt-12 font-sans text-lg font-black">{module.title}</h3><p className="mt-2 max-w-[16rem] font-sans text-sm leading-6 text-[var(--muted)]">{module.text}</p></div>)}</div></div></section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 font-sans text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between md:px-10"><span>DebitManager, le pilotage quotidien de votre établissement.</span><span>Socle Sprint 0 · Données réelles uniquement</span></footer>
    </main>
  );
}
