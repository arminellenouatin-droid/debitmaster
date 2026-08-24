// DebitManager product UI: modernisme éditorial africain fonctionnel, surfaces lumineuses, décisions lisibles.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DebitManager | Pilotage de votre établissement",
  description: "Commandes, stocks, équipe et trésorerie réunis dans un seul espace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
