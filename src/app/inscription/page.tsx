// DebitManager product UI: inscription exploitant, premier pas avant la création de l’établissement.
import Link from "next/link";
import { InscriptionForm } from "./InscriptionForm";

export default function InscriptionPage() {
  return <main className="mx-auto max-w-xl px-5 py-20 md:py-28"><Link href="/" className="font-sans text-sm font-bold text-[var(--accent)]">← DebitManager</Link><div className="mt-12"><p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Première configuration</p><h1 className="mt-3 font-serif text-5xl leading-tight">Créez votre espace.</h1><p className="mt-5 font-sans text-base leading-7 text-[var(--muted)]">Commencez par vos informations de compte. La configuration de l’établissement viendra juste après.</p><InscriptionForm /><p className="mt-6 font-sans text-sm text-[var(--muted)]">Vous avez déjà un compte ? <Link href="/connexion" className="font-bold text-[var(--accent)] underline">Se connecter</Link></p></div></main>;
}
