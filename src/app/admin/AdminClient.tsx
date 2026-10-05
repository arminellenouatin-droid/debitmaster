// DebitMaster Back-office super-administrateur (Desktop-first, Vert profond #003426, or discret #7d5700, fond ivoire #f9f9ff)
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Overview = {
  metrics: {
    establishments: number;
    activeEstablishments: number;
    subscriptionRevenueXof: number;
    succeededSubscriptions: number;
    pendingCommissionXof: number;
    pendingPayouts: number;
  };
  companies: Array<{ id: string; name: string; status: string; activity_type: string; created_at: string }>;
  affiliates: Array<{ id: string; code: string; display_name: string; commission_rate: number; status: string }>;
  payoutRequests: Array<{
    id: string;
    affiliate_id: string;
    amount: number;
    status: string;
    payment_method: string;
    requested_at: string;
    payout_reference?: string | null;
  }>;
};

type ActivityAdmin = {
  activite: string;
  nom_affiche: string;
  prix_mensuel_normal: number;
  coefficient_special: number;
  prix_mensuel_special: number;
  taux_reduction_annuelle: number;
  prix_annuel_normal: number;
  prix_annuel_special: number;
  prix_annuel_normal_override: number | null;
  prix_annuel_special_override: number | null;
  statut_disponibilite: boolean;
  description_courte: string;
  description_option_speciale: string;
  fonctionnalites_normales: string[];
  fonctionnalites_speciales: string[];
};

type GlobalParams = {
  trialDays: number;
  defaultSpecialMultiplier: number;
  defaultAnnualDiscountRate: number;
  updatedAt?: string;
};

type AuditLogRow = {
  id: string;
  plan_id: string;
  champ_modifie: string;
  ancien_prix: string;
  nouveau_prix: string;
  auteur: string | null;
  date: string;
};

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;

