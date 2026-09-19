import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DebitManager Pro | Le pilotage des établissements",
  description: "DebitManager réunit commandes, stocks, équipe et trésorerie pour les bars, maquis, restaurants et lounges.",
};

const benefits = [
  { title: "Commandes fluides", text: "Du comptoir à la cuisine, chaque commande arrive au bon endroit avec les détails utiles." },
  { title: "Stocks maîtrisés", text: "Suivez les niveaux, les mouvements et les alertes avant que la rupture ne ralentisse le service." },
  { title: "Équipe coordonnée", text: "Chaque rôle dispose de son espace, de ses tâches et de la visibilité dont il a besoin." },
];

const proofPoints = ["Conçu pour le terrain", "Mobile et ordinateur", "Données séparées"];

function ProductPreview() {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-[var(--primary)] p-2.5 shadow-[0_24px_70px_rgba(7,61,44,0.16)] sm:p-3">
      <div className="flex h-11 items-center justify-between px-3 text-[10px] font-black tracking-[0.08em] text-white/55 sm:px-4">
        <span>DEBITMANAGER / ESPACE GÉRANT</span>
        <span className="flex gap-1.5" aria-hidden="true"><i className="h-1.5 w-1.5 rounded-full bg-white/30" /><i className="h-1.5 w-1.5 rounded-full bg-white/30" /><i className="h-1.5 w-1.5 rounded-full bg-white/30" /></span>
      </div>
      <div className="rounded-[14px] bg-[#f8f8f2] p-4 text-[var(--ink)] sm:p-6">
        <div className="flex items-end justify-between border-b border-[#dbe1d9] pb-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#75847a]">Vue d’ensemble</p><p className="mt-1.5 text-lg font-black tracking-[-0.04em]">Maquis Master</p></div>
          <span className="rounded-full bg-[#e5f2e9] px-2.5 py-1.5 text-[10px] font-black text-[#377d5b]">En ligne</span>
        </div>
        <div className="mt-5 grid grid-cols-[1.2fr_0.8fr] gap-3">
          <div className="rounded-[13px] bg-[var(--primary)] p-4 text-white"><p className="text-[10px] font-bold text-white/65">Chiffre d’affaires aujourd’hui</p><p className="mt-2.5 text-[clamp(1.45rem,4vw,1.9rem)] font-black tracking-[-0.06em]">4 250 000 <span className="text-[10px] tracking-normal text-white/65">FCFA</span></p><p className="mt-2 text-[10px] font-black text-[#a7d0b4]">↑ Activité visible en temps réel</p></div>
          <div className="rounded-[13px] bg-[#f4e3b7] p-4 text-[#684d14]"><p className="text-[10px] font-bold opacity-70">À surveiller</p><p className="mt-2.5 text-3xl font-black tracking-[-0.06em]">03</p><p className="mt-2 text-[10px] font-black">stocks critiques</p></div>
        </div>
        <p className="mt-5 text-[11px] font-black">Activité des ventes</p>
        <div className="mt-2 flex h-[88px] items-end gap-2 rounded-[12px] border border-[#e0e4dc] bg-[#fffdf7] px-3.5 py-3"><i className="h-[45%] flex-1 rounded-t-md bg-[#a6c4b2]" /><i className="h-[62%] flex-1 rounded-t-md bg-[#0b5a40]" /><i className="h-[80%] flex-1 rounded-t-md bg-[#d9a441]" /><i className="h-[57%] flex-1 rounded-t-md bg-[#a6c4b2]" /><i className="h-[72%] flex-1 rounded-t-md bg-[#0b5a40]" /><i className="h-[94%] flex-1 rounded-t-md bg-[var(--primary)]" /></div>
        <p className="mt-5 text-[11px] font-black">À traiter maintenant</p>
        <div className="mt-2 grid grid-cols-2 gap-2"><div className="flex justify-between rounded-[11px] border border-[#e0e4dc] bg-[#fffdf7] p-3 text-[10px] font-black"><span>Commandes</span><strong className="text-[var(--primary)]">12</strong></div><div className="flex justify-between rounded-[11px] border border-[#e0e4dc] bg-[#fffdf7] p-3 text-[10px] font-black"><span>Équipe</span><strong className="text-[var(--primary)]">08</strong></div></div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--ink)]">
      <header className="mx-auto flex w-[calc(100%-32px)] max-w-[1180px] items-center justify-between gap-5 py-5 sm:w-[calc(100%-48px)] sm:py-7">
        <Link href="/" className="flex items-center gap-3 text-[15px] font-black tracking-[-0.04em] text-[var(--primary)] sm:text-lg"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary)] text-lg text-[#f4e3b7]">D</span><span>DebitManager <small className="font-medium text-[#7a877e]">Pro</small></span></Link>
        <nav className="hidden items-center gap-6 text-[13px] font-bold text-[var(--muted)] lg:flex"><a href="#solution" className="transition hover:text-[var(--primary)]">La solution</a><a href="#pilotage" className="transition hover:text-[var(--primary)]">Pilotage</a><a href="#contact" className="transition hover:text-[var(--primary)]">Contact</a></nav>
        <div className="flex items-center gap-3"><Link href="/connexion" className="hidden text-[13px] font-bold text-[var(--muted)] transition hover:text-[var(--primary)] sm:block">Se connecter</Link><Link href="/inscription" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[var(--primary)] px-3 !text-[#fffdf7] shadow-[0_10px_24px_rgba(7,61,44,0.15)] transition hover:bg-[var(--primary-soft)] active:scale-[0.98] sm:px-4 sm:text-[13px]">Créer mon espace <span aria-hidden="true">↗</span></Link></div>
      </header>

      <section className="mx-auto grid w-[calc(100%-32px)] max-w-[1180px] gap-11 pb-16 pt-9 sm:w-[calc(100%-48px)] sm:pb-20 sm:pt-12 md:pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-[68px]">
        <div>
          <p className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.17em] text-[#9b7020] before:h-0.5 before:w-6 before:bg-[var(--secondary)]">Le logiciel des établissements qui avancent</p>
          <h1 className="mt-5 max-w-[650px] text-[clamp(3.05rem,8vw,4.75rem)] font-black leading-[0.96] tracking-[-0.065em] text-[var(--ink)] [text-wrap:balance]">Le calme dans vos opérations. <span className="text-[var(--primary-soft)]">La maîtrise dans vos chiffres.</span></h1>
          <p className="mt-6 max-w-[560px] text-base leading-[1.6] text-[var(--muted)] sm:text-lg">DebitManager réunit vos commandes, stocks, équipe et trésorerie dans un seul poste de pilotage, pensé pour les bars, maquis, restaurants et lounges.</p>
          <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap"><Link href="/inscription" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-[var(--primary)] px-5 !text-[#fffdf7] shadow-[0_10px_24px_rgba(7,61,44,0.15)] transition hover:bg-[var(--primary-soft)] active:scale-[0.98]">Commencer maintenant <span aria-hidden="true">↗</span></Link><Link href="/connexion" className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-[#bac8be] bg-white/40 px-5 text-[13px] font-black text-[var(--primary)] transition hover:border-[var(--primary)]">Voir comment ça marche</Link></div>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--line)] pt-5 text-[11px] font-bold text-[#66736c]">{proofPoints.map((point) => <span key={point} className="flex items-center gap-1.5"><i className="grid h-4 w-4 place-items-center rounded-full bg-[#f4e3b7] text-[10px] not-italic text-[#8b641d]">✓</i>{point}</span>)}</div>
        </div>
        <div id="pilotage" className="lg:rotate-[1.3deg]"><ProductPreview /></div>
      </section>

      <div className="border-y border-[var(--line)] bg-white/40"><div className="mx-auto grid w-[calc(100%-32px)] max-w-[1180px] grid-cols-2 gap-3 py-5 text-[11px] font-bold text-[#6b776f] sm:w-[calc(100%-48px)] sm:flex sm:flex-wrap sm:justify-between sm:gap-6"><span><strong className="text-[var(--primary)]">Commandes</strong> fluides</span><span><strong className="text-[var(--primary)]">Stocks</strong> maîtrisés</span><span><strong className="text-[var(--primary)]">Équipe</strong> coordonnée</span><span><strong className="text-[var(--primary)]">Trésorerie</strong> lisible</span></div></div>

      <section id="solution" className="mx-auto my-[72px] w-[calc(100%-32px)] max-w-[1180px] sm:my-[105px] sm:w-[calc(100%-48px)]"><div className="max-w-[650px]"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9b7020]">Un seul espace pour décider</p><h2 className="mt-3 text-[clamp(2rem,5vw,3.25rem)] font-black leading-[1.02] tracking-[-0.06em] [text-wrap:balance]">Moins de dispersion. Plus de visibilité.</h2></div><div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-5">{benefits.map((benefit) => <article key={benefit.title} className="border-t-2 border-[var(--primary)] pt-5"><h3 className="text-lg font-black tracking-[-0.03em]">{benefit.title}</h3><p className="mt-2 max-w-[30ch] text-sm leading-[1.6] text-[var(--muted)]">{benefit.text}</p></article>)}</div></section>

      <section id="contact" className="mx-auto my-[72px] w-[calc(100%-32px)] max-w-[1180px] sm:my-[105px] sm:w-[calc(100%-48px)]"><div className="flex flex-col items-start justify-between gap-7 rounded-[18px] bg-[var(--primary)] px-7 py-10 text-white sm:px-12 sm:py-14 lg:flex-row lg:items-end"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#f4e3b7]">Prêt à reprendre la main ?</p><h2 className="mt-3 max-w-[650px] text-[clamp(2rem,5vw,3.4rem)] font-black leading-none tracking-[-0.06em] [text-wrap:balance]">Votre établissement mérite un système qui suit son rythme.</h2></div><Link href="/inscription" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-[10px] bg-[#d9a441] px-5 text-[13px] font-black !text-[#2c220d] transition hover:bg-[#f4e3b7] active:scale-[0.98]">Créer mon espace <span aria-hidden="true">↗</span></Link></div></section>

      <footer className="mx-auto flex w-[calc(100%-32px)] max-w-[1180px] flex-col gap-2 border-t border-[var(--line)] py-7 text-[11px] font-bold text-[#768279] sm:w-[calc(100%-48px)] sm:flex-row sm:items-center sm:justify-between"><span>DebitManager Pro</span><span>Commandes · Stocks · Équipe · Trésorerie</span></footer>
    </main>
  );
}
