import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DebitMaster Pro | Boutique & Commerce",
    short_name: "DebitMaster",
    description: "Système de caisse, facturation, stocks, approvisionnement et comptabilité SYSCOHADA pour commerces en Afrique de l'Ouest.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#063327",
    theme_color: "#063327",
    lang: "fr",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
