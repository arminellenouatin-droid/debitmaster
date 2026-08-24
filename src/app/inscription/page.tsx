/* Maquette inscription: écran calme et centré, fond bleu ivoire, carte blanche et progression lisible. */
import Link from "next/link";
import { InscriptionForm } from "./InscriptionForm";

export default function InscriptionPage() {
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 sm:py-12"><div className="mx-auto max-w-6xl"><Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-[var(--primary)]">← <span>DebitManager</span></Link><div className="grid gap-10 py-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:py-20"><div className="max-w-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--secondary)]">Première configuration</p><h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.04em] text-[var(--primary)]">Votre établissement commence par une équipe bien identifiée.</h2><p className="mt-5 text-base leading-7 text-[var(--muted)]">Créez votre accès. Nous vous guiderons ensuite pour choisir votre profil, renseigner votre établissement et activer votre espace.</p><p className="mt-8 text-sm font-bold text-[var(--muted)]">Déjà un compte ? <Link href="/connexion" className="text-[var(--primary)] underline underline-offset-4">Se connecter</Link></p></div><InscriptionForm /></div></div></main>;
}
