import type { Metadata } from "next";
import { LandingClient } from "./LandingClient";

export const metadata: Metadata = {
  title: "DebitMaster Pro — Gestion & Caisse Tactile pour Bars, Restaurants et Lounges",
  description:
    "Le logiciel d'encaissement et de gestion de stocks N°1 en Afrique de l'Ouest. Prise de commande tactile sur smartphone, écran cuisine KDS, menus QR Code et encaissements MTN Mobile Money infalsifiables.",
  keywords: [
    "caisse enregistreuse bar afrique",
    "gestion restaurant cotonou abidjan lome",
    "logiciel maquis mtn momo",
    "menu qr code restaurant afrique",
    "anti coulage bar",
    "debitmaster pro",
  ],
};

export default function HomePage() {
  return <LandingClient />;
}

