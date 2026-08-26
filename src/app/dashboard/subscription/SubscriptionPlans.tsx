// DebitManager subscription UI: comparer quatre plans, lancer MTN MoMo et attendre sa confirmation asynchrone.
"use client";

import { useEffect, useMemo, useState } from "react";

type Plan = { code: string; label: string; durationMonths: number; priceXof: number; basePriceXof: number; monthlyPriceXof: number; savingsXof: number; discountPercent: number; description: string };
type ActivityOption = { code: string; label: string; multiplier: number; includedServices: string[]; commonServices: string[]; plans: Plan[] };
type SubscriptionPayload = { activity: { type: string; currency: string }; plans: Plan[]; activities: ActivityOption[]; current: { plan: string | null; status: string; trialEndsAt: string | null; expiresAt: string | null }; payments: Array<{ id: string; plan: string; amount: number; currency: string; status: string; period_start: string | null; period_end: string | null; paid_at: string | null; created_at: string }> };

const money = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
function normalizeActivityCode(type: string) { return type === "BUVETTE" ? "BAR" : type; }

type StatusResult = { payment?: { status?: string }; providerStatus?: string; error?: string };

export function SubscriptionPlans({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPlans() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/payments/subscription?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const result = await response.json() as SubscriptionPayload & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les offres.");
      const actualActivity = normalizeActivityCode(result.activity.type);
      setData(result);
      setSelectedActivity(result.activities.some((activity) => activity.code === actualActivity) ? actualActivity : result.activities[0]?.code ?? "");
      setSelectedPlan(result.current.plan ?? result.plans[0]?.code ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger les offres."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadPlans(); }, [tenantId]);

  const actualActivityCode = data ? normalizeActivityCode(data.activity.type) : "";
  const activeActivity = useMemo(() => data?.activities.find((activity) => activity.code === selectedActivity) ?? data?.activities.find((activity) => activity.code === actualActivityCode) ?? data?.activities[0] ?? null, [data, selectedActivity, actualActivityCode]);
  const actualActivity = useMemo(() => data?.activities.find((activity) => activity.code === actualActivityCode) ?? null, [data, actualActivityCode]);
  const selected = useMemo(() => activeActivity?.plans.find((plan) => plan.code === selectedPlan) ?? null, [activeActivity, selectedPlan]);

  async function pollSubscriptionPayment(paymentId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`/api/payments/subscription/status?paymentId=${encodeURIComponent(paymentId)}`, { cache: "no-store" });
      const result = await response.json() as StatusResult;
      if (!response.ok) throw new Error(result.error ?? "Impossible de vérifier l’abonnement MTN MoMo.");
      const status = result.payment?.status;
      if (status === "SUCCEEDED") { setMessage("Paiement confirmé. Votre abonnement est maintenant actif."); await loadPlans(); return; }
      if (status === "FAILED") throw new Error("Le paiement MTN MoMo de l’abonnement a échoué ou a été refusé.");
    }
    setMessage("La demande MTN MoMo est toujours en attente. Vérifiez le téléphone du souscripteur ou actualisez la page.");
  }

  async function startPayment() {
    if (!selected) return;
    if (!mobileNumber.trim()) { setError("Le numéro MTN MoMo utilisé pour l’abonnement est obligatoire."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/payments/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, plan: selected.code, mobileNumber }) });
      const result = await response.json() as { payment?: { id?: string }; error?: string };
      if (!response.ok || !result.payment?.id) throw new Error(result.error ?? "Impossible de lancer le paiement MTN MoMo.");
      setMessage("Demande envoyée. Validez le paiement sur le téléphone MTN MoMo.");
      await pollSubscriptionPayment(result.payment.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de lancer le paiement MTN MoMo."); }
    finally { setPending(false); }
  }

  if (loading) return <section id="plans" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-sm font-bold text-[var(--muted)]">Chargement des offres d’abonnement…</p></section>;
  if (error && !data) return <section id="plans" className="rounded-xl border border-[#ffb4ab] bg-[#fff8f7] p-6"><p role="alert" className="text-sm font-bold text-[var(--danger)]">{error}</p><button type="button" onClick={() => void loadPlans()} className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-white">Réessayer</button></section>;
  if (!data || !activeActivity) return null;

  const expiry = data.current.expiresAt || data.current.trialEndsAt;
  const expiryTime = expiry ? new Date(expiry).getTime() : null;
  const isExpired = Boolean(expiryTime && expiryTime <= Date.now());
  const expiresSoon = Boolean(expiryTime && !isExpired && expiryTime - Date.now() <= 7 * 24 * 60 * 60 * 1000);
  const statusLabel = data.current.expiresAt ? `${data.current.plan ?? "Formule"} · jusqu’au ${dates.format(new Date(data.current.expiresAt))}` : data.current.trialEndsAt ? `Essai · jusqu’au ${dates.format(new Date(data.current.trialEndsAt))}` : "À activer";
  const statusClass = isExpired ? "bg-[#ffdad6] text-[var(--danger)]" : expiresSoon ? "bg-[#fff0c2] text-[var(--primary)]" : "bg-[var(--accent-soft)] text-[var(--primary)]";
  const paymentPrice = selected?.priceXof ?? 0;

  return <section id="plans" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2"><div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-start"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Formules SaaS</p><h2 className="mt-2 text-2xl font-black text-[var(--primary)]">Choisissez une formule selon votre activité</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Les quatre formules sont disponibles pour les trois types d’établissement. Le montant de paiement correspond toujours à la formule et au type sélectionnés.</p></div><div id="subscription-status" className={`rounded-lg px-4 py-3 text-sm font-black ${statusClass}`}><span className="block text-[10px] uppercase tracking-[0.14em] opacity-70">Statut de votre abonnement</span>{statusLabel}{expiresSoon && <span className="mt-1 block text-xs font-bold">Votre abonnement arrive bientôt à échéance.</span>}{isExpired && <span className="mt-1 block text-xs font-bold">Renouvelez pour rétablir l’accès aux services.</span>}</div></div>{(error || message) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-lg px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || message}</p>}<div className="mt-6" role="tablist" aria-label="Types d’établissement"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Type d’établissement</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{data.activities.map((activity) => <button key={activity.code} type="button" role="tab" aria-selected={selectedActivity === activity.code} onClick={() => { setSelectedActivity(activity.code); setMessage(""); }} className={`rounded-lg border px-4 py-3 text-left transition ${selectedActivity === activity.code ? "border-[var(--secondary)] bg-[var(--secondary-container)] shadow-[0_8px_24px_rgba(24,39,52,0.08)]" : "border-[var(--line)] bg-[var(--background)] hover:border-[var(--secondary)]"}`}><span className="block text-sm font-black text-[var(--primary)]">{activity.label}</span><span className="mt-1 block text-xs font-bold text-[var(--muted)]">Tarif de référence ×{activity.multiplier}</span></button>)}</div></div><div className="mt-6 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Offres pour {activeActivity.label}</p><p className="mt-1 text-sm text-[var(--muted)]">Les quatre durées conservent les mêmes fonctionnalités ; seule la période et la réduction changent.</p></div>{activeActivity.code !== actualActivityCode && <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-black uppercase text-[var(--muted)]">Comparaison</span>}</div><div className="mt-4 grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--background)] p-5 md:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Contenu de l’offre {activeActivity.label}</p><ul className="mt-3 space-y-2 text-sm leading-5 text-[var(--muted)]">{activeActivity.includedServices.map((service) => <li key={service} className="flex gap-2"><span className="font-black text-[var(--secondary)]">✓</span><span>{service}</span></li>)}</ul></div><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Services communs inclus</p><ul className="mt-3 space-y-2 text-sm leading-5 text-[var(--muted)]">{activeActivity.commonServices.map((service) => <li key={service} className="flex gap-2"><span className="font-black text-[var(--secondary)]">✓</span><span>{service}</span></li>)}</ul></div></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{activeActivity.plans.map((plan) => <button key={plan.code} type="button" onClick={() => { setSelectedPlan(plan.code); setMessage(""); }} className={`text-left rounded-xl border p-5 transition ${selectedPlan === plan.code ? "border-[var(--secondary)] bg-[var(--secondary-container)] shadow-[0_10px_30px_rgba(24,39,52,0.08)]" : "border-[var(--line)] bg-[var(--background)] hover:border-[var(--secondary)]"}`}><div className="flex items-start justify-between gap-3"><span className="text-lg font-black text-[var(--primary)]">{plan.label}</span><span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-black uppercase text-[var(--muted)]">{plan.durationMonths} mois</span></div><p className="mt-4 text-2xl font-black text-[var(--primary)]">{money.format(plan.priceXof)} <span className="text-xs">XOF</span></p><div className="mt-3 space-y-1 text-xs text-[var(--muted)]"><p>Soit <strong className="text-[var(--primary)]">{money.format(plan.monthlyPriceXof)} XOF/mois</strong> en moyenne</p><p className="font-black text-[var(--secondary)]">Économie : {plan.discountPercent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % · {money.format(plan.savingsXof)} XOF</p></div><p className="mt-4 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--muted)]">{plan.description}</p><p className="mt-2 text-xs font-bold text-[var(--primary)]">Toutes les fonctionnalités incluses</p></button>)}</div><div className="mt-6 grid gap-4 rounded-xl bg-[var(--primary)] p-5 text-white sm:grid-cols-[1fr_280px_auto] sm:items-end"><div><p className="text-sm font-black">{selected ? `Formule sélectionnée : ${selected.label}` : "Sélectionnez une formule"}</p><p className="mt-1 text-xs leading-5 text-white/65">Montant de cette formule : {selected ? `${money.format(selected.priceXof)} XOF au total` : "sélectionnez une formule"}. Le paiement sera demandé par MTN MoMo.</p></div><label className="block text-sm font-bold text-white">Numéro MTN MoMo<input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} type="tel" inputMode="tel" placeholder="Ex. 229xxxxxxxx" className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-white px-3 text-sm font-bold text-[var(--primary)] outline-none focus:border-[var(--secondary-container)]" /></label><button type="button" disabled={!selected || !mobileNumber.trim() || pending} onClick={() => void startPayment()} className="rounded-lg bg-[var(--secondary-container)] px-5 py-3 text-sm font-black text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Confirmation MTN MoMo…" : selected ? `Payer ${money.format(paymentPrice)} XOF` : "Choisir une formule"}</button></div>{activeActivity.code !== actualActivityCode && <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Les montants de l’onglet consulté servent à la comparaison. Le paiement utilise toujours le type enregistré pour l’établissement.</p>}{data.payments.length > 0 && <details className="mt-6"><summary className="cursor-pointer text-sm font-black text-[var(--primary)]">Voir l’historique des abonnements</summary><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]"><th className="pb-3">Formule</th><th className="pb-3">Montant</th><th className="pb-3">Statut</th><th className="pb-3">Période</th></tr></thead><tbody>{data.payments.map((payment) => <tr key={payment.id} className="border-b border-[var(--line)] last:border-0"><td className="py-3 font-bold text-[var(--primary)]">{payment.plan}</td><td className="py-3 text-[var(--muted)]">{money.format(payment.amount)} {payment.currency}</td><td className="py-3 text-[var(--muted)]">{payment.status}</td><td className="py-3 text-[var(--muted)]">{payment.period_start && payment.period_end ? `${dates.format(new Date(payment.period_start))} → ${dates.format(new Date(payment.period_end))}` : "—"}</td></tr>)}</tbody></table></div></details>}</section>;
}
