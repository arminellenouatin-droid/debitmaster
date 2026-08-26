// DebitManager payment UI: MTN MoMo asynchrone, paiement autorisé dès la création de la commande et vente validée uniquement après confirmation.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
type Order = { id: string; tenant_id: string; total_amount: number; currency: string; order_number: string; status: string };

type PaymentStatus = { payment?: { status?: string }; providerStatus?: string; error?: string };

export function PaymentClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const [tenantId, setTenantId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [total, setTotal] = useState("0");
  const [received, setReceived] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [method, setMethod] = useState("mtn_momo");
  const [message, setMessage] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(Boolean(orderId));
  const [pending, setPending] = useState(false);
  const numericTotal = Math.max(0, Number(total) || 0);
  const numericReceived = Math.max(0, Number(received) || 0);
  const change = useMemo(() => Math.max(0, numericReceived - numericTotal), [numericReceived, numericTotal]);
  const remaining = Math.max(0, numericTotal - numericReceived);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    fetch("/api/orders")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger la commande.");
        const found = (result.orders ?? []).find((item: Order) => item.id === orderId);
        if (!active) return;
        if (!found || !found.tenant_id) throw new Error("Commande introuvable pour cette session.");
        setTenantId(found.tenant_id);
        setOrder(found);
        setTotal(String(found.total_amount));
      })
      .catch((cause) => active && setMessage(cause instanceof Error ? cause.message : "Impossible de charger la commande."))
      .finally(() => active && setLoadingOrder(false));
    return () => { active = false; };
  }, [orderId]);

  async function pollMtnPayment(paymentId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`/api/payments/mtn-momo/status?paymentId=${encodeURIComponent(paymentId)}`, { cache: "no-store" });
      const result = await response.json() as PaymentStatus;
      if (!response.ok) throw new Error(result.error ?? "Impossible de vérifier le paiement MTN MoMo.");
      const status = result.payment?.status;
      if (status === "SUCCEEDED") { setMessage("Paiement MTN MoMo confirmé. La vente est enregistrée."); return; }
      if (status === "FAILED") throw new Error("Le paiement MTN MoMo a échoué ou a été refusé.");
    }
    setMessage("La demande MTN MoMo est toujours en attente. Vérifiez le téléphone du client ou actualisez cette page.");
  }

  async function startMtnMomo() {
    if (!tenantId || !orderId) { setMessage("Ouvrez le paiement depuis une commande créée dans cet établissement."); return; }
    if (!mobileNumber.trim()) { setMessage("Le numéro MTN MoMo du client est obligatoire."); return; }
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/payments/mtn-momo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, orderId, amount: numericTotal, mobileNumber }) });
      const result = await response.json() as { payment?: { id?: string }; error?: string };
      if (!response.ok || !result.payment?.id) throw new Error(result.error ?? "Impossible d’initialiser MTN MoMo.");
      setMessage("Demande envoyée. Le client doit confirmer le paiement sur son téléphone.");
      await pollMtnPayment(result.payment.id);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Impossible d’initialiser MTN MoMo.");
    } finally { setPending(false); }
  }

  async function startCash() {
    if (!tenantId || !orderId || numericReceived < numericTotal) { setMessage("Le montant reçu doit couvrir le total de la commande."); return; }
    setMessage(""); setPending(true);
    try {
      const response = await fetch("/api/payments/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, orderId, amount: numericTotal }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer l’encaissement cash.");
      setMessage("Encaissement cash enregistré.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Impossible d’enregistrer l’encaissement cash."); }
    finally { setPending(false); }
  }

  const methods = [["mtn_momo", "MTN MoMo", "Le client confirme sur son téléphone"], ["cash", "Espèces", "Encaissement direct au client"], ["pending", "À crédit", "À régulariser"]] as const;
  return <section className="mx-auto max-w-5xl"><div className="mb-7"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Paiement</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">Finaliser l’encaissement</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Le paiement peut être lancé dès que la commande existe. La vente est validée uniquement après confirmation complète du règlement.</p></div>{loadingOrder && <p className="mb-6 rounded-lg bg-[var(--surface-muted)] px-4 py-3 text-sm font-bold text-[var(--muted)]">Chargement de la commande…</p>}{message && <p role="alert" className="mb-6 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--primary)]">{message}</p>}<div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">{order && <div className="mb-7 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--primary)]">Commande {order.order_number} · statut {order.status}</div>}<label className="block text-sm font-bold text-[var(--ink)]">Total de la commande<input value={total} onChange={(event) => setTotal(event.target.value)} type="number" min="0" inputMode="numeric" placeholder="0" className="mt-2 h-14 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 text-2xl font-black text-[var(--primary)] outline-none focus:border-[var(--primary)]" /></label><div className="mt-8"><p className="text-sm font-black text-[var(--primary)]">Moyen de paiement</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{methods.map(([value, label, text]) => <button type="button" key={value} onClick={() => setMethod(value)} className={`rounded-lg border-2 p-4 text-left transition ${method === value ? "border-[var(--primary)] bg-[var(--accent-soft)]" : "border-[var(--line)] hover:border-[var(--primary-container)]"}`}><span className="block text-sm font-black text-[var(--primary)]">{label}</span><span className="mt-2 block text-xs leading-5 text-[var(--muted)]">{text}</span></button>)}</div></div>{method === "mtn_momo" && <label className="mt-8 block text-sm font-bold text-[var(--ink)]">Numéro MTN MoMo du client<input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} type="tel" inputMode="tel" placeholder="Ex. 229xxxxxxxx" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--primary)]" /><span className="mt-2 block text-xs font-normal text-[var(--muted)]">Une notification de confirmation sera envoyée au client.</span></label>}{method !== "mtn_momo" && <label className="mt-8 block text-sm font-bold text-[var(--ink)]">Montant reçu<input value={received} onChange={(event) => setReceived(event.target.value)} type="number" min="0" inputMode="numeric" placeholder="0" className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--primary)]" /></label>}<div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-[var(--surface-muted)] p-4"><p className="text-xs font-bold text-[var(--muted)]">Reste à payer</p><p className="mt-2 text-xl font-black text-[var(--primary)]">{money(method === "mtn_momo" ? numericTotal : remaining)}</p></div><div className="rounded-lg bg-[var(--accent-soft)] p-4"><p className="text-xs font-bold text-[var(--muted)]">Rendu</p><p className="mt-2 text-xl font-black text-[var(--primary)]">{money(change)}</p></div></div><button onClick={() => method === "mtn_momo" ? void startMtnMomo() : method === "cash" ? void startCash() : setMessage("Le règlement restera à régulariser, sans confirmation de paiement.")} disabled={numericTotal <= 0 || pending || (method === "cash" && numericReceived < numericTotal)} className="mt-8 h-12 w-full rounded-lg bg-[var(--primary)] text-sm font-black text-white transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45">{pending ? (method === "mtn_momo" ? "Confirmation MTN MoMo…" : "Enregistrement…") : method === "mtn_momo" ? "Demander le paiement MTN MoMo →" : method === "cash" ? "Confirmer l’encaissement cash →" : "Marquer à régulariser →"}</button></div><aside className="h-fit rounded-xl bg-[var(--primary)] p-6 text-white shadow-[0_20px_45px_-28px_var(--primary)]"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Résumé</p><p className="mt-7 text-sm font-bold text-white/65">Total à encaisser</p><p className="mt-2 text-4xl font-black">{money(numericTotal)}</p><div className="mt-8 space-y-4 border-t border-white/15 pt-5 text-sm"><div className="flex justify-between gap-4"><span className="text-white/60">Méthode</span><span className="font-black">{method === "mtn_momo" ? "MTN MoMo" : method === "cash" ? "Espèces" : "À crédit"}</span></div><div className="flex justify-between gap-4"><span className="text-white/60">État</span><span className="font-black text-[var(--secondary-container)]">{pending ? "Confirmation en cours" : "En attente"}</span></div></div><p className="mt-8 text-xs leading-5 text-white/55">Aucune vente n’est déclarée réussie avant le retour vérifié de MTN MoMo.</p></aside></div></section>;
}
