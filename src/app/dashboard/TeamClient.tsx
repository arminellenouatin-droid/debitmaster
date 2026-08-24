"use client";

// DebitManager staff UI: équipe par tenant, états vides explicites, rôles contrôlés par l’API.
import { FormEvent, useEffect, useState } from "react";

type Company = { id: string; name: string };
type Employee = { id: string; first_name: string; last_name: string; position: string; status: string };

const labels: Record<string, string> = {
  SERVEUR: "Serveur", SUPERVISEUR: "Superviseur", MAGASINIER: "Magasinier", GERANT: "Gérant", BARMAN: "Barman", SECRETAIRE: "Secrétaire", COMPTABLE: "Comptable", APPROVISIONNEMENT: "Approvisionnement", CUISINIER: "Cuisinier", CHEF_CUISINE: "Chef cuisine", ADMINISTRATEUR: "Administrateur",
};

export function TeamClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("SERVEUR");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadStaff(id: string) {
    if (!id) return setEmployees([]);
    const response = await fetch(`/api/employees?tenantId=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (response.ok) setEmployees(data.employees ?? []); else setError(data.error ?? "Impossible de charger l’équipe.");
  }

  useEffect(() => { fetch("/api/companies").then((response) => response.json()).then((data) => { const next = data.companies ?? []; setCompanies(next); setTenantId(next[0]?.id ?? ""); }); }, []);
  useEffect(() => { loadStaff(tenantId); }, [tenantId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSaving(true);
    const response = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, firstName, lastName, position }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.error ?? "Impossible d’ajouter l’employé.");
    setEmployees((current) => [data.employee, ...current]); setFirstName(""); setLastName("");
  }

  return <section className="mt-6 rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm md:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-sans text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Organisation</p><h2 className="mt-2 font-serif text-3xl tracking-tight">Votre équipe</h2><p className="mt-2 max-w-xl font-sans text-sm leading-6 text-[var(--muted)]">Préparez les membres de l’établissement et leur rôle. La création de comptes de connexion et les permissions détaillées arrivent dans le prochain lot.</p></div>{companies.length > 0 && <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-sans text-sm font-bold">{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>}</div><form onSubmit={submit} className="mt-7 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"><label className="font-sans text-xs font-bold text-[var(--muted)]">Prénom<input required minLength={2} value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-3 text-sm text-[var(--ink)]" /></label><label className="font-sans text-xs font-bold text-[var(--muted)]">Nom<input required minLength={2} value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-3 text-sm text-[var(--ink)]" /></label><label className="font-sans text-xs font-bold text-[var(--muted)]">Rôle<select value={position} onChange={(event) => setPosition(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-3 text-sm text-[var(--ink)]">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button disabled={saving || !tenantId} className="rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Ajout…" : "Ajouter"}</button></form>{error && <p role="alert" className="mt-4 rounded-xl bg-[var(--accent-soft)] px-4 py-3 font-sans text-sm font-bold text-[var(--accent)]">{error}</p>}<div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{employees.map((employee) => <div key={employee.id} className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"><div className="flex items-start justify-between gap-2"><p className="font-sans font-black">{employee.first_name} {employee.last_name}</p><span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 font-sans text-[0.62rem] font-black uppercase text-[var(--accent)]">{employee.status}</span></div><p className="mt-2 font-sans text-sm text-[var(--muted)]">{labels[employee.position] ?? employee.position}</p></div>)}{companies.length === 0 && <p className="font-sans text-sm text-[var(--muted)]">Créez d’abord votre établissement pour ajouter votre équipe.</p>}{companies.length > 0 && employees.length === 0 && <p className="font-sans text-sm text-[var(--muted)]">Aucun membre enregistré pour cet établissement.</p>}</div></section>;
}
