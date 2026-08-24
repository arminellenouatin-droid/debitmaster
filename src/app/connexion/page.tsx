// DebitManager product UI: page de connexion, structure éditoriale sobre et accès par e-mail relié au serveur.
import Link from "next/link";
import { ConnexionForm } from "./ConnexionForm";

export default function ConnexionPage() {
  return <main className="mx-auto max-w-xl px-5 py-20 md:py-28"><Link href="/" className="font-sans text-sm font-bold text-[var(--accent)]">← DebitManager</Link><div className="mt-12"><p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Accès sécurisé</p><h1 className="mt-3 font-serif text-5xl leading-tight">Retrouvez votre espace.</h1><ConnexionForm /><p className="mt-6 font-sans text-sm text-[var(--muted)]">Pas encore d’espace ? <Link href="/inscription" className="font-bold text-[var(--accent)] underline">Créer un compte</Link></p></div></main>;
}
