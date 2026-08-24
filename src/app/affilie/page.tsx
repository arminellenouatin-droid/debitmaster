// Design Read: espace affilié responsive et autonome, centré sur le lien, les établissements attribués et le solde disponible.
import { redirect } from "next/navigation";
import { AffiliateClient } from "./AffiliateClient";
import { getAuthorizationContext } from "@/lib/authorization";

export default async function AffiliatePage() {
  const context = await getAuthorizationContext();
  if (!context.affiliateId) redirect("/connexion");
  const firstName = typeof context.user?.user_metadata?.first_name === "string" ? context.user.user_metadata.first_name : "";
  return <AffiliateClient firstName={firstName} />;
}
