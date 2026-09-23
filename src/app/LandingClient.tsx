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
} from "@/components/Icons";

type RolePreview = "server" | "kitchen" | "manager" | "qrmenu";

export function LandingClient() {
  const [activeTab, setActiveTab] = useState<RolePreview>("server");
  const [currencyPeriod, setCurrencyPeriod] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#070d10] text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Top Banner Notice */}
      <div className="relative z-50 border-b border-amber-500/20 bg-gradient-to-r from-emerald-950 via-emerald-900 to-amber-950 px-4 py-2.5 text-center text-xs font-semibold text-amber-200">
        <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300">
          <Sparkles className="h-3 w-3" /> NOUVEAU
        </span>
        Intégration MTN Mobile Money native & Menus QR interactifs pour bars et restaurants.{" "}
        <Link href="/inscription" className="ml-1 inline-flex items-center underline hover:text-white">
          Essai 14 jours sans engagement <ChevronRight className="h-3 w-3" />
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
            <a href="#tarifs" className="transition hover:text-amber-400">
              Tarifs & Formules
            </a>
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
              Formules claires & transparentes
            </span>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              Choisissez la formule adaptée à votre taille
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Tous les forfaits incluent 14 jours d’essai gratuit, l’accès illimité aux serveurs et le support local 7j/7.
            </p>

            <div className="mt-8 inline-flex items-center rounded-xl bg-slate-900 p-1.5 ring-1 ring-slate-800">
              <button
                type="button"
                onClick={() => setCurrencyPeriod("monthly")}
                className={`rounded-lg px-4 py-2 text-xs font-black transition ${
                  currencyPeriod === "monthly" ? "bg-emerald-600 text-white shadow" : "text-slate-400"
                }`}
              >
                Paiement Mensuel
              </button>
              <button
                type="button"
                onClick={() => setCurrencyPeriod("yearly")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black transition ${
                  currencyPeriod === "yearly" ? "bg-emerald-600 text-white shadow" : "text-slate-400"
                }`}
              >
                <span>Paiement Annuel</span>
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-300">-20%</span>
              </button>
            </div>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {/* Plan 1: Essentiel */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
              <div>
                <span className="text-xs font-bold uppercase text-slate-400">Maquis & Petits Bars</span>
                <h3 className="mt-2 text-2xl font-black text-white">Formule Starter</h3>
                <p className="mt-3 text-sm text-slate-400">
                  Idéal pour démarrer avec la commande mobile et le contrôle des boissons.
                </p>
                <div className="mt-6">
                  <span className="text-4xl font-black text-white">
                    {currencyPeriod === "yearly" ? "24 000" : "30 000"}
                  </span>{" "}
                  <span className="text-sm font-semibold text-slate-400">XOF / mois</span>
                </div>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Jusqu’à 5 serveuses connectées
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Gestion des stocks de boissons
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Caisse et encaissements espèces
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Support WhatsApp standard
                  </li>
                </ul>
              </div>
              <Link
                href="/inscription"
                className="mt-8 block rounded-xl border border-slate-700 bg-slate-800 py-3 text-center text-sm font-black text-white hover:bg-slate-700"
              >
                Démarrer en Starter
              </Link>
            </div>

            {/* Plan 2: Bar Restaurant (Recommended) */}
            <div className="relative flex flex-col justify-between rounded-3xl border-2 border-amber-500/80 bg-gradient-to-b from-slate-900 via-slate-900 to-[#0c1815] p-8 shadow-2xl shadow-emerald-950/60">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                Le plus populaire
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-amber-400">Bars, Lounges & Restaurants</span>
                <h3 className="mt-2 text-2xl font-black text-white">Bar Restaurant Pro</h3>
                <p className="mt-3 text-sm text-slate-400">
                  Pour synchroniser salle, bar et cuisine avec le KDS et les paiements MTN MoMo.
                </p>
                <div className="mt-6">
                  <span className="text-4xl font-black text-amber-400">
                    {currencyPeriod === "yearly" ? "48 000" : "60 000"}
                  </span>{" "}
                  <span className="text-sm font-semibold text-slate-400">XOF / mois</span>
                </div>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Serveuses et serveurs illimités
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Écran KDS Cuisine en temps réel
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Menus QR Code à table avec commande
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Paiements MTN Mobile Money directs
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Point de caisse et réconciliation
                  </li>
                </ul>
              </div>
              <Link
                href="/inscription"
                className="mt-8 block rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3.5 text-center text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300"
              >
                Choisir Bar Restaurant Pro
              </Link>
            </div>

            {/* Plan 3: Formule Power Multi-Services */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
              <div>
                <span className="text-xs font-bold uppercase text-slate-400">Complexes & Hôtels</span>
                <h3 className="mt-2 text-2xl font-black text-white">Formule Power</h3>
                <p className="mt-3 text-sm text-slate-400">
                  Pour les établissements complets : Restaurant, Auberge/Hôtel, Lavage, Gym & Wi-Fi.
                </p>
                <div className="mt-6">
                  <span className="text-4xl font-black text-white">
                    {currencyPeriod === "yearly" ? "120 000" : "150 000"}
                  </span>{" "}
                  <span className="text-sm font-semibold text-slate-400">XOF / mois</span>
                </div>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Tous les modules Bar & Restaurant
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Module Auberge & Chambres (passe / nuit)
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Module Lavage Auto & Moto
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Module Gym, Fitness & Wi-Fi tickets
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /> Gestionnaire de compte dédié 24/7
                  </li>
                </ul>
              </div>
              <Link
                href="/inscription"
                className="mt-8 block rounded-xl border border-slate-700 bg-slate-800 py-3 text-center text-sm font-black text-white hover:bg-slate-700"
              >
                Passer en Formule Power
              </Link>
            </div>
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
                a: "Oui, vous bénéficiez de 14 jours d’essai entièrement gratuits et sans engagement pour tester avec votre équipe dans votre propre établissement.",
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
