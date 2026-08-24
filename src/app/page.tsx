// DebitManager product UI: accueil orienté activation, hiérarchie éditoriale et actions métier explicites.
import Link from "next/link";

const modules = [
  ["Commandes", "Suivez chaque commande de la prise au service."],
  ["Stocks", "Anticipez les ruptures et gardez une vue nette des mouvements."],
  ["Équipe", "Attribuez les accès selon le rôle de chaque collaborateur."],
  ["Trésorerie", "Préparez vos ventes, paiements et rapports au même endroit."],
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">Debit<span className="text-[var(--accent)]">Manager</span></Link>
          <nav className="flex items-center gap-5 font-sans text-sm font-semibold">
            <Link href="/connexion" className="hidden text-[var(--muted)] hover:text-[var(--ink)] sm:block">Se connecter</Link>
            <Link href="/inscription" className="rounded-full bg-[var(--ink)] px-5 py-3 text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]">Créer mon espace</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 md:grid-cols-[1.15fr_0.85fr] md:px-10 md:pb-28 md:pt-24">
        <div className="max-w-3xl self-center">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Le poste de pilotage des établissements africains</p>
          <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-tight md:text-7xl">Moins de dispersion. Plus de maîtrise.</h1>
          <p className="mt-7 max-w-2xl font-sans text-lg leading-8 text-[var(--muted)]">DebitManager rassemble commandes, stocks, équipe et trésorerie dans un espace pensé pour les bars, maquis et restaurants qui veulent avancer avec des données fiables.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4 font-sans">
            <Link href="/inscription" className="rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-12px_var(--accent)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]">Configurer mon établissement</Link>
            <Link href="/connexion" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-3.5 text-sm font-bold hover:border-[var(--accent)]">J’ai déjà un compte</Link>
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[var(--ink)] p-7 text-white shadow-2xl md:min-h-[460px]">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--accent)] opacity-80 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between font-sans text-xs font-bold uppercase tracking-[0.16em] text-white/70"><span>Vue du jour</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-white">Démo de structure</span></div>
            <div><p className="font-sans text-sm text-white/65">Votre établissement commence ici</p><p className="mt-3 font-serif text-4xl leading-tight">Une vue claire pour décider vite.</p><div className="mt-8 grid grid-cols-2 gap-3 font-sans"><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-white/60">Commandes</span><strong className="mt-2 block text-2xl">À configurer</strong></div><div className="rounded-2xl bg-[var(--accent)] p-4"><span className="text-xs text-white/75">Prochaine étape</span><strong className="mt-2 block text-2xl">Créer l’espace</strong></div></div></div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)] px-5 py-14 md:px-10 md:py-20"><div className="mx-auto max-w-7xl"><div className="max-w-xl"><p className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Un socle, pas un empilement d’outils</p><h2 className="mt-3 font-serif text-4xl leading-tight">Chaque opération garde sa place.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-4">{modules.map(([title, text], index) => <div key={title} className="border-t-2 border-[var(--line)] pt-5"><span className="font-sans text-xs font-bold text-[var(--accent)]">0{index + 1}</span><h3 className="mt-9 font-sans text-lg font-bold">{title}</h3><p className="mt-2 font-sans text-sm leading-6 text-[var(--muted)]">{text}</p></div>)}</div></div></section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 font-sans text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between md:px-10"><span>DebitManager, le pilotage quotidien de votre établissement.</span><span>Socle Sprint 0 · Données réelles uniquement</span></footer>
    </main>
  );
}
