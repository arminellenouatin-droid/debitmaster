// DebitManager product UI: espace gérant, structure prête pour les modules tenant et protégée par la session Supabase.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import { CatalogueClient } from "./CatalogueClient";
import { OperationsClient } from "./OperationsClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");

  return <main className="min-h-screen"><header className="border-b border-[var(--line)] bg-[var(--surface)]"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10"><Link href="/" className="font-serif text-2xl font-semibold tracking-tight">Debit<span className="text-[var(--accent)]">Manager</span></Link><form action="/api/auth/logout" method="post"><button className="font-sans text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">Se déconnecter</button></form></div></header><div className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16"><div className="mb-12 max-w-2xl"><p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Espace gérant</p><h1 className="mt-3 font-serif text-5xl leading-tight">Bonjour, {auth.user.user_metadata?.first_name ?? "gérant"}.</h1><p className="mt-5 font-sans text-base leading-7 text-[var(--muted)]">Configurez votre environnement de travail avant d’ouvrir les opérations quotidiennes.</p></div><DashboardClient /><CatalogueClient /><OperationsClient /></div></main>;
}
