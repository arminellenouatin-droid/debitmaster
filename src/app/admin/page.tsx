// Design Read: entrée de back-office master, même système visuel que l’application boutique, mais sans contexte d’établissement.
import { redirect } from "next/navigation";
import { AdminClient } from "./AdminClient";
import { getAuthorizationContext } from "@/lib/authorization";

export default async function AdminPage() {
  const context = await getAuthorizationContext();
  if (!context.isPlatformAdmin) redirect("/connexion");
  const firstName = typeof context.user?.user_metadata?.first_name === "string" ? context.user.user_metadata.first_name : "";
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 lg:px-10"><AdminClient firstName={firstName} /></main>;
}
