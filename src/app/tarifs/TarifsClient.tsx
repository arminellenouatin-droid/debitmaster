"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  Wine,
  UtensilsCrossed,
  Sparkles as PartyPopper,
  Building2,
  ShoppingBag,
  Scissors,
} from "@/components/Icons";
import {
  subscriptionActivityCodes,
  referenceActivityConfigs,
  calculateAnnualPrice,
  calculateSpecialPrice,
  type SubscriptionActivityCode,
  type BillingPeriod,
} from "@/lib/subscription-plans";

const money = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const activityIcons: Record<SubscriptionActivityCode, React.ReactNode> = {
  BUVETTE: <Wine className="h-6 w-6 text-amber-400" />,
  BAR_RESTAURANT: <UtensilsCrossed className="h-6 w-6 text-emerald-400" />,
  NIGHTCLUB_LOUNGE: <PartyPopper className="h-6 w-6 text-purple-400" />,
  HOTEL_AUBERGE: <Building2 className="h-6 w-6 text-sky-400" />,
  BOUTIQUE_COMMERCE: <ShoppingBag className="h-6 w-6 text-amber-400" />,
  ATELIER_COUTURE: <Scissors className="h-6 w-6 text-pink-400" />,
};

export function TarifsClient() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("MONTHLY");
  // Set of activities where the special option is toggled ON
  const [specialOptions, setSpecialOptions] = useState<Record<string, boolean>>({
    BAR_RESTAURANT: true, // Pré-activé par défaut sur Bar & Restaurant pour valoriser les modules complets
  });
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  function toggleSpecialOption(activityCode: string) {
    setSpecialOptions((prev) => ({
      ...prev,
      [activityCode]: !prev[activityCode],
    }));
  }

  return (
    <div className="min-h-screen bg-[#070d10] text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Top Banner Notice */}
      <div className="relative z-50 border-b border-amber-500/20 bg-gradient-to-r from-emerald-950 via-emerald-900 to-amber-950 px-4 py-2.5 text-center text-xs font-semibold text-amber-200">
        <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300">
          <Sparkles className="h-3 w-3" /> NOUVELLE GRILLE
        </span>
        30 jours d’essai entièrement gratuits sur les 6 activités du SaaS, sans aucun engagement.{" "}
        <Link href="/inscription" className="ml-1 inline-flex items-center underline hover:text-white">
          Démarrer mon essai <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070d10]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-950 shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400/30 transition-all duration-200 group-hover:scale-105">
              <span className="text-xl font-black text-amber-400">D</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-white">DebitMaster</span>
                <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400 ring-1 ring-amber-400/30">
                  Pro
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400">Tarification transparente & modulaire</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            <Link href="/" className="transition hover:text-amber-400">
              Accueil
            </Link>
            <a href="#activites" className="transition hover:text-amber-400">
              Les 6 Métiers
            </a>
            <a href="#faq" className="transition hover:text-amber-400">
              Questions fréquentes
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/connexion"
              className="hidden rounded-lg px-3.5 py-2 text-sm font-bold text-slate-300 transition hover:text-white sm:block"
            >
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-900/50 ring-1 ring-emerald-400/30 transition-all duration-150 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98]"
            >
              <span>Créer mon compte</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero & Toggle Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 h-[450px] w-[700px] rounded-full bg-gradient-to-tr from-emerald-600/20 via-amber-500/10 to-transparent blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-4 py-1.5 text-xs font-bold text-emerald-300 backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span>Tarifs simples, prévisibles et sans frais cachés</span>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            6 Métiers. Un modèle clair. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
              30 jours d’essai offert.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Chaque établissement dispose d’une formule adaptée à son activité réelle. Optez pour le paiement annuel et bénéficiez automatiquement de <strong>25 % de réduction</strong> (soit 3 mois complets offerts).
          </p>

          {/* Billing Switcher */}
          <div className="mt-10 inline-flex items-center rounded-2xl bg-slate-900/90 p-1.5 ring-1 ring-slate-800">
            <button
              type="button"
              onClick={() => setBillingPeriod("MONTHLY")}
              className={`rounded-xl px-6 py-3 text-sm font-black transition-all ${
                billingPeriod === "MONTHLY"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Paiement Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("ANNUAL")}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition-all ${
                billingPeriod === "ANNUAL"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Paiement Annuel</span>
              <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-black text-amber-300 ring-1 ring-amber-400/30">
                -25 % (3 mois offerts)
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 6 Activities Pricing Cards Grid */}
      <section id="activites" className="border-t border-slate-800/80 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {subscriptionActivityCodes.map((activityCode) => {
              const config = referenceActivityConfigs[activityCode];
              const isSpecial = Boolean(specialOptions[activityCode]);
              const baseMonthly = config.monthlyNormalPriceXof;
              const monthlyPrice = isSpecial
                ? calculateSpecialPrice(baseMonthly, config.specialMultiplier)
                : baseMonthly;
              const finalPrice =
                billingPeriod === "ANNUAL"
                  ? calculateAnnualPrice(monthlyPrice, config.annualDiscountRate)
                  : monthlyPrice;
              const fullYearUndiscounted = monthlyPrice * 12;
              const savings = billingPeriod === "ANNUAL" ? fullYearUndiscounted - finalPrice : 0;
              const monthlyEquivalent =
                billingPeriod === "ANNUAL" ? Math.round(finalPrice / 12) : monthlyPrice;

              const isPopular = activityCode === "BAR_RESTAURANT";

              return (
                <div
                  key={activityCode}
                  className={`relative flex flex-col justify-between rounded-3xl border transition-all duration-200 ${
                    isPopular
                      ? "border-2 border-amber-500/80 bg-gradient-to-b from-slate-900 via-slate-900 to-[#0c1815] p-7 shadow-2xl shadow-emerald-950/60"
                      : "border-slate-800 bg-slate-900/60 p-7 hover:border-slate-700"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                      Le plus plébiscité
                    </div>
                  )}

                  <div>
                    {/* Header: Icon & Activity Title */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 ring-1 ring-slate-700">
                        {activityIcons[activityCode]}
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-300 ring-1 ring-emerald-500/20">
                        30 jours d’essai
                      </span>
                    </div>

                    <h3 className="mt-5 text-2xl font-black text-white">{config.label}</h3>
                    <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-400">
                      {config.tagline}
                    </p>

                    {/* Price display */}
                    <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white sm:text-4xl">
                          {money.format(monthlyEquivalent)}
                        </span>
                        <span className="text-xs font-bold text-slate-400">FCFA / mois</span>
                      </div>

                      {billingPeriod === "ANNUAL" && (
                        <div className="mt-2 text-xs font-semibold text-emerald-400">
                          Total annuel : <strong>{money.format(finalPrice)} FCFA</strong>
                          <span className="ml-1 text-slate-400">
                            (économie de {money.format(savings)} FCFA)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Special Option Toggle */}
                    <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Option Spéciale (+50 %)</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Modules & prestations avancés
                          </p>
                        </div>

                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={isSpecial}
                            onChange={() => toggleSpecialOption(activityCode)}
                            className="peer sr-only"
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-800 ring-1 ring-slate-700 transition after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                      </div>

                      {isSpecial && (
                        <p className="mt-2.5 text-[11px] leading-relaxed text-amber-200/90 border-t border-amber-500/15 pt-2">
                          {config.specialDescription}
                        </p>
                      )}
                    </div>

                    {/* Features list */}
                    <div className="mt-6">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Inclus dans cette formule :
                      </p>
                      <ul className="mt-3 space-y-2.5 text-xs text-slate-300">
                        {config.normalFeatures.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <span>{feat}</span>
                          </li>
                        ))}
                        {isSpecial &&
                          config.specialFeatures.map((sFeat, sIdx) => (
                            <li key={`special-${sIdx}`} className="flex items-start gap-2.5 text-amber-200">
                              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                              <span className="font-semibold">{sFeat}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-8 pt-4 border-t border-slate-800">
                    <Link
                      href={`/inscription?activity=${activityCode}&period=${billingPeriod}&level=${
                        isSpecial ? "SPECIAL" : "NORMAL"
                      }`}
                      className={`block w-full rounded-xl py-3.5 text-center text-sm font-black transition-all ${
                        isPopular
                          ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300"
                          : "border border-slate-700 bg-slate-800 text-white hover:border-slate-600 hover:bg-slate-700"
                      }`}
                    >
                      Démarrer en {config.label}
                    </Link>
                    <p className="mt-2 text-center text-[10px] text-slate-500">
                      30 jours d’essai sans carte bancaire
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="border-t border-slate-800/80 bg-slate-950/50 py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Transparence totale
            </span>
            <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Questions Fréquentes</h2>
            <p className="mt-3 text-sm text-slate-400">
              Tout ce que vous devez savoir sur la période d’essai, les paiements et le fonctionnement multi-activités.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {[
              {
                q: "Combien de temps dure l’essai gratuit ?",
                a: "L’essai gratuit est de 30 jours complets pour l’ensemble des 6 activités. Vous avez un accès total à l’application pour tester avec votre équipe sur le terrain, sans engagement et sans carte bancaire requise.",
              },
              {
                q: "Comment fonctionne la réduction de 25 % sur le paiement annuel ?",
                a: "En choisissant la formule annuelle, vous bénéficiez immédiatement de 25 % de remise automatique sur le montant total des 12 mois, ce qui équivaut à 3 mois gratuits offerts par DebitMaster.",
              },
              {
                q: "Qu’est-ce que l’Option Spéciale (+50 %) ?",
                a: "L’option spéciale permet d’activer des modules étendus pour les établissements polyvalents. Pour l'activité Bar et restaurant, elle active notamment la gestion complète de la cuisine KDS, les services de gym/fitness, le lavage auto/moto, les chambres d'auberge et la distribution de tickets Wi-Fi.",
              },
              {
                q: "Comment s’effectue le règlement de l’abonnement ?",
                a: "Les abonnements sont réglés en direct par MTN Mobile Money (MoMo). L'argent est prélevé via une notification sécurisée sur votre téléphone avec saisie de votre code secret personnel, avec confirmation instantanée par notre serveur.",
              },
              {
                q: "Puis-je changer d’activité ou passer à l’option spéciale plus tard ?",
                a: "Oui, à tout moment depuis votre espace abonnement dans le tableau de bord, vous pouvez faire évoluer votre formule ou changer de période de facturation.",
              },
            ].map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between text-left font-bold text-white"
                >
                  <span className="text-base">{item.q}</span>
                  <span className="text-amber-400">{openFaq === idx ? "−" : "+"}</span>
                </button>
                {openFaq === idx && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#05090c] py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-amber-400 font-black">
              D
            </div>
            <span className="font-bold text-white">DebitMaster Pro</span>
            <span className="text-xs text-slate-500">© 2026 DebitMaster SaaS. Tous droits réservés.</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-semibold text-slate-400">
            <Link href="/" className="hover:text-white">Accueil</Link>
            <Link href="/connexion" className="hover:text-white">Connexion</Link>
            <Link href="/inscription" className="hover:text-white">Créer mon espace</Link>
            <Link href="/affiliation" className="hover:text-white">Programme Affiliés</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
