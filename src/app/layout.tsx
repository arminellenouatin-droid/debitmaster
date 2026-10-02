// DebitManager product UI: modernisme éditorial africain fonctionnel, surfaces lumineuses, décisions lisibles.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DebitMaster | Pilotage de votre établissement",
  description: "Système de caisse, facturation, stocks, approvisionnement et comptabilité SYSCOHADA.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DebitMaster",
  },
};

export const viewport = {
  themeColor: "#063327",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