export function AdminClient({ firstName }: { firstName: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [newAffiliate, setNewAffiliate] = useState({ displayName: "", email: "", phone: "", code: "" });
  const [temporaryPassword, setTemporaryPassword] = useState("");

  // État de gestion de la tarification PRD v1.1
  const [activities, setActivities] = useState<ActivityAdmin[]>([]);
  const [globalParams, setGlobalParams] = useState<GlobalParams>({
    trialDays: 30,
    defaultSpecialMultiplier: 1.5,
    defaultAnnualDiscountRate: 0.25,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [activityReasons, setActivityReasons] = useState<Record<string, string>>({});
  const [globalParamReason, setGlobalParamReason] = useState("");

  async function load() {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }

  async function loadPricing() {
    const response = await fetch("/api/admin/pricing", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (Array.isArray(result.activities)) setActivities(result.activities);
    if (result.globalParams) setGlobalParams(result.globalParams);
    if (Array.isArray(result.auditLogs)) setAuditLogs(result.auditLogs);
  }

  useEffect(() => {
    Promise.all([load(), loadPricing()]).catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Chargement impossible")
    );
  }, []);

  async function createAffiliate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccessMsg("");
    setTemporaryPassword("");
    try {
      const response = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAffiliate),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setTemporaryPassword(result.temporaryPassword);
      setNewAffiliate({ displayName: "", email: "", phone: "", code: "" });
      setSuccessMsg("Affilié créé avec succès.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  async function reviewPayout(id: string, status: "APPROVED" | "REJECTED") {
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await fetch(`/api/admin/payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccessMsg(`Demande de reversement passée en statut ${status}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mise à jour impossible");
    } finally {
      setBusy(false);
    }
  }

  async function initiatePayout(id: string) {
    if (!window.confirm("Confirmez-vous l’envoi de ce reversement Mobile Money via PawaPay ?")) return;
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await fetch(`/api/admin/payouts/${id}/pawapay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccessMsg("Reversement Mobile Money (PawaPay) initié avec succès.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reversement Mobile Money impossible");
    } finally {
      setBusy(false);
    }
  }

  async function checkPayout(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payouts/${id}/pawapay/status`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      if (result.providerStatus === "FAILED" || result.providerStatus === "REJECTED") {
        setError("Le reversement PawaPay a échoué ou a été refusé par le fournisseur.");
      } else {
        setSuccessMsg(`Statut PawaPay : ${result.providerStatus ?? "Vérifié"}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vérification PawaPay impossible");
    } finally {
      setBusy(false);
    }
  }

  // Enregistrement d'une activité
  async function saveActivity(act: ActivityAdmin) {
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const reason = activityReasons[act.activite] || "Ajustement tarifaire super-administrateur";
      const response = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "activity_plan",
          activityCode: act.activite,
          monthlyNormalPrice: act.prix_mensuel_normal,
          specialMultiplier: act.coefficient_special,
          annualNormalOverride: act.prix_annuel_normal_override,
          annualSpecialOverride: act.prix_annuel_special_override,
          isAvailable: act.statut_disponibilite,
          specialDescription: act.description_option_speciale,
          reason,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccessMsg(`Tarifs de l'activité ${act.nom_affiche} enregistrés avec succès.`);
      await loadPricing();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur lors de l'enregistrement de l'activité");
    } finally {
      setBusy(false);
    }
  }

  // Enregistrement des paramètres globaux
  async function saveGlobalParams(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "global_params",
          trialDays: globalParams.trialDays,
          defaultSpecialMultiplier: globalParams.defaultSpecialMultiplier,
          defaultAnnualDiscountRate: globalParams.defaultAnnualDiscountRate,
          reason: globalParamReason || "Mise à jour des paramètres globaux",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccessMsg("Paramètres globaux de tarification enregistrés.");
      await loadPricing();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur lors de l'enregistrement des paramètres");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl py-12">
        <p className="text-sm font-bold text-[var(--muted)]">Chargement du cockpit SaaS…</p>
      </div>
    );
  }

  const nav = [
    ["overview", "Vue d’ensemble"],
    ["establishments", "Établissements"],
    ["pricing", "Tarifs SaaS (6 Activités)"],
    ["affiliates", "Affiliés"],
    ["payouts", "Remboursements"],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      {/* En-tête plateforme */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-800 ring-1 ring-amber-500/30">
              Cockpit Super-Admin
            </span>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">
              DebitMaster · Plateforme
            </p>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-[var(--primary)]">
            Bonjour {firstName || "administrateur"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Supervision globale des abonnements, de la tarification par activité, des établissements et de l’affiliation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/tarifs"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-black text-[var(--primary)] shadow-sm hover:bg-[var(--surface-muted)] transition"
          >
            <span>Aperçu public /tarifs</span>
            <span>↗</span>
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black text-[var(--primary)] hover:bg-red-50 hover:text-red-700 transition">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      {/* Messages d'alerte et de confirmation */}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Onglets de navigation */}
      <nav className="flex gap-2 overflow-x-auto border-b border-[var(--line)] pb-2">
        {nav.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setError("");
              setSuccessMsg("");
            }}
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-black transition ${
              tab === key
                ? "bg-[var(--primary)] text-white shadow-md"
                : "text-[var(--muted)] hover:bg-[var(--surface)]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* 1. VUE D'ENSEMBLE */}
      {tab === "overview" && (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Revenus abonnement", money(data.metrics.subscriptionRevenueXof)],
              ["Établissements actifs", `${data.metrics.activeEstablishments}/${data.metrics.establishments}`],
              ["Commissions à traiter", money(data.metrics.pendingCommissionXof)],
              ["Demandes en attente", String(data.metrics.pendingPayouts)],
            ].map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
                <p className="mt-3 text-2xl font-black tabular-nums text-[var(--primary)]">{value}</p>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-black text-[var(--primary)]">Derniers établissements inscrits</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  <tr>
                    <th className="pb-3">Établissement</th>
                    <th className="pb-3">Activité</th>
                    <th className="pb-3">Statut</th>
                    <th className="pb-3">Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.slice(0, 8).map((company) => (
                    <tr key={company.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="py-4 font-black text-[var(--primary)]">{company.name}</td>
                      <td className="py-4 text-[var(--muted)] font-medium">{company.activity_type}</td>
                      <td className="py-4">
                        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                          {company.status}
                        </span>
                      </td>
                      <td className="py-4 text-[var(--muted)]">
                        {new Date(company.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 2. ÉTABLISSEMENTS */}
      {tab === "establishments" && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="text-xl font-black text-[var(--primary)]">Tous les établissements ({data.companies.length})</h2>
          <div className="mt-5 grid gap-3">
            {data.companies.map((company) => (
              <div
                key={company.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-4 last:border-0"
              >
                <div>
                  <p className="font-black text-[var(--primary)] text-base">{company.name}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Activité : <span className="font-bold text-[var(--primary)]">{company.activity_type}</span> · ID :{" "}
                    <code className="text-[11px] text-[var(--muted)]">{company.id}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                    {company.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. TARIFS SAAS (PRD v1.1 - 6 ACTIVITÉS & PARAMÈTRES GLOBAUX) */}
      {tab === "pricing" && (
        <section className="space-y-8">
          {/* Header de la section tarification */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-[var(--primary)]">
                  Pilotage complet de la tarification (PRD v1.1)
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)] max-w-3xl leading-relaxed">
                  Modèle unifié pour les 6 activités : tarif mensuel normal propre, réduction annuelle de 25 % automatique
                  (mensuel × 12 × 0,75), option spéciale à +50 % (×1,5), essai gratuit global de 30 jours et surcharges manuelles.
                </p>
              </div>
              <Link
                href="/tarifs"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3 text-xs font-black text-slate-950 shadow-md hover:from-amber-400 hover:to-amber-300 transition"
              >
                <span>Vérifier le rendu sur /tarifs</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          {/* Carte 1 : Paramètres globaux du SaaS */}
          <form
            onSubmit={saveGlobalParams}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <h3 className="text-lg font-black text-[var(--primary)]">Paramètres globaux du SaaS</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Appliqués à l’ensemble des nouveaux comptes et formules par défaut.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                Configuration générale
              </span>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <label className="block text-xs font-black uppercase tracking-[0.1em] text-[var(--muted)]">
                Durée essai gratuit (jours)
                <input
                  type="number"
                  min="1"
                  max="180"
                  step="1"
                  value={globalParams.trialDays}
                  onChange={(e) =>
                    setGlobalParams({ ...globalParams, trialDays: Math.max(1, Number(e.target.value)) })
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 text-base font-black text-[var(--primary)]"
                />
                <span className="mt-1 block text-[11px] font-medium text-[var(--muted)]">
                  Valeur de référence : 30 jours
                </span>
              </label>

              <label className="block text-xs font-black uppercase tracking-[0.1em] text-[var(--muted)]">
                Multiplicateur Option spéciale (défaut)
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.05"
                  value={globalParams.defaultSpecialMultiplier}
                  onChange={(e) =>
                    setGlobalParams({
                      ...globalParams,
                      defaultSpecialMultiplier: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 text-base font-black text-[var(--primary)]"
                />
                <span className="mt-1 block text-[11px] font-medium text-[var(--muted)]">
                  Valeur de référence : 1.50 (+50%)
                </span>
              </label>

              <label className="block text-xs font-black uppercase tracking-[0.1em] text-[var(--muted)]">
                Réduction annuelle par défaut
                <input
                  type="number"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={globalParams.defaultAnnualDiscountRate}
                  onChange={(e) =>
                    setGlobalParams({
                      ...globalParams,
                      defaultAnnualDiscountRate: Number(e.target.value),
                    })
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 text-base font-black text-[var(--primary)]"
                />
                <span className="mt-1 block text-[11px] font-medium text-[var(--muted)]">
                  Valeur de référence : 0.25 (25% / 3 mois offerts)
                </span>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--line)]">
              <input
                type="text"
                placeholder="Motif de modification pour l'audit log (optionnel)…"
                value={globalParamReason}
                onChange={(e) => setGlobalParamReason(e.target.value)}
                className="h-11 flex-1 min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 text-xs font-bold text-[var(--primary)]"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[var(--primary)] px-6 py-3 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition"
              >
                Enregistrer les paramètres globaux
              </button>
            </div>
          </form>

          {/* Grille des 6 Activités */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[var(--primary)]">
                Grille tarifaire des 6 activités ({activities.length})
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Toute modification met à jour la base de données et est immédiatement appliquée.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {activities.map((act) => {
                const calculatedSpecialMonthly = Math.round(act.prix_mensuel_normal * act.coefficient_special);
                const calculatedNormalAnnual = Math.round(act.prix_mensuel_normal * 12 * 0.75);
                const calculatedSpecialAnnual = Math.round(calculatedSpecialMonthly * 12 * 0.75);

                const effectiveNormalAnnual = act.prix_annuel_normal_override ?? calculatedNormalAnnual;
                const effectiveSpecialAnnual = act.prix_annuel_special_override ?? calculatedSpecialAnnual;

                return (
                  <div
                    key={act.activite}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
                  >
                    <div>
                      {/* En-tête activité */}
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--line)] pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                              {act.activite}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                act.statut_disponibilite
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {act.statut_disponibilite ? "Actif & Souscriptible" : "Désactivé"}
                            </span>
                          </div>
                          <h4 className="mt-1 text-xl font-black text-[var(--primary)]">{act.nom_affiche}</h4>
                          <p className="text-xs text-[var(--muted)] mt-0.5">{act.description_courte}</p>
                        </div>

                        {/* Toggle Activation */}
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--primary)]">
                          <span>Actif :</span>
                          <input
                            type="checkbox"
                            checked={act.statut_disponibilite}
                            onChange={(e) =>
                              setActivities((curr) =>
                                curr.map((item) =>
                                  item.activite === act.activite
                                    ? { ...item, statut_disponibilite: e.target.checked }
                                    : item
                                )
                              )
                            }
                            className="h-5 w-5 accent-emerald-600 rounded cursor-pointer"
                          />
                        </label>
                      </div>

                      {/* Tarifs Mensuels */}
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {/* Mensuel Normal */}
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3.5">
                          <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                            Prix mensuel normal (FCFA)
                            <input
                              type="number"
                              min="1"
                              step="1000"
                              value={act.prix_mensuel_normal}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setActivities((curr) =>
                                  curr.map((item) =>
                                    item.activite === act.activite
                                      ? {
                                          ...item,
                                          prix_mensuel_normal: val,
                                          prix_mensuel_special: Math.round(val * item.coefficient_special),
                                          prix_annuel_normal: Math.round(val * 12 * 0.75),
                                          prix_annuel_special: Math.round(
                                            Math.round(val * item.coefficient_special) * 12 * 0.75
                                          ),
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-black text-[var(--primary)]"
                            />
                          </label>
                          <span className="mt-1 block text-[10px] text-[var(--muted)]">
                            Base de calcul pour l'annuel (-25%)
                          </span>
                        </div>

                        {/* Coefficient Option Spéciale */}
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3.5">
                          <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                            Coefficient spécial (×)
                            <input
                              type="number"
                              min="1"
                              max="3"
                              step="0.05"
                              value={act.coefficient_special}
                              onChange={(e) => {
                                const coef = Number(e.target.value);
                                setActivities((curr) =>
                                  curr.map((item) =>
                                    item.activite === act.activite
                                      ? {
                                          ...item,
                                          coefficient_special: coef,
                                          prix_mensuel_special: Math.round(item.prix_mensuel_normal * coef),
                                          prix_annuel_special: Math.round(
                                            Math.round(item.prix_mensuel_normal * coef) * 12 * 0.75
                                          ),
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-black text-[var(--primary)]"
                            />
                          </label>
                          <span className="mt-1 block text-[10px] font-bold text-amber-700">
                            Mensuel Spécial : {money(calculatedSpecialMonthly)}
                          </span>
                        </div>
                      </div>

                      {/* Tarifs Annuels et Surcharges */}
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {/* Annuel Normal */}
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                              Annuel Normal
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700">
                              Auto : {money(calculatedNormalAnnual)}
                            </span>
                          </div>
                          <label className="mt-2 block text-xs font-bold text-[var(--primary)]">
                            <span className="text-[10px] text-[var(--muted)]">Surcharge manuelle (FCFA) :</span>
                            <input
                              type="number"
                              placeholder={`Défaut: ${calculatedNormalAnnual}`}
                              value={act.prix_annuel_normal_override ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : Number(e.target.value);
                                setActivities((curr) =>
                                  curr.map((item) =>
                                    item.activite === act.activite
                                      ? { ...item, prix_annuel_normal_override: val }
                                      : item
                                  )
                                );
                              }}
                              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-xs font-bold text-[var(--primary)]"
                            />
                          </label>
                          <p className="mt-1 text-[10px] font-black text-[var(--primary)]">
                            Prix appliqué : {money(effectiveNormalAnnual)}
                          </p>
                        </div>

                        {/* Annuel Spécial */}
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                              Annuel Spécial
                            </span>
                            <span className="text-[10px] font-bold text-amber-700">
                              Auto : {money(calculatedSpecialAnnual)}
                            </span>
                          </div>
                          <label className="mt-2 block text-xs font-bold text-[var(--primary)]">
                            <span className="text-[10px] text-[var(--muted)]">Surcharge manuelle (FCFA) :</span>
                            <input
                              type="number"
                              placeholder={`Défaut: ${calculatedSpecialAnnual}`}
                              value={act.prix_annuel_special_override ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : Number(e.target.value);
                                setActivities((curr) =>
                                  curr.map((item) =>
                                    item.activite === act.activite
                                      ? { ...item, prix_annuel_special_override: val }
                                      : item
                                  )
                                );
                              }}
                              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-xs font-bold text-[var(--primary)]"
                            />
                          </label>
                          <p className="mt-1 text-[10px] font-black text-amber-700">
                            Prix appliqué : {money(effectiveSpecialAnnual)}
                          </p>
                        </div>
                      </div>

                      {/* Descriptif Option Spéciale */}
                      <div className="mt-4">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                          Descriptif de l'Option Spéciale (+50%)
                          <textarea
                            rows={2}
                            value={act.description_option_speciale}
                            onChange={(e) =>
                              setActivities((curr) =>
                                curr.map((item) =>
                                  item.activite === act.activite
                                    ? { ...item, description_option_speciale: e.target.value }
                                    : item
                                )
                              )
                            }
                            className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] p-3 text-xs leading-relaxed text-[var(--primary)] font-medium"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Actions d'enregistrement */}
                    <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
                      <input
                        type="text"
                        placeholder="Motif d'audit pour cette activité…"
                        value={activityReasons[act.activite] || ""}
                        onChange={(e) =>
                          setActivityReasons({ ...activityReasons, [act.activite]: e.target.value })
                        }
                        className="h-10 flex-1 min-w-[200px] rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-xs font-bold text-[var(--primary)]"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveActivity(act)}
                        className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition"
                      >
                        Enregistrer {act.nom_affiche}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <h3 className="text-lg font-black text-[var(--primary)]">Journal d’audit des modifications tarifaires</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Traçabilité immuable de chaque changement de prix, paramètre global ou coefficient.
                </p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                {auditLogs.length} entrées
              </span>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="border-b border-[var(--line)] uppercase tracking-[0.1em] text-[var(--muted)]">
                  <tr>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Auteur</th>
                    <th className="pb-3">Plan / Cible</th>
                    <th className="pb-3">Champ</th>
                    <th className="pb-3">Détail / Nouveau tarif</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="py-3 text-[var(--muted)] whitespace-nowrap">
                          {new Date(log.date).toLocaleString("fr-FR")}
                        </td>
                        <td className="py-3 font-bold text-[var(--primary)]">{log.auteur || "Administrateur"}</td>
                        <td className="py-3 font-black text-[var(--primary)]">{log.plan_id}</td>
                        <td className="py-3 text-[var(--muted)]">{log.champ_modifie}</td>
                        <td className="py-3 font-medium text-[var(--primary)]">{log.nouveau_prix}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-[var(--muted)]">
                        Aucun changement tarifaire journalisé pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 4. AFFILIÉS */}
      {tab === "affiliates" && (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={createAffiliate} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-black text-[var(--primary)]">Créer un affilié</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Le mot de passe temporaire sera affiché une seule fois après création.
            </p>
            <div className="mt-5 space-y-4">
              {[
                ["displayName", "Nom complet", "text"],
                ["email", "E-mail", "email"],
                ["phone", "Téléphone (optionnel)", "tel"],
                ["code", "Code personnalisé (optionnel)", "text"],
              ].map(([key, label, type]) => (
                <label key={key} className="block text-sm font-bold text-[var(--primary)]">
                  {label}
                  <input
                    type={type}
                    value={newAffiliate[key as keyof typeof newAffiliate]}
                    onChange={(event) => setNewAffiliate({ ...newAffiliate, [key]: event.target.value })}
                    className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4"
                  />
                </label>
              ))}
              <button
                disabled={busy}
                className="w-full rounded-full bg-[var(--primary)] px-5 py-3.5 text-sm font-black text-white disabled:opacity-60"
              >
                Créer le compte affilié
              </button>
              {temporaryPassword && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
                  Mot de passe temporaire à transmettre de manière sécurisée : <code>{temporaryPassword}</code>
                </p>
              )}
            </div>
          </form>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-black text-[var(--primary)]">Affiliés actifs ({data.affiliates.length})</h2>
            <div className="mt-5 space-y-3">
              {data.affiliates.map((affiliate) => (
                <div
                  key={affiliate.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-4 last:border-0"
                >
                  <div>
                    <p className="font-black text-[var(--primary)]">{affiliate.display_name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      Lien : <code>/inscription?ref={affiliate.code}</code> · {affiliate.commission_rate}%
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                    {affiliate.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. REMBOURSEMENTS */}
      {tab === "payouts" && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="text-xl font-black text-[var(--primary)]">Demandes de reversement de commissions</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Seuil minimum appliqué côté serveur et côté base : 20 000 FCFA.
          </p>
          <div className="mt-5 space-y-3">
            {data.payoutRequests.length ? (
              data.payoutRequests.map((payout) => (
                <div
                  key={payout.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] py-4 last:border-0"
                >
                  <div>
                    <p className="font-black text-[var(--primary)]">{money(payout.amount)}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {payout.payment_method} · {new Date(payout.requested_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--primary)]">
                      {payout.status}
                    </span>
                    {payout.status === "PENDING" && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => reviewPayout(payout.id, "APPROVED")}
                          className="rounded-full bg-[var(--primary)] px-3 py-2 text-xs font-black text-white"
                        >
                          Approuver
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => reviewPayout(payout.id, "REJECTED")}
                          className="rounded-full border border-red-200 px-3 py-2 text-xs font-black text-red-700"
                        >
                          Refuser
                        </button>
                      </>
                    )}
                    {payout.status === "APPROVED" && !payout.payout_reference && (
                      <button
                        disabled={busy}
                        onClick={() => void initiatePayout(payout.id)}
                        className="rounded-full bg-[var(--secondary)] px-3 py-2 text-xs font-black text-white"
                      >
                        Verser via PawaPay
                      </button>
                    )}
                    {payout.status === "APPROVED" && payout.payout_reference && (
                      <button
                        disabled={busy}
                        onClick={() => void checkPayout(payout.id)}
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black text-[var(--primary)]"
                      >
                        Vérifier PawaPay
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-[var(--muted)]">Aucune demande de paiement pour le moment.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
