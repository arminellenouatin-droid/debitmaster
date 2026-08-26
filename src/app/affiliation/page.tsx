// Design Read: page publique d’affiliation, composition éditoriale asymétrique, fond ivoire et accents verts de DebitManager, avec une entrée directe vers l’adhésion commerciale.
import Link from "next/link";
import { AffiliationClient } from "./AffiliationClient";

export default function AffiliationPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]">
            <span aria-hidden>←</span>
            <span>DebitManager</span>
          </Link>
          <Link href="/connexion" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-black text-[var(--primary)] transition hover:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]">
            Se connecter
          </Link>
        </header>
        <div className="py-12 lg:py-20">
          <AffiliationClient />
        </div>
        <footer className="border-t border-[var(--line)] pt-6 text-xs font-bold text-[var(--muted)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>DebitManager Pro</span>
            <Link href="/inscription" className="text-[var(--primary)] underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]">Créer un établissement</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
