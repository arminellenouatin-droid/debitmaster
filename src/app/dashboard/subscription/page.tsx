// DebitManager subscription area: the SaaS status and plan management are intentionally separate from operational dashboards.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { SubscriptionPlans } from "./SubscriptionPlans";
import { getCommerceContext } from "@/lib/commerce-auth";
import { CommerceDashboardShell } from "@/components/CommerceDashboardShell";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const activeContext = await getActiveTenantContext();
  const isOwner = Boolean(activeContext.tenantId && activeContext.employeeId === null && activeContext.role === "ADMINISTRATEUR");
  if (!activeContext.user) redirect("/connexion");
  if (!isOwner || !activeContext.tenantId) redirect("/dashboard");
  if (activeContext.company?.activity_type === "BOUTIQUE_COMMERCE") {
    const commerce = await getCommerceContext(activeContext.tenantId);
    if (!commerce.company || !commerce.isOwner) redirect("/dashboard");
    const firstName = activeContext.user.user_metadata?.first_name ?? "promoteur";
    return <CommerceDashboardShell firstName={firstName} companyName={commerce.company.name} tenantId={commerce.tenantId ?? activeContext.tenantId} role="Promoteur / Propriétaire" isOwner accessMode={commerce.accessMode} permissions={[...commerce.permissions]}><div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Gestion SaaS · Commerce achat-vente</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">Abonnement de {commerce.company.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Cette formule s’applique uniquement à cet établissement. Chaque autre établissement du propriétaire conserve son propre abonnement.</p></div><SubscriptionPlans tenantId={commerce.tenantId ?? activeContext.tenantId} /></CommerceDashboardShell>;
  }
  return <DashboardShell firstName={activeContext.user.user_metadata?.first_name ?? "gérant"}><div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Gestion SaaS</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--primary)]">Votre abonnement DebitManager</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Cette page est séparée de la gestion de votre établissement. Elle permet uniquement de consulter le statut de votre accès au SaaS et de choisir une formule.</p></div><SubscriptionPlans tenantId={activeContext.tenantId} /></DashboardShell>;
}
