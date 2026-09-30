import { redirect } from "next/navigation";
import { ChangeCommercePasswordForm } from "./ChangeCommercePasswordForm";
import { getCommerceContext } from "@/lib/commerce-auth";

export const dynamic = "force-dynamic";

export default async function CommerceFirstLoginPasswordPage() {
  const context = await getCommerceContext();
  if (!context.user || !context.employee || !context.company) redirect("/connexion");
  if (!context.employee.must_change_password) redirect("/dashboard");

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">DebitMaster · Boutique &amp; Commerce</p>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Sécurisez votre premier accès</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Bonjour {context.employee.first_name}. Pour protéger votre compte dans <strong>{context.company.name}</strong>, remplacez le mot de passe temporaire avant de continuer.</p>
      <ChangeCommercePasswordForm />
    </section>
  </main>;
}
