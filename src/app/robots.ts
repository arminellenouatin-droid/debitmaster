import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/menu/", "/connexion", "/inscription", "/affiliation"],
        disallow: ["/dashboard/", "/admin/", "/api/", "/creationboutique/", "/choixprofil/"],
      },
    ],
    sitemap: "https://debitmaster.vercel.app/sitemap.xml",
  };
}
