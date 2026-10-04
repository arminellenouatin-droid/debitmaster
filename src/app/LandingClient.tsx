"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  QrCode,
  UtensilsCrossed,
  Wine,
  Users,
  Wallet,
  Clock,
  ChevronRight,
  Sparkles,
  BarChart3,
  Check,
  Building2,
  HelpCircle,
  Play,
  Scissors,
  ShoppingBag,
} from "@/components/Icons";

type RolePreview = "server" | "kitchen" | "manager" | "qrmenu";

export function LandingClient() {
  const [activeTab, setActiveTab] = useState<RolePreview>("server");
  const [currencyPeriod, setCurrencyPeriod] = useState<"monthly" | "yearly">("monthly");
  const [planLevel, setPlanLevel] = useState<"normal" | "special">("normal");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#070d10] text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Top Banner Notice */}
      <div className="relative z-50 border-b border-amber-500/20 bg-gradient-to-r from-emerald-950 via-emerald-900 to-amber-950 px-4 py-2.5 text-center text-xs font-semibold text-amber-200">
        <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300">
          <Sparkles className="h-3 w-3" /> NOUVELLE GRILLE
        </span>
        30 jours d’essai entièrement gratuits sur les 6 activités du SaaS, sans aucun engagement.{" "}
        <Link href="/inscription" className="ml-1 inline-flex items-center underline hover:text-white">
          Démarrer mon essai gratuit <ChevronRight className="h-3 w-3" />
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
              <p className="text-[10px] font-medium text-slate-400">Système de gestion & caisse Afrique</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            <a href="#fonctionnalites" className="transition hover:text-amber-400">
              Fonctionnalités
            </a>
            <a href="#metiers" className="transition hover:text-amber-400">
              Parcours Métiers
            </a>
            <a href="#menu-qr" className="transition hover:text-amber-400">
              Menu QR Code
            </a>
            <Link href="/tarifs" className="transition hover:text-amber-400">
              Tarifs & Formules
            </Link>
            <a href="#faq" className="transition hover:text-amber-400">
              FAQ
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
              <span>Créer mon espace</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        {/* Glow Effects */}
        <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-emerald-600/20 via-amber-500/10 to-transparent blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-4 py-1.5 text-xs font-bold text-emerald-300 backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
              <span>Conçu spécialement pour les bars, maquis & restaurants africains</span>
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-6xl sm:leading-[1.08]">
              Gérez mieux. <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">Éliminez le coulage.</span> Servez avec rapidité.
            </h1>

            <Link
              href="/connexion"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-400/10 px-6 py-3 text-sm font-black text-amber-300 transition hover:border-amber-300 hover:bg-amber-400/20 sm:hidden"
            >
              Se connecter
            </Link>

            <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
              DebitMaster transforme n’importe quel smartphone en caisse enregistreuse tactile ultra-simple. Vos serveuses commandent au doigt, la cuisine reçoit les bons instantanément, et vos encaissements MTN MoMo sont sécurisés au centime près.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/inscription"
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-7 py-4 text-base font-black text-slate-950 shadow-xl shadow-amber-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Démarrer l’essai gratuit</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-4 text-base font-bold text-slate-200 backdrop-blur-md transition hover:border-slate-500 hover:bg-slate-800"
              >
                <Play className="h-4 w-4 text-amber-400 fill-amber-400" />
                <span>Tester la démonstration</span>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Aucun matériel cher requis</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Adapté au personnel non-technique</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>100% MTN Mobile Money</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Mockup Switcher */}
          <div id="demo" className="mt-16 rounded-3xl border border-slate-800 bg-slate-900/60 p-3 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono font-medium text-slate-400">
                  simulateur-terrain.debitmaster.app
                </span>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-950 p-1 ring-1 ring-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("server")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === "server"
                      ? "bg-emerald-700 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>1. Serveuse Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("kitchen")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === "kitchen"
                      ? "bg-emerald-700 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  <span>2. Écran Cuisine KDS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("manager")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === "manager"
                      ? "bg-emerald-700 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>3. Cockpit Gérant</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("qrmenu")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === "qrmenu"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>4. Menu QR Client</span>
                </button>
              </div>
            </div>

            {/* Display Area by Role */}
            <div className="mt-6 overflow-hidden rounded-2xl bg-[#0b1216] p-4 sm:p-8">
              {activeTab === "server" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                          Prise de commande tactile · Serveuse Ella
                        </span>
                        <h3 className="text-xl font-black text-white">Table 12 · Terrasse VIP</h3>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                        ● Service Ouvert
                      </span>
                    </div>

                    {/* Visual Product Categories & Buttons */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 transition hover:border-amber-500/50">
                        <div className="flex items-center justify-between">
                          <Wine className="h-6 w-6 text-amber-400" />
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            En stock (48)
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="font-bold text-white">Bière Béninoise</p>
                          <p className="text-xs font-semibold text-amber-400">800 XOF</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950 p-1">
                          <button className="h-8 w-8 rounded bg-slate-800 font-bold text-white hover:bg-slate-700">-</button>
                          <span className="font-black text-white">2</span>
                          <button className="h-8 w-8 rounded bg-emerald-600 font-bold text-white hover:bg-emerald-500">+</button>
                        </div>
                      </div>

                      <div className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 transition hover:border-amber-500/50">
                        <div className="flex items-center justify-between">
                          <UtensilsCrossed className="h-6 w-6 text-emerald-400" />
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            Cuisine
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="font-bold text-white">Poulet Bicyclette Braisé</p>
                          <p className="text-xs font-semibold text-amber-400">4 500 XOF</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950 p-1">
                          <button className="h-8 w-8 rounded bg-slate-800 font-bold text-white hover:bg-slate-700">-</button>
                          <span className="font-black text-white">1</span>
                          <button className="h-8 w-8 rounded bg-emerald-600 font-bold text-white hover:bg-emerald-500">+</button>
                        </div>
                      </div>

                      <div className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 transition hover:border-amber-500/50">
                        <div className="flex items-center justify-between">
                          <Wine className="h-6 w-6 text-amber-400" />
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            Frais (12)
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="font-bold text-white">Guinness Foreign Extra</p>
                          <p className="text-xs font-semibold text-amber-400">1 200 XOF</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950 p-1">
                          <button className="h-8 w-8 rounded bg-slate-800 font-bold text-white hover:bg-slate-700">-</button>
                          <span className="font-black text-white">1</span>
                          <button className="h-8 w-8 rounded bg-emerald-600 font-bold text-white hover:bg-emerald-500">+</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Quick Cart & Cash Helper */}
                  <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4">
                    <div>
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                        <span className="text-xs font-black uppercase text-slate-300">Total commande</span>
                        <span className="text-2xl font-black text-amber-400">7 300 XOF</span>
                      </div>

                      <div className="mt-4 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>2 × Bière Béninoise</span>
                          <b>1 600 XOF</b>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>1 × Poulet Braisé</span>
                          <b>4 500 XOF</b>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>1 × Guinness Foreign</span>
                          <b>1 200 XOF</b>
                        </div>
                      </div>

                      <p className="mt-4 text-[11px] font-bold uppercase text-slate-400">
                        Encaissement rapide (Touches billets)
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {["2 000", "5 000", "10 000"].map((billet) => (
                          <button
                            key={billet}
                            className="rounded-lg border border-slate-700 bg-slate-900 py-2 text-xs font-black text-white hover:border-amber-400 hover:text-amber-400"
                          >
                            {billet} F
                          </button>
                        ))}
                      </div>
                    </div>

                    <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/60 hover:from-emerald-400 hover:to-emerald-500">
                      <span>Valider & Envoyer en Cuisine</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "kitchen" && (
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                        KDS Cuisine & Bar · Bons en temps réel
                      </span>
                      <h3 className="text-xl font-black text-white">3 Commandes en cours de préparation</h3>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
                      Bip Sonore Actif
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border-2 border-amber-500/60 bg-slate-900/90 p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-black text-slate-950">
                          Table 12
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Clock className="h-3 w-3" /> Il y a 4 min
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-black text-white">1 × Poulet Bicyclette Braisé</p>
                      <p className="text-xs text-slate-400">Option : Piment à part, bien cuit</p>
                      <button className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-black text-white transition hover:bg-emerald-500">
                        MARQUER PRÊT ✓
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-black text-white">
                          Table 04
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                          <Clock className="h-3 w-3" /> Il y a 8 min
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-black text-white">2 × Brochettes de Mérou grillé</p>
                      <p className="text-xs text-slate-400">Accompagnement : Alloco</p>
                      <button className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-black text-white transition hover:bg-emerald-500">
                        MARQUER PRÊT ✓
                      </button>
                    </div>

                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-black text-white">
                          Table 07
                        </span>
                        <span className="text-xs font-bold text-emerald-400">Prêt à servir</span>
                      </div>
                      <p className="mt-3 text-sm font-black text-white">1 × Capitaine braisé entier</p>
                      <p className="text-xs text-slate-400">Serveuse prévenue par alerte</p>
                      <button className="mt-4 w-full rounded-lg bg-slate-800 py-2.5 text-xs font-bold text-slate-300">
                        Reçu par la serveuse
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "manager" && (
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                        Poste de Pilotage Gérant & Propriétaire
                      </span>
                      <h3 className="text-xl font-black text-white">Vue d’ensemble en direct · Bar Santé Plus</h3>
                    </div>
                    <span className="text-xs font-bold text-slate-400">Mis à jour il y a 2 sec</span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                      <p className="text-xs font-semibold text-slate-400">Chiffre d’Affaires du jour</p>
                      <p className="mt-2 text-2xl font-black text-amber-400">1 485 000 XOF</p>
                      <p className="mt-1 text-[11px] font-bold text-emerald-400">↑ +18% vs semaine dernière</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                      <p className="text-xs font-semibold text-slate-400">Mobile Money Reçu</p>
                      <p className="mt-2 text-2xl font-black text-white">920 000 XOF</p>
                      <p className="mt-1 text-[11px] text-slate-400">Paiements confirmés</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                      <p className="text-xs font-semibold text-slate-400">Espèces en caisses</p>
                      <p className="mt-2 text-2xl font-black text-white">565 000 XOF</p>
                      <p className="mt-1 text-[11px] text-emerald-400">0 manquant signalé</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                      <p className="text-xs font-semibold text-slate-400">Alertes de stock</p>
                      <p className="mt-2 text-2xl font-black text-amber-400">2 critiques</p>
                      <p className="mt-1 text-[11px] text-slate-400">Bière & Sucreries</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "qrmenu" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
                      <QrCode className="h-4 w-4" />
                      <span>Ce que voit votre client en scannant le QR code sur la table</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-black text-white">
                      Carte digitale gastronomique & Commande directe
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                      Vos clients n’attendent plus la serveuse pour consulter la carte ou commander un verre supplémentaire. Ils scannent le QR code posé sur leur table, parcourent vos spécialités avec photos haute définition et règlent directement via MTN Mobile Money.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Check className="h-4 w-4 text-amber-400" /> +25% de réassort spontané de boissons
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Check className="h-4 w-4 text-amber-400" /> Zéro attente d'addition
                      </span>
                    </div>
                  </div>

                  <div className="mx-auto w-full max-w-[280px] rounded-3xl border-4 border-slate-700 bg-slate-950 p-4 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[10px] font-bold text-amber-400">TABLE 12 · VIP</span>
                      <span className="text-[10px] text-slate-400">BAR SANTE PLUS</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg bg-slate-900 p-2 text-xs">
                        <p className="font-bold text-white">Cocktail Signature Baobab</p>
                        <p className="text-amber-400 font-bold">2 500 XOF</p>
                      </div>
                      <div className="rounded-lg bg-slate-900 p-2 text-xs">
                        <p className="font-bold text-white">Brochettes de Filet de Bœuf</p>
                        <p className="text-amber-400 font-bold">3 000 XOF</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 p-2.5 text-center text-xs font-black text-slate-950">
                      Commander · Payer par MTN MoMo
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid: Solutions to Real African Bar & Restaurant Problems */}
      <section id="fonctionnalites" className="border-t border-slate-800/80 bg-slate-950/60 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Pourquoi DebitMaster ?
            </span>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              Fini les pertes de caisse et le coulage de boissons
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Dans la restauration africaine, le coulage et les erreurs d’encaissement représentent en moyenne 12% à 25% du chiffre d’affaires. DebitMaster verrouille chaque étape.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-500/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Traçabilité stricte anti-coulage</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Aucune boisson ne quitte le magasin ou le bar sans commande validée. Le stock du comptoir et le stock central sont réconciliés à chaque instant.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-500/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Mobile-First pour tout le personnel</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Grands boutons tactiles, icônes parlantes et clavier de billets rapides. Même une serveuse débutante maîtrise la prise de commande en 5 minutes.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-500/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Wallet className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">Encaissement MTN MoMo infalsifiable</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                L’argent arrive directement sur votre compte marchand avec notification serveur instantanée. Zéro fausse capture d’écran de paiement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="tarifs" className="border-t border-slate-800/80 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              Tarification claire par activité
            </span>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              Une formule dédiée à votre métier
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Tous nos forfaits incluent 30 jours d’essai entièrement gratuits sans carte bancaire, l’accès illimité aux serveurs et le support local 7j/7.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {/* Plan Level Toggle */}
              <div className="inline-flex items-center rounded-xl bg-slate-900 p-1.5 ring-1 ring-slate-800">
                <button
                  type="button"
                  onClick={() => setPlanLevel("normal")}
                  className={`rounded-lg px-4 py-2 text-xs font-black transition ${
                    planLevel === "normal"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Option Simple (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => setPlanLevel("special")}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black transition ${
                    planLevel === "special"
                      ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>⭐ Option Avancée</span>
                  <span className="rounded bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                    +50% (Tout Illimité)
                  </span>
                </button>
              </div>

              {/* Billing Period Toggle */}
              <div className="inline-flex items-center rounded-xl bg-slate-900 p-1.5 ring-1 ring-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrencyPeriod("monthly")}
                  className={`rounded-lg px-4 py-2 text-xs font-black transition ${
                    currencyPeriod === "monthly" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Paiement Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyPeriod("yearly")}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black transition ${
                    currencyPeriod === "yearly" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>Paiement Annuel</span>
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-300">-25% (3 mois offerts)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                code: "BUVETTE",
                name: "Buvette",
                badge: planLevel === "special" ? "Buvette Avancée" : "Boissons & Maquis",
                baseMonthly: 30000,
                icon: <Wine className="h-6 w-6 text-amber-400" />,
                desc:
                  planLevel === "special"
                    ? "Buvette illimitée avec commande QR code sur table autonome, multi-magasins, comptabilité et trésorerie."
                    : "Pour les maquis et buvettes : 5 serveuses max, 1 seul magasin, 15 tables max, traçabilité des casiers et vente rapide.",
                normalFeatures: [
                  "Vente de boissons uniquement (anti-coulage & casiers)",
                  "Jusqu'à 5 serveuses connectées",
                  "1 seul magasin de stock de boissons",
                  "Jusqu'à 15 tables de service",
                  "Commandes serveuse -> préparation gérant -> livraison",
                  "Points journaliers serveuse au gérant en fin de journée",
                  "Stocks d'alerte et bons d'approvisionnement (visa promoteur)",
                  "Inventaires physiques & traçabilité stricte",
                ],
                specialFeatures: [
                  "Tout le pack Simple inclus",
                  "Serveuses illimitées",
                  "Tables de service illimitées",
                  "Magasins de stock illimités",
                  "Commandes autonomes par QR Code sur table par les clients",
                  "Session & module de Comptabilité générale",
                  "Session Trésorerie et Immobilisations",
                ],
              },
              {
                code: "BAR_RESTAURANT",
                name: "Bar et restaurant",
                badge: planLevel === "special" ? "Bar-Resto Avancé" : "Le plus populaire",
                baseMonthly: 50000,
                icon: <UtensilsCrossed className="h-6 w-6 text-emerald-400" />,
                isPopular: true,
                desc:
                  planLevel === "special"
                    ? "Formule complète : QR code table client direct, illimité, KDS cuisine, comptabilité, trésorerie et personnel."
                    : "Tout Buvette + vente de repas cuisinés : 6 serveuses max, 20 tables max, magasin cuisine pour ingrédients, profils Cuisinier & Chef.",
                normalFeatures: [
                  "Tout Buvette + Vente de repas & mets cuisinés",
                  "Profils Cuisinier & Chef cuisinier inclus",
                  "Magasin cuisine dédié pour gestion des ingrédients",
                  "Jusqu'à 6 serveuses connectées",
                  "Jusqu'à 20 tables de service",
                  "Commandes cuisine directes en temps réel",
                  "Encaissements MTN MoMo & espèces",
                ],
                specialFeatures: [
                  "Tout le pack Simple inclus",
                  "Commandes directes par QR Code sur table par les clients",
                  "Serveuses, tables et magasins illimités",
                  "Session Comptabilité générale & analytique",
                  "Session Trésorerie et Immobilisations",
                  "Gestion complète du personnel & présences",
                ],
              },
              {
                code: "BOUTIQUE_COMMERCE",
                name: "Boutique et commerce",
                badge: planLevel === "special" ? "Commerce + Boutique en Ligne" : "Négoce & Retail",
                baseMonthly: 50000,
                icon: <ShoppingBag className="h-6 w-6 text-amber-400" />,
                desc:
                  planLevel === "special"
                    ? "Commerce physique + Boutique en ligne vitrine de luxe connectée au stock en direct (décrémentation en temps réel)."
                    : "Magasins physiques, grossistes et détaillants : codes-barres, devis, factures, BL, sessions de caisse et Ticket Z.",
                normalFeatures: [
                  "Multi-magasins & stocks avec CMP automatique",
                  "Devis, proformas, factures & bons de livraison (BL)",
                  "Sessions de caisse, Ticket Z & règlements mixtes",
                  "Comptabilité SYSCOHADA & analyse Pareto ABC",
                  "Gestion des clients & balances âgées",
                ],
                specialFeatures: [
                  "Tout le pack Simple inclus",
                  "Boutique en ligne vitrine de luxe connectée en direct au stock",
                  "Décrémentation immédiate du stock physique lors des ventes en ligne",
                  "Design vitrine e-commerce haut de gamme et responsive",
                  "Session Comptabilité, Trésorerie et Immobilisations",
                ],
              },
              {
                code: "NIGHTCLUB_LOUNGE",
                name: "Lounge et night-club",
                badge: planLevel === "special" ? "Lounge Avancé (Formule Hôtel)" : "Vie Nocturne & VIP",
                baseMonthly: 75000,
                icon: <Sparkles className="h-6 w-6 text-purple-400" />,
                desc:
                  planLevel === "special"
                    ? "Lounge d'élite : intègre le pack Hôtel & auberge Simple (Bar-Resto + suites/salons VIP/chambres + espaces privés). "
                    : "Fonctionnalités Bar-Restaurant Simple, vente au verre et bouteille, salons VIP, chichas et cadencement de nuit.",
                normalFeatures: [
                  "Fonctionnalités complètes du Bar & restaurant Simple",
                  "Commandes ultra-rapides au verre et à la bouteille",
                  "Gestion des salons VIP et espaces réservés",
                  "Cadencement nuit intensif & alertes anti-coulage nocturne",
                  "Clôture nocturne sécurisée et anti-fraude",
                ],
                specialFeatures: [
                  "Tout le pack Hôtel & auberge Simple inclus",
                  "Gestion des suites, salons VIP & chambres de repos",
                  "Location d'espaces privés & réservations événementielles",
                  "Commandes QR code table & gestion VIP prioritaire",
                ],
              },
              {
                code: "HOTEL_AUBERGE",
                name: "Hôtel et auberge",
                badge: planLevel === "special" ? "Hôtel Avancé (Temple du Plaisir)" : "Hôtellerie & Séjours",
                baseMonthly: 80000,
                icon: <Building2 className="h-6 w-6 text-sky-400" />,
                desc:
                  planLevel === "special"
                    ? "Complexe hôtelier complet : Hôtel-Auberge Simple + Option Avancée Bar-Resto (QR code direct, illimité, compta, trésorerie, paie). "
                    : "Bar-Resto Simple + gestion des chambres (passes courts, nuitées), location d'espaces (fêtes, conférences, véhicules).",
                normalFeatures: [
                  "Tout le pack Bar & restaurant Simple inclus",
                  "Gestion des chambres : nuitées et passes selon choix",
                  "Location d’espaces : fêtes, salles de conférence, véhicules",
                  "Facturation liée hébergement & restauration",
                  "Gouvernance, ménage et suivi des occupations en direct",
                ],
                specialFeatures: [
                  "Tout le pack Hôtel et auberge Simple",
                  "Option Avancée Bar & restaurant incluse à 100%",
                  "Commandes QR Code sur table & en chambre direct client",
                  "Serveuses, chambres, salles et magasins illimités",
                  "Sessions Comptabilité, Trésorerie & Immobilisations",
                  "Gestion complète du personnel & paie",
                ],
              },
              {
                code: "ATELIER_COUTURE",
                name: "Atelier de couture",
                badge: planLevel === "special" ? "Couture + Vitrine Créateur" : "Haute Couture & Confection",
                baseMonthly: 100000,
                icon: <Scissors className="h-6 w-6 text-pink-400" />,
                desc:
                  planLevel === "special"
                    ? "Atelier complet + Boutique vitrine en ligne de haute couture connectée au stock physique en temps réel."
                    : "Gestion multi-sites atelier & boutique : fiches 15 mensurations, circuit de fabrication et paie ouvriers à la tâche.",
                normalFeatures: [
                  "Prêt-à-porter et confection sur-mesure",
                  "Fiches clients avec 15 mensurations morphologiques",
                  "Workflow d’atelier (Coupe, Couture, Broderie, QC)",
                  "Paie des ouvriers à la tâche avec majorations",
                  "Multi-sites ateliers et boutiques physiques",
                  "Stocks de tissus et fournitures avec métrages",
                ],
                specialFeatures: [
                  "Tout le pack Simple inclus",
                  "Boutique en ligne vitrine haute couture connectée au stock en direct",
                  "Catalogue créateur avec décrémentation automatique des modèles",
                  "Prise de commandes de modèles et sur-mesure en ligne",
                  "Sessions Comptabilité, Trésorerie & Immobilisations",
                ],
              },
            ].map((act) => {
              const monthlyPrice = planLevel === "special" ? Math.round(act.baseMonthly * 1.5) : act.baseMonthly;
              const yearlyMonthly = Math.round(monthlyPrice * 0.75);
              const yearlyTotal = Math.round(monthlyPrice * 12 * 0.75);

              const displayPrice = currencyPeriod === "yearly" ? yearlyMonthly : monthlyPrice;
              const formattedPrice = new Intl.NumberFormat("fr-FR").format(displayPrice);
              const formattedYearly = new Intl.NumberFormat("fr-FR").format(yearlyTotal);
              const currentFeatures = planLevel === "special" ? act.specialFeatures : act.normalFeatures;

              return (
                <div
                  key={act.code}
                  className={`relative flex flex-col justify-between rounded-3xl p-6 transition duration-200 ${
                    act.isPopular
                      ? "border-2 border-amber-500/80 bg-gradient-to-b from-slate-900 via-slate-900 to-[#0c1815] shadow-2xl shadow-emerald-950/60"
                      : "border border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  {act.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                      {act.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/50">
                        {act.icon}
                      </div>
                      {!act.isPopular && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {act.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 text-xl font-black text-white">{act.name}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400 min-h-[48px]">{act.desc}</p>

                    <div className="mt-5 rounded-xl bg-slate-950/50 p-3.5 border border-slate-800/60">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-3xl font-black ${act.isPopular ? "text-amber-400" : "text-white"}`}>
                          {formattedPrice}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">FCFA / mois</span>
                      </div>
                      {currencyPeriod === "yearly" && (
                        <p className="mt-1 text-[11px] font-medium text-emerald-400">
                          Facturé {formattedYearly} FCFA / an (-25%)
                        </p>
                      )}
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Formule {planLevel === "special" ? "Avancée (+50%)" : "Simple (Standard)"}
                      </div>
                    </div>

                    <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                      {currentFeatures.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/60">
                    <Link
                      href={`/inscription?activite=${act.code.toLowerCase()}&plan=${planLevel === "special" ? "avancee" : "simple"}`}
                      className={`block w-full rounded-xl py-3 text-center text-xs font-black transition ${
                        act.isPopular
                          ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300"
                          : "border border-slate-700 bg-slate-800/90 text-white hover:bg-slate-700"
                      }`}
                    >
                      Démarrer l’essai 30 jours ({planLevel === "special" ? "Avancée" : "Simple"})
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Special Option Discovery Callout */}
          <div className="mt-12 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900 to-emerald-950/40 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h4 className="text-lg font-bold text-white">Besoin de modules avancés ? Découvrez les Options Spéciales (+50%)</h4>
              </div>
              <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
                Repas & Cuisine KDS, Lavage auto/moto, Gym & Fitness, Auberge/Chambres, Tickets Wi-Fi et MTN MoMo Personnel : explorez les 4 combinaisons de chaque activité sur notre comparateur complet.
              </p>
            </div>
            <Link
              href="/tarifs"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition"
            >
              <span>Voir la grille complète & options</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="border-t border-slate-800/80 bg-slate-950/40 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">Vos Questions</span>
            <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Questions Fréquentes</h2>
          </div>

          <div className="mt-12 space-y-4">
            {[
              {
                q: "Mon personnel n’est pas très instruit, peuvent-ils vraiment l’utiliser ?",
                a: "Absolument. Nous avons pensé l’interface spécifiquement pour le personnel de terrain africain : de grandes cartes visuelles avec photos et icônes, des boutons géants facilement cliquables au pouce, et un clavier de caisse avec des touches directes de billets (500, 1000, 2000, 5000, 10000 FCFA). Aucune compétence informatique n’est requise.",
              },
              {
                q: "Faut-il acheter du matériel ou des caisses enregistreuses coûteuses ?",
                a: "Non ! C’est la grande force de DebitMaster. Le système fonctionne directement sur n’importe quel smartphone Android ou iPhone que vous ou vos employés possédez déjà. Une simple connexion internet suffit.",
              },
              {
                q: "Comment fonctionne le paiement MTN Mobile Money ?",
                a: "Le client ou la serveuse saisit son numéro, et le client reçoit immédiatement une invite sur son téléphone pour taper son code PIN secret. Dès que le paiement est validé, DebitMaster confirme instantanément la commande sans risque de fraude.",
              },
              {
                q: "Puis-je tester avant de m'engager ?",
                a: "Oui, vous bénéficiez de 30 jours d’essai entièrement gratuits et sans engagement pour tester avec votre équipe dans votre propre établissement.",
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
            <span className="text-xs text-slate-500">© 2026 DebitMaster. Tous droits réservés.</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-semibold text-slate-400">
            <Link href="/connexion" className="hover:text-white">Connexion</Link>
            <Link href="/inscription" className="hover:text-white">Créer mon espace</Link>
            <Link href="/affiliation" className="hover:text-white">Programme Affiliés</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
