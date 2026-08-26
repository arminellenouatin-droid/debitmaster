// Design Read: espace Power multi-activités, fond ivoire, accent vert profond, panneaux asymétriques et actions explicites sans surcharge visuelle.
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PowerOwnerSettings } from "./PowerOwnerSettings";

type Activity = { id: string; activity_code: string; name: string; is_active: boolean };
type Service = { id: string; activity_id: string; name: string; description: string | null; price_xof: number; billing_unit: string; is_active: boolean };
type Employee = { id: string; first_name: string; last_name: string; position: string; salary_amount: number | null; salary_frequency: string; phone: string | null };

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;
const activityLabels: Record<string, string> = { BEVERAGE: "Boissons", FOOD: "Repas", GYM: "Gym", LAUNDRY: "Lavage", LODGING: "Auberge", WIFI: "Wi-Fi" };
const positionLabels: Record<string, string> = { SUPERVISEUR: "Superviseur", GERANT: "Gérant", GERANT_ADJOINT: "Gérant adjoint", CAISSIER: "Caissier", SERVEUR: "Serveur", CHEF_CUISINE: "Chef cuisine", CUISINIER: "Cuisine", MAGASINIER: "Magasinier", GYM: "Équipe gym", AUBERGE: "Équipe auberge", LAVAGE: "Équipe lavage", WIFI: "Équipe Wi-Fi", SECURITE: "Sécurité" };

