import type { Metadata } from "next";
import { TarifsClient } from "./TarifsClient";

export const metadata: Metadata = {
  title: "Tarifs & Formules d'Abonnement — DebitMaster SaaS",
  description:
    "Découvrez nos tarifs clairs et transparents pour les 6 activités : Buvette, Bar & Restaurant, Lounge, Hôtel, Boutique & Commerce, Atelier de Couture. Essai gratuit de 30 jours sans engagement, -25% en paiement annuel.",
  keywords: [
    "tarifs debitmaster",
    "prix caisse enregistreuse bar",
    "abonnement logiciel restaurant afrique",
    "prix logiciel gestion boutique",
    "tarif logiciel atelier couture",
    "essai gratuit 30 jours caisse tactile",
  ],
};

export default function TarifsPage() {
  return <TarifsClient />;
}
