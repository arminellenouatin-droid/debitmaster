"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

type CommerceCompany = { id: string; name: string; activityType: string; country?: string; currency?: string };
type Store = { id: string; name: string; store_type: string; address: string | null; city: string | null; status: string; created_at: string };
type Role = { id: string; role_key: string; name: string; description: string | null; is_system: boolean; permissionKeys?: string[] };
type Employee = { id: string; first_name: string; last_name: string; phone: string; status: string; must_change_password: boolean; created_at: string; roles?: Array<{ id: string; role_key: string; name: string }>; stores?: Array<{ id: string; name: string }> };
type Permission = { key: string; label: string; group: string };
type AuditEvent = { id: string; actor_user_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string };
type DashboardData = { company: CommerceCompany; isOwner: boolean; roleNames: string[]; permissions: string[]; accessMode: "ACTIVE" | "GRACE" | "READ_ONLY" | "BLOCKED"; subscription: { status: string; plan: string | null; trialEndsAt: string | null; expiresAt: string | null; cutoff: string | null }; stores: Store[]; employees: Employee[]; roles: Role[]; auditEvents: AuditEvent[]; metrics: { storeCount: number; activeEmployeeCount: number; roleCount: number } };
type Feedback = { error: string; message: string };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
export function CommerceDashboardClient({ tenantId, isOwner, initialPermissions, firstName }: { tenantId: string; isOwner: boolean; initialPermissions: string[]; firstName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [permissionsCatalog, setPermissionsCatalog] = useState<Permission[]>([]);
  const [employeeDetails, setEmployeeDetails] = useState<Employee[]>([]);
  const [feedback, setFeedback] = useState<Feedback>({ error: "", message: "" });
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("RETAIL");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordVisible, setTemporaryPasswordVisible] = useState(false);
  const [employeeRoles, setEmployeeRoles] = useState<string[]>([]);
  const [employeeStores, setEmployeeStores] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>(isOwner ? "ADMINISTRATEUR" : "VENDEUR");
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const activePermissions = data?.permissions ?? initialPermissions;
  const can = (permission: string) => isOwner || activePermissions.includes(permission);
  const canEdit = data?.accessMode === "ACTIVE";

  async function loadProfileDashboard(prof: string) {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/commerce/dashboards/profile?tenantId=${encodeURIComponent(tenantId)}&profile=${encodeURIComponent(prof)}`);
      if (res.ok) {
        const json = await res.json();
        setProfileData(json);
      }
    } catch {
      // Ignore
    } finally {
      setProfileLoading(false);
    }
  }

  async function load() {
    setPending(true); setFeedback({ error: "", message: "" });
    try {
      const tenantQuery = `tenantId=${encodeURIComponent(tenantId)}`;
      const dashboardResponse = await fetch(`/api/commerce/overview?${tenantQuery}`, { cache: "no-store" });
      const dashboardResult = await dashboardResponse.json() as DashboardData & { error?: string };
      if (!dashboardResponse.ok) throw new Error(dashboardResult.error ?? "Impossible de charger le tableau Commerce.");
      setData(dashboardResult);
      const extraTasks: Promise<void>[] = [];
      if (can("team.view")) {
        extraTasks.push((async () => { const response = await fetch(`/api/commerce/roles?${tenantQuery}`, { cache: "no-store" }); const result = await response.json() as { roles?: Role[]; permissionCatalog?: Permission[] }; if (response.ok) { setPermissionsCatalog(result.permissionCatalog ?? []); setData((current) => current ? { ...current, roles: result.roles ?? [] } : current); } })());
        extraTasks.push((async () => { const response = await fetch(`/api/commerce/employees?${tenantQuery}`, { cache: "no-store" }); const result = await response.json() as { employees?: Employee[] }; if (response.ok) setEmployeeDetails(result.employees ?? []); })());
      }
      await Promise.all(extraTasks);
      void loadProfileDashboard(selectedProfile);
    } catch (cause) {
      setFeedback({ error: cause instanceof Error ? cause.message : "Impossible de charger le tableau Commerce.", message: "" });
    } finally { setPending(false); }
  }
  useEffect(() => { void load(); }, [tenantId]);
  useEffect(() => { if (tenantId) void loadProfileDashboard(selectedProfile); }, [tenantId, selectedProfile]);
  useLiveRefresh(() => { void load(); void loadProfileDashboard(selectedProfile); });

  async function submitStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback({ error: "", message: "" });
    try {
      const response = await fetch("/api/commerce/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, name: storeName, storeType, address: storeAddress, city: storeCity }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de créer le magasin.");
      setStoreName(""); setStoreAddress(""); setStoreCity(""); setFeedback({ error: "", message: "Magasin créé et journalisé." }); await load();
    } catch (cause) { setFeedback({ error: cause instanceof Error ? cause.message : "Création impossible.", message: "" }); } finally { setSaving(false); }
  }

  async function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback({ error: "", message: "" });
    try {
      const response = await fetch("/api/commerce/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, name: roleName, permissionKeys: rolePermissions }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de créer le rôle.");
      setRoleName(""); setRolePermissions([]); setFeedback({ error: "", message: "Rôle personnalisé créé et journalisé." }); await load();
    } catch (cause) { setFeedback({ error: cause instanceof Error ? cause.message : "Création impossible.", message: "" }); } finally { setSaving(false); }
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback({ error: "", message: "" });
    try {
      const response = await fetch("/api/commerce/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, firstName: first, lastName: last, phone, password: temporaryPassword, roleIds: employeeRoles, storeIds: employeeStores }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de créer le compte.");
      setFirst(""); setLast(""); setPhone(""); setTemporaryPassword(""); setTemporaryPasswordVisible(false); setEmployeeRoles([]); setEmployeeStores([]);
      setFeedback({ error: "", message: "Compte Commerce créé. Transmettez le mot de passe temporaire au membre par un canal privé; il devra le modifier à sa première connexion." }); await load();
    } catch (cause) { setFeedback({ error: cause instanceof Error ? cause.message : "Création impossible.", message: "" }); } finally { setSaving(false); }
  }

  async function toggleEmployee(employee: Employee) {
    const status = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setSaving(true); setFeedback({ error: "", message: "" });
    try {
      const response = await fetch("/api/commerce/employees", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, employeeId: employee.id, status }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier le compte.");
      setFeedback({ error: "", message: status === "ACTIVE" ? "Compte réactivé." : "Accès Commerce désactivé." }); await load();
    } catch (cause) { setFeedback({ error: cause instanceof Error ? cause.message : "Modification impossible.", message: "" }); } finally { setSaving(false); }
  }

  const groupedPermissions = useMemo(() => permissionsCatalog.reduce<Record<string, Permission[]>>((groups, permission) => { (groups[permission.group] ??= []).push(permission); return groups; }, {}), [permissionsCatalog]);
  const expiryLabel = useMemo(() => {
    const cutoff = data?.subscription.cutoff;
    if (!cutoff) return "À activer";
    const value = new Date(cutoff);
    return Number.isNaN(value.getTime()) ? "À vérifier" : dateOnly.format(value);
  }, [data]);

  if (pending && !data) return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-sm font-bold text-[var(--muted)]">Chargement de l’espace Boutique &amp; Commerce…</div>;
  if (!data) return <section className="rounded-2xl border border-red-200 bg-red-50 p-6"><p role="alert" className="font-bold text-red-800">{feedback.error || "Impossible de charger cet établissement Commerce."}</p><button type="button" onClick={() => void load()} className="mt-4 min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-black text-white">Réessayer</button></section>;

  return <div className="space-y-7">
    {feedback.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{feedback.error}</p>}
    {feedback.message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{feedback.message}</p>}

    <section id="commerce-home" className="scroll-mt-24 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#063327] via-[#07553e] to-[#0b7658] p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Espace autonome · Achat et vente</p><h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">{data.company.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">Un espace dédié aux commerces physiques : gestion des magasins, des comptes de l’équipe et des permissions. Les opérations bar, restaurant, hôtel et nuit restent dans leurs espaces respectifs.</p></div>
        <div className="flex flex-col gap-3 sm:min-w-64 sm:items-end">
          {isOwner && <Link href="/creationboutique" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-black text-slate-950">+ Ajouter un établissement</Link>}
          <p className="text-right text-xs font-semibold text-white/65">{firstName} · {data.roleNames.join(", ")}</p>
        </div>
      </div>
    </section>

    <section aria-label="Indicateurs de configuration" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Magasins accessibles", data.metrics.storeCount.toLocaleString("fr-FR"), "Espaces de vente ou entrepôts"], ["Comptes actifs", data.metrics.activeEmployeeCount.toLocaleString("fr-FR"), "Membres de l’équipe Commerce"], ["Rôles actifs", data.metrics.roleCount.toLocaleString("fr-FR"), "Rôles et permissions Commerce"], ["Échéance actuelle", expiryLabel, `${data.subscription.plan ?? "Essai gratuit"} · ${data.accessMode === "ACTIVE" ? "accès actif" : data.accessMode === "GRACE" ? "période de grâce" : "lecture seule"}`]].map(([label, value, detail]) => <article key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="mt-3 truncate text-xl font-black text-[var(--primary)]" title={value}>{value}</p><p className="mt-2 text-xs font-semibold text-[var(--muted)]">{detail}</p></article>)}
    </section>
    {/* PROFILE COCKPITS (Sprint 11) */}
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-[var(--line)] pb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Cockpits Opérationnels par Métier</span>
          <h2 className="text-xl font-black text-[var(--primary)]">Vue Métier &amp; Raccourcis Profil</h2>
        </div>

        {/* Profile Switcher Pills */}
        <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-1 text-xs font-black">
          {[
            { id: "ADMINISTRATEUR", label: "👑 Direction", desc: "Promoteur / Gérant" },
            { id: "VENDEUR", label: "💼 Vendeur", desc: "Commercial" },
            { id: "CAISSIER", label: "💵 Caissier", desc: "Caisse & Règlements" },
            { id: "MAGASINIER", label: "📦 Magasinier", desc: "Livraisons & Stock" },
            { id: "APPROVISIONNEMENT", label: "🛒 Appro", desc: "Achats" },
            { id: "INVENTAIRE", label: "📋 Inventaire", desc: "Comptages" },
            { id: "COMPTABLE", label: "📑 Comptable", desc: "SYSCOHADA" },
          ].map((prof) => (
            <button
              key={prof.id}
              type="button"
              onClick={() => setSelectedProfile(prof.id)}
              className={`rounded-xl px-3 py-1.5 transition ${
                selectedProfile === prof.id
                  ? "bg-[var(--primary)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--primary)]"
              }`}
            >
              {prof.label}
            </button>
          ))}
        </div>
      </div>

      {profileLoading && !profileData ? (
        <div className="py-8 text-center text-xs font-bold text-[var(--muted)]">
          Chargement des indicateurs métier…
        </div>
      ) : profileData ? (
        <div className="space-y-6">
          {/* 1. DIRECTION (PROPRIETAIRE / GERANT) */}
          {selectedProfile === "ADMINISTRATEUR" && profileData.executive && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">CA Réalisé Aujourd’hui</span>
                  <p className="mt-1 text-xl font-black text-[var(--primary)]">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(profileData.executive.todayRevenue)}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-bold">Ventes réglées du jour</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">CA Réalisé du Mois</span>
                  <p className="mt-1 text-xl font-black text-[var(--primary)]">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(profileData.executive.monthRevenue)}
                  </p>
                  <span className="text-[10px] text-[var(--muted)] font-bold">Cumul mensuel</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Trésorerie Active Disponible</span>
                  <p className="mt-1 text-xl font-black text-emerald-600">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(profileData.executive.treasury.total)}
                  </p>
                  <span className="text-[10px] text-[var(--muted)] font-medium">
                    Caisses: {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(profileData.executive.treasury.cash)} · MoMo: {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(profileData.executive.treasury.mobileMoney)}
                  </span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Validations en Attente</span>
                  <p className="mt-1 text-xl font-black text-amber-600">
                    {profileData.executive.pendingApprovals.total} alertes
                  </p>
                  <span className="text-[10px] text-[var(--muted)] font-bold">
                    Dépenses &gt; 100k : {profileData.executive.pendingApprovals.expenses} · Achats : {profileData.executive.pendingApprovals.purchaseOrders}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/sales" className="rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)]">
                  + Devis &amp; Ventes
                </Link>
                <Link href="/dashboard/finance" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  🏦 Trésorerie &amp; Dépenses
                </Link>
                <Link href="/dashboard/comptabilite" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  📑 Comptabilité SYSCOHADA
                </Link>
                <Link href="/dashboard/rapports" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  📊 Rapports &amp; KPI
                </Link>
                <Link href="/dashboard/personnel" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  👥 Personnel &amp; Commissions
                </Link>
              </div>
            </div>
          )}

          {/* 2. VENDEUR */}
          {selectedProfile === "VENDEUR" && profileData.vendeur && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Mes Ventes Aujourd’hui</span>
                  <p className="mt-1 text-xl font-black text-[var(--primary)]">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(profileData.vendeur.todaySales)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Mon Chiffre du Mois</span>
                  <p className="mt-1 text-xl font-black text-[var(--primary)]">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(profileData.vendeur.monthSales)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-black">
                    <span>Objectif : {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(profileData.vendeur.targetRevenue)} F</span>
                    <span>{profileData.vendeur.achievementPercent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, profileData.vendeur.achievementPercent)}%` }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Commission Estimée</span>
                  <p className="mt-1 text-xl font-black text-amber-600">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(profileData.vendeur.estimatedCommission)}
                  </p>
                  <span className="text-[10px] text-[var(--muted)] font-bold">{profileData.vendeur.commissionRatePercent}% sur CA</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Devis en cours</span>
                  <p className="mt-1 text-xl font-black text-indigo-600">
                    {profileData.vendeur.pendingQuotesCount} devis
                  </p>
                  <span className="text-[10px] text-[var(--muted)]">{profileData.vendeur.pendingInvoicesCount} factures à régler</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/sales" className="rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)]">
                  + Créer un Devis / Facture
                </Link>
                <Link href="/dashboard/commerce/stock" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  🔍 Vérifier Stock Disponible
                </Link>
                <Link href="/dashboard/personnel" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  ⏱ Pointer ma Présence
                </Link>
              </div>
            </div>
          )}

          {/* 3. CAISSIER */}
          {selectedProfile === "CAISSIER" && profileData.caissier && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Factures en File d’Attente</span>
                  <p className="mt-1 text-xl font-black text-amber-600">{profileData.caissier.queueCount} commande(s)</p>
                  <span className="text-[10px] text-[var(--muted)]">En attente de paiement immédiat</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Total Encaissé Aujourd’hui</span>
                  <p className="mt-1 text-xl font-black text-emerald-600">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(profileData.caissier.totalCollectedToday)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Session de Caisse Active</span>
                  <p className="mt-1 text-sm font-black text-[var(--primary)]">
                    {profileData.caissier.activeSession ? `${profileData.caissier.activeSession.session_number} (${profileData.caissier.activeSession.register_name})` : "Aucune session ouverte"}
                  </p>
                  <span className="text-[10px] text-[var(--muted)]">
                    {profileData.caissier.activeSession ? `Fond initial : ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(profileData.caissier.activeSession.opening_balance_xof)} F` : "Ouvrez une session"}
                  </span>
                </div>
              </div>

              {/* Invoices Queue Preview */}
              {profileData.caissier.pendingInvoicesQueue.length > 0 && (
                <div className="rounded-xl border border-[var(--line)] p-3">
                  <p className="text-xs font-black text-[var(--primary)] mb-2">Commandes à encaisser en caisse :</p>
                  <div className="divide-y divide-[var(--line)] text-xs">
                    {profileData.caissier.pendingInvoicesQueue.map((item: any) => (
                      <div key={item.id} className="py-2 flex justify-between items-center">
                        <div>
                          <span className="font-black">{item.order_number}</span>
                          <span className="text-[var(--muted)] ml-2">{item.server_name || "Vendeur"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-emerald-700">
                            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(item.total_amount)}
                          </span>
                          <Link href="/dashboard/cash" className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[11px] font-black text-white hover:bg-[var(--primary-dark)]">
                            Encaisser &rarr;
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/cash" className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700">
                  💵 Ouvrir l’Espace Caisse
                </Link>
                <Link href="/dashboard/cash" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  🧾 Clôture Ticket Z
                </Link>
              </div>
            </div>
          )}

          {/* 4. MAGASINIER */}
          {selectedProfile === "MAGASINIER" && profileData.magasinier && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Livraisons à Préparer (BL)</span>
                  <p className="mt-1 text-xl font-black text-amber-600">{profileData.magasinier.deliveriesCount} bon(s)</p>
                  <span className="text-[10px] text-[var(--muted)]">Commandes prêtes pour sortie</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Réceptions Attendues (BR)</span>
                  <p className="mt-1 text-xl font-black text-blue-600">{profileData.magasinier.receiptsCount} commande(s)</p>
                  <span className="text-[10px] text-[var(--muted)]">Livraisons fournisseurs</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Alertes Stock Critique</span>
                  <p className="mt-1 text-xl font-black text-red-600">{profileData.magasinier.lowStockProducts.length} référence(s)</p>
                  <span className="text-[10px] text-[var(--muted)]">Stock sous le minimum</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/deliveries" className="rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)]">
                  📦 Bons de Sortie &amp; Livraisons
                </Link>
                <Link href="/dashboard/supply" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  📥 Réceptionner des Marchandises (BR)
                </Link>
                <Link href="/dashboard/inventory" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  📋 Inventaires Physiques
                </Link>
              </div>
            </div>
          )}

          {/* 5. APPROVISIONNEMENT */}
          {selectedProfile === "APPROVISIONNEMENT" && profileData.approvisionnement && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Articles à Réapprovisionner</span>
                  <p className="mt-1 text-xl font-black text-red-600">{profileData.approvisionnement.reorderSuggestions.length} article(s)</p>
                  <span className="text-[10px] text-[var(--muted)]">Stock inférieur au seuil de commande</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Commandes d’Achat en Cours</span>
                  <p className="mt-1 text-xl font-black text-blue-600">{profileData.approvisionnement.ongoingCount} BC</p>
                  <span className="text-[10px] text-[var(--muted)]">En attente de livraison fournisseur</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/supply" className="rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)]">
                  + Créer une Demande d’Achat (DA)
                </Link>
                <Link href="/dashboard/supply" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  📑 Bons de Commande Fournisseurs (BC)
                </Link>
                <Link href="/dashboard/commerce/fournisseurs" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  🏭 Répertoire Fournisseurs
                </Link>
              </div>
            </div>
          )}

          {/* 6. INVENTAIRE */}
          {selectedProfile === "INVENTAIRE" && profileData.inventaire && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Sessions d’Inventaire Actives</span>
                  <p className="mt-1 text-xl font-black text-indigo-600">{profileData.inventaire.activeSessions.length} session(s)</p>
                  <span className="text-[10px] text-[var(--muted)]">Comptages et recomptages en cours</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">État des Régularisations</span>
                  <p className="mt-1 text-xl font-black text-slate-800">
                    {profileData.inventaire.hasOngoingSession ? "Session ouverte" : "Tous inventaires clôturés"}
                  </p>
                  <span className="text-[10px] text-[var(--muted)]">Écarts ajustés dans store_inventory</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/inventory" className="rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)]">
                  + Nouvelle Session d’Inventaire
                </Link>
                <Link href="/dashboard/inventory" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  📄 Fiches de Comptage A4
                </Link>
              </div>
            </div>
          )}

          {/* 7. COMPTABLE */}
          {selectedProfile === "COMPTABLE" && profileData.comptable && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Écritures SYSCOHADA Récentes</span>
                  <p className="mt-1 text-xl font-black text-[var(--primary)]">{profileData.comptable.recentCount} écriture(s)</p>
                  <span className="text-[10px] text-[var(--muted)]">Journaux VE, AC, BQ, CA, OD</span>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Contrôle Partie Double</span>
                  <p className="mt-1 text-xl font-black text-emerald-600">
                    {profileData.comptable.allBalanced ? "Équilibré (Débit = Crédit)" : "Écart détecté"}
                  </p>
                  <span className="text-[10px] text-[var(--muted)]">Cohérence comptable validée</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/comptabilite" className="rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-black text-white hover:bg-[var(--primary-dark)]">
                  📑 Ouvrir Comptabilité SYSCOHADA
                </Link>
                <Link href="/dashboard/comptabilite" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  ⚖️ Balance Générale &amp; Grand Livre
                </Link>
                <Link href="/dashboard/comptabilite" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                  📈 Bilan &amp; Compte de Résultat
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>

    <section id="commerce-stores" className="scroll-mt-24 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Réseau physique</p><h2 className="mt-2 text-2xl font-black">Magasins et entrepôts</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-900">{data.stores.length} espace(s)</span></div>
        <div className="mt-5 space-y-3">{data.stores.map((store) => <div key={store.id} className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--background)] p-4 sm:flex-row sm:items-center"><div><p className="font-black">{store.name}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{store.store_type === "WAREHOUSE" ? "Entrepôt" : store.store_type === "POINT_OF_SALE" ? "Point de vente" : "Magasin"}{store.city ? ` · ${store.city}` : ""}{store.address ? ` · ${store.address}` : ""}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black ${store.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>{store.status === "ACTIVE" ? "Actif" : "Inactif"}</span></div>)}{!data.stores.length && <p className="rounded-xl bg-[var(--background)] p-4 text-sm text-[var(--muted)]">Aucun magasin n’est accessible à ce profil.</p>}</div>
      </article>
      {can("stores.manage") && <form onSubmit={submitStore} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Extension du réseau</p><h3 className="mt-2 text-xl font-black">Ajouter un espace</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Nom<input required minLength={2} maxLength={120} value={storeName} onChange={(event) => setStoreName(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" placeholder="Ex. Magasin du centre" /></label><label className="text-xs font-bold">Type<select value={storeType} onChange={(event) => setStoreType(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm"><option value="RETAIL">Magasin</option><option value="WAREHOUSE">Entrepôt</option><option value="POINT_OF_SALE">Point de vente</option></select></label><label className="text-xs font-bold">Ville<input maxLength={100} value={storeCity} onChange={(event) => setStoreCity(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" /></label><label className="text-xs font-bold">Adresse<input maxLength={240} value={storeAddress} onChange={(event) => setStoreAddress(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" /></label></div><button type="submit" disabled={saving || !canEdit} className="mt-4 min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Enregistrement…" : "Créer le magasin"}</button>{!canEdit && <p className="mt-2 text-xs font-semibold text-amber-800">Modification disponible après activation/renouvellement de l’abonnement.</p>}</form>}
    </section>

    <section id="commerce-team" className="scroll-mt-24 space-y-5">
      <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Accès séparés par établissement</p><h2 className="mt-2 text-2xl font-black">Équipe et rôles Commerce</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Les comptes utilisent l’authentification DebitMaster, mais leurs rôles et magasins assignés sont enregistrés dans les tables Commerce dédiées; ils n’héritent pas des profils buvette, restaurant ou hôtel.</p></div>
      <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><h3 className="text-lg font-black">Comptes de l’équipe</h3><div className="mt-4 space-y-3">{employeeDetails.map((employee) => <div key={employee.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--background)] p-4 sm:flex-row sm:items-center"><div><p className="font-black">{employee.first_name} {employee.last_name}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{employee.phone} · {(employee.roles ?? []).map((role) => role.name).join(", ") || "Rôle non renseigné"}</p><p className="mt-1 text-xs text-[var(--muted)]">Magasins : {(employee.stores ?? []).map((store) => store.name).join(", ") || "Aucun"}{employee.must_change_password ? " · changement de mot de passe requis" : ""}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${employee.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>{employee.status === "ACTIVE" ? "Actif" : "Désactivé"}</span>{can("team.manage") && <button type="button" disabled={saving || !canEdit} onClick={() => void toggleEmployee(employee)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-black disabled:opacity-50">{employee.status === "ACTIVE" ? "Désactiver" : "Réactiver"}</button>}</div></div>)}{!employeeDetails.length && <p className="rounded-xl bg-[var(--background)] p-4 text-sm text-[var(--muted)]">Aucun compte d’équipe n’est encore créé.</p>}</div></article>

      {can("team.manage") && <form onSubmit={submitEmployee} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Compte dédié à ce tenant</p><h3 className="mt-2 text-xl font-black">Créer un compte Commerce</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs font-bold">Prénom<input required minLength={2} value={first} onChange={(event) => setFirst(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" /></label><label className="text-xs font-bold">Nom<input required minLength={2} value={last} onChange={(event) => setLast(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" /></label><label className="text-xs font-bold">Téléphone international<input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+229…" className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" /></label><div className="text-xs font-bold"><label htmlFor="commerce-temporary-password">Mot de passe temporaire</label><span className="relative mt-1 block"><input id="commerce-temporary-password" required type={temporaryPasswordVisible ? "text" : "password"} minLength={8} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 pr-24 text-sm" /><button type="button" onClick={() => setTemporaryPasswordVisible((value) => !value)} aria-label={temporaryPasswordVisible ? "Masquer le mot de passe temporaire" : "Afficher le mot de passe temporaire"} aria-pressed={temporaryPasswordVisible} className="absolute inset-y-0 right-1 my-1 rounded-md px-2 text-[10px] font-black text-emerald-900 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">{temporaryPasswordVisible ? "Masquer" : "Afficher"}</button></span><span className="mt-1 block font-normal text-[var(--muted)]">8 caractères minimum; changement requis à la première connexion.</span></div></div>
        <fieldset className="mt-4"><legend className="text-xs font-black">Rôles à attribuer</legend><div className="mt-2 flex flex-wrap gap-2">{data.roles.map((role) => <label key={role.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs font-bold"><input type="checkbox" checked={employeeRoles.includes(role.id)} onChange={(event) => setEmployeeRoles((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} />{role.name}</label>)}</div></fieldset>
        <fieldset className="mt-4"><legend className="text-xs font-black">Magasins autorisés</legend><div className="mt-2 flex flex-wrap gap-2">{data.stores.filter((store) => store.status === "ACTIVE").map((store) => <label key={store.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs font-bold"><input type="checkbox" checked={employeeStores.includes(store.id)} onChange={(event) => setEmployeeStores((current) => event.target.checked ? [...current, store.id] : current.filter((id) => id !== store.id))} />{store.name}</label>)}</div></fieldset>
        <button type="submit" disabled={saving || !canEdit || !employeeRoles.length || !employeeStores.length} className="mt-5 min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Création…" : "Créer le compte"}</button>{!canEdit && <p className="mt-2 text-xs font-semibold text-amber-800">Modification disponible après activation/renouvellement de l’abonnement.</p>}</form>}

      {isOwner && canEdit && <form onSubmit={submitRole} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Gestion des permissions</p><h3 className="mt-2 text-xl font-black">Créer un rôle personnalisé</h3><label className="mt-4 block max-w-md text-xs font-bold">Nom du rôle<input required minLength={2} maxLength={80} value={roleName} onChange={(event) => setRoleName(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm" placeholder="Ex. Responsable de rayon" /></label><div className="mt-4 grid gap-3 md:grid-cols-2">{Object.entries(groupedPermissions).map(([group, permissions]) => <details key={group} className="rounded-xl border border-[var(--line)] bg-[var(--background)] p-3" open={group === "Magasins" || group === "Équipe"}><summary className="cursor-pointer text-xs font-black">{group}</summary><div className="mt-3 space-y-2">{permissions.map((permission) => <label key={permission.key} className="flex min-h-8 items-start gap-2 text-xs font-semibold"><input type="checkbox" className="mt-0.5" checked={rolePermissions.includes(permission.key)} onChange={(event) => setRolePermissions((current) => event.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key))} /><span>{permission.label}</span></label>)}</div></details>)}</div><button type="submit" disabled={saving || !roleName.trim() || !rolePermissions.length} className="mt-4 min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-white disabled:opacity-50">{saving ? "Création…" : "Créer le rôle"}</button></form>}
      {can("team.view") && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.roles.map((role) => <article key={role.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-black">{role.name}</h3><span className="rounded-full bg-[var(--background)] px-2 py-1 text-[9px] font-black uppercase text-[var(--muted)]">{role.is_system ? "Système" : "Personnalisé"}</span></div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{role.description || `${role.permissionKeys?.length ?? 0} permission(s)`}</p></article>)}</div>}
    </section>

    {can("audit.view") && <section id="commerce-audit" className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Traçabilité</p><h2 className="mt-2 text-2xl font-black">Journal d’audit</h2><p className="mt-1 text-sm text-[var(--muted)]">Les événements sont append-only et limités à cet établissement.</p></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead><tr className="border-b border-[var(--line)] text-[var(--muted)]"><th className="py-3 pr-4 font-black">Date</th><th className="py-3 pr-4 font-black">Auteur (ID)</th><th className="py-3 pr-4 font-black">Action</th><th className="py-3 pr-4 font-black">Objet</th><th className="py-3 font-black">Détails non sensibles</th></tr></thead><tbody>{data.auditEvents.map((event) => <tr key={event.id} className="border-b border-[var(--line)]/70"><td className="py-3 pr-4 whitespace-nowrap">{dateTime.format(new Date(event.created_at))}</td><td className="py-3 pr-4 font-mono text-[10px]" title={event.actor_user_id ?? undefined}>{event.actor_user_id?.slice(0, 8) ?? "Système"}</td><td className="py-3 pr-4 font-bold">{event.action}</td><td className="py-3 pr-4">{event.entity_type}</td><td className="py-3">{Object.keys(event.metadata ?? {}).length ? JSON.stringify(event.metadata) : "—"}</td></tr>)}</tbody></table>{!data.auditEvents.length && <p className="py-5 text-sm text-[var(--muted)]">Aucun événement pour le moment.</p>}</div></section>}
    <footer className="flex flex-col justify-between gap-3 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] sm:flex-row"><span>Espace Commerce achat-vente · données isolées par établissement.</span>{isOwner && <Link href="/dashboard/subscription" className="font-black text-[var(--secondary)]">Gérer l’abonnement</Link>}</footer>
  </div>;
}
