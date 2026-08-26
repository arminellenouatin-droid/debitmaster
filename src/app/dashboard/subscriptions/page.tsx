// DebitManager Power subscriptions route: available to service operators and authorized managers.
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getActiveTenantContext } from "@/lib/active-tenant";
import { ServiceSupportClient } from "../ServiceSupportClient";
export default async function SubscriptionsPage() { const context = await getActiveTenantContext(); if (!context.user) redirect("/connexion"); if (!context.tenantId || context.company?.activity_type !== "POWER") redirect("/dashboard"); return <DashboardShell firstName={context.user.user_metadata?.first_name ?? "équipe"}><ServiceSupportClient tenantId={context.tenantId} kind="subscriptions" /></DashboardShell>; }