export function PowerClient({ tenantId, isOwner }: { tenantId: string; isOwner: boolean }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newActivity, setNewActivity] = useState({ activityCode: "GYM", name: "" });
  const [newService, setNewService] = useState({ activityId: "", name: "", priceXof: "0", billingUnit: "UNIT" });

  async function load() {
    setError("");
    try {
      const [activityResponse, serviceResponse, employeeResponse] = await Promise.all([
        fetch(`/api/power/activities?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
        fetch(`/api/power/services?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
        fetch(`/api/employees?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      ]);
      const [activityResult, serviceResult, employeeResult] = await Promise.all([activityResponse.json(), serviceResponse.json(), employeeResponse.json()]);
      if (!activityResponse.ok) throw new Error(activityResult.error ?? "Activités indisponibles.");
      if (!serviceResponse.ok) throw new Error(serviceResult.error ?? "Services indisponibles.");
      if (!employeeResponse.ok) throw new Error(employeeResult.error ?? "Personnel indisponible.");
      setActivities(activityResult.activities ?? []);
      setServices(serviceResult.services ?? []);
      setEmployees(employeeResult.employees ?? []);
      setNewService((current) => ({ ...current, activityId: current.activityId || activityResult.activities?.[0]?.id || "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chargement Power impossible."); }
  }
  useEffect(() => { void load(); }, [tenantId]);

  const activityById = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities]);

  async function createActivity(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/power/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, ...newActivity }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Création de l’activité impossible.");
      setNewActivity({ activityCode: "GYM", name: "" }); setMessage("Activité Power créée."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Création impossible."); } finally { setBusy(false); }
  }

  async function createService(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/power/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, activityId: newService.activityId, name: newService.name, priceXof: Number(newService.priceXof), billingUnit: newService.billingUnit }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Création du service impossible.");
      setNewService((current) => ({ ...current, name: "", priceXof: "0" })); setMessage("Service Power créé."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Création impossible."); } finally { setBusy(false); }
  }

  async function updateSalary(employee: Employee, salaryAmount: string, salaryFrequency: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/employees", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, employeeId: employee.id, salaryAmount: Number(salaryAmount), salaryFrequency }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Mise à jour du salaire impossible.");
      setMessage(`Salaire de ${employee.first_name} ${employee.last_name} mis à jour.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mise à jour impossible."); } finally { setBusy(false); }
  }

  return <div className="space-y-8"><PowerOwnerSettings tenantId={tenantId} isOwner={isOwner} /><header className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Formule Power · multi-activités</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">Pilotage des activités</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Gérez les six pôles de BAR SANTE PLUS, leurs prestations tarifées et les données d’équipe depuis un seul espace réservé à Power.</p></div><div className="rounded-xl bg-[var(--primary)] px-5 py-4 text-white"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Périmètre actif</p><p className="mt-1 text-lg font-black">Boissons · Repas · Gym · Lavage · Auberge · Wi-Fi</p></div></header>{(error || message) && <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-bold ${error ? "border border-red-200 bg-red-50 text-red-700" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>{error || message}</p>}<section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{activities.map((activity) => <article key={activity.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--secondary)]">{activity.activity_code}</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">{activity.name}</h2></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${activity.is_active ? "bg-[var(--accent-soft)] text-[var(--primary)]" : "bg-[var(--surface-muted)] text-[var(--muted)]"}`}>{activity.is_active ? "Active" : "Inactive"}</span></div><p className="mt-4 text-sm leading-6 text-[var(--muted)]">{services.filter((service) => service.activity_id === activity.id).length} prestation(s) configurée(s).</p></article>)}</section><section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"><form onSubmit={createActivity} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Configuration Power</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Ajouter une activité</h2><div className="mt-5 space-y-4"><label className="block text-sm font-bold text-[var(--primary)]">Pôle<select value={newActivity.activityCode} onChange={(event) => setNewActivity({ ...newActivity, activityCode: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3"><option value="BEVERAGE">Boissons</option><option value="FOOD">Repas</option><option value="GYM">Gym</option><option value="LAUNDRY">Lavage</option><option value="LODGING">Auberge</option><option value="WIFI">Wi-Fi</option></select></label><label className="block text-sm font-bold text-[var(--primary)]">Nom affiché<input required value={newActivity.name} onChange={(event) => setNewActivity({ ...newActivity, name: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3" placeholder="Ex. Gym BAR SANTE PLUS" /></label><button disabled={busy} className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-white disabled:opacity-50">Créer l’activité</button></div></form><form onSubmit={createService} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Catalogue Power</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Ajouter une prestation et son prix</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="block text-sm font-bold text-[var(--primary)] md:col-span-2">Activité<select required value={newService.activityId} onChange={(event) => setNewService({ ...newService, activityId: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3">{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label><label className="block text-sm font-bold text-[var(--primary)]">Prestation<input required value={newService.name} onChange={(event) => setNewService({ ...newService, name: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3" placeholder="Ex. Accès journée" /></label><label className="block text-sm font-bold text-[var(--primary)]">Prix XOF<input required type="number" min="0" step="1" value={newService.priceXof} onChange={(event) => setNewService({ ...newService, priceXof: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3" /></label><label className="block text-sm font-bold text-[var(--primary)] md:col-span-2">Unité de facturation<input value={newService.billingUnit} onChange={(event) => setNewService({ ...newService, billingUnit: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3" placeholder="UNIT, NIGHT, PASS…" /></label></div><button disabled={busy || !activities.length} className="mt-4 rounded-lg bg-[var(--secondary)] px-4 py-3 text-sm font-black text-white disabled:opacity-50">Ajouter la prestation</button></form></section><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--secondary)]">Équipe et rémunération</p><h2 className="mt-2 text-xl font-black text-[var(--primary)]">Personnel Power</h2></div><p className="text-sm text-[var(--muted)]">Les salaires restent visibles uniquement aux profils autorisés.</p></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.1em] text-[var(--muted)]"><tr><th className="pb-3">Membre</th><th className="pb-3">Rôle</th><th className="pb-3">Activité</th><th className="pb-3">Salaire XOF</th><th className="pb-3">Fréquence</th><th className="pb-3">Action</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id} className="border-b border-[var(--line)] last:border-0"><td className="py-4 font-black text-[var(--primary)]">{employee.first_name} {employee.last_name}<span className="block text-xs font-normal text-[var(--muted)]">{employee.phone || "—"}</span></td><td className="py-4 text-[var(--muted)]">{positionLabels[employee.position] || employee.position}</td><td className="py-4 text-[var(--muted)]">{employee.position === "GYM" ? "Gym" : employee.position === "AUBERGE" ? "Auberge" : employee.position === "LAVAGE" ? "Lavage" : employee.position === "WIFI" ? "Wi-Fi" : "—"}</td><td className="py-4"><input aria-label={`Salaire de ${employee.first_name} ${employee.last_name}`} defaultValue={employee.salary_amount ?? ""} type="number" min="0" className="h-10 w-36 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3" /></td><td className="py-4"><select defaultValue={employee.salary_frequency || "MONTHLY"} aria-label={`Fréquence de ${employee.first_name} ${employee.last_name}`} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--background)] px-3"><option value="MONTHLY">Mensuel</option><option value="WEEKLY">Hebdomadaire</option><option value="DAILY">Journalier</option></select></td><td className="py-4"><button type="button" disabled={busy} onClick={(event) => { const row = event.currentTarget.closest("tr"); const input = row?.querySelector("input") as HTMLInputElement | null; const select = row?.querySelector("select") as HTMLSelectElement | null; if (input && select) void updateSalary(employee, input.value, select.value); }} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Enregistrer</button></td></tr>)}</tbody></table></div></section><section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-xl font-black text-[var(--primary)]">Prestations configurées</h2><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{services.map((service) => <article key={service.id} className="rounded-xl border border-[var(--line)] bg-[var(--background)] p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--secondary)]">{activityById.get(service.activity_id)?.name || "Activité"}</p><h3 className="mt-2 font-black text-[var(--primary)]">{service.name}</h3><p className="mt-2 text-sm text-[var(--muted)]">{service.description || "Prestation Power"}</p><p className="mt-4 text-lg font-black text-[var(--primary)]">{money(service.price_xof)} <span className="text-xs font-bold text-[var(--muted)]">/ {service.billing_unit}</span></p></article>)}</div></section></div>;
}
