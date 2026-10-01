"use client";

import { useEffect, useState } from "react";

type Store = { id: string; name: string };
type Role = { id: string; role_key: string; name: string };
type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  roles?: Role[];
  stores?: Store[];
};

type Attendance = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string;
  check_out_time: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE" | "EXCUSED";
  minutes_late: number;
  notes: string | null;
  commerce_employees?: { id: string; first_name: string; last_name: string; phone: string };
};

type CommissionSummary = {
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  periodMonth: string;
  achievedRevenueXof: number;
  targetRevenueXof: number;
  achievementRatePercent: number;
  commissionRatePercent: number;
  commissionType: "REVENUE_PERCENT" | "MARGIN_PERCENT" | "FIXED_BONUS";
  commissionAmountXof: number;
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
};

const formatFCFA = (val: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(val);

export function CommercePersonnelClient({ tenantId, isOwner }: { tenantId: string; isOwner: boolean }) {
  const [activeTab, setActiveTab] = useState<"TEAM" | "ATTENDANCE" | "COMMISSIONS">("COMMISSIONS");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ error: "", message: "" });

  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Attendance state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [clockInEmployeeId, setClockInEmployeeId] = useState("");
  const [clockInStatus, setClockInStatus] = useState<"PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE">("PRESENT");
  const [minutesLate, setMinutesLate] = useState(0);

  // Commissions state
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [commissionSummaries, setCommissionSummaries] = useState<CommissionSummary[]>([]);
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [targetRevenue, setTargetRevenue] = useState(1000000);
  const [commissionRate, setCommissionRate] = useState(5.0);
  const [commissionType, setCommissionType] = useState<"REVENUE_PERCENT" | "MARGIN_PERCENT" | "FIXED_BONUS">("REVENUE_PERCENT");
  const [fixedBonus, setFixedBonus] = useState(50000);

  // Load team
  async function loadTeam() {
    try {
      const [empRes, storeRes, roleRes] = await Promise.all([
        fetch(`/api/commerce/employees?tenantId=${encodeURIComponent(tenantId)}`),
        fetch(`/api/commerce/stores?tenantId=${encodeURIComponent(tenantId)}`),
        fetch(`/api/commerce/roles?tenantId=${encodeURIComponent(tenantId)}`),
      ]);
      if (empRes.ok) {
        const d = await empRes.json();
        setEmployees(d.employees ?? []);
      }
      if (storeRes.ok) {
        const d = await storeRes.json();
        setStores(d.stores ?? []);
      }
      if (roleRes.ok) {
        const d = await roleRes.json();
        setRoles(d.roles ?? []);
      }
    } catch {
      // Ignore
    }
  }

  // Load attendances
  async function loadAttendance() {
    setLoading(true);
    try {
      const res = await fetch(`/api/commerce/personnel/attendance?tenantId=${encodeURIComponent(tenantId)}&date=${selectedDate}`);
      if (res.ok) {
        const d = await res.json();
        setAttendances(d.attendances ?? []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  // Load commissions
  async function loadCommissions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/commerce/personnel/commissions?tenantId=${encodeURIComponent(tenantId)}&month=${selectedMonth}`);
      if (res.ok) {
        const d = await res.json();
        setCommissionSummaries(d.summaries ?? []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    void loadTeam();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    if (activeTab === "ATTENDANCE") void loadAttendance();
    if (activeTab === "COMMISSIONS") void loadCommissions();
  }, [tenantId, activeTab, selectedDate, selectedMonth]);

  // Handle Clock-in / Pointage
  async function handleRecordAttendance(action: "CHECK_IN" | "CHECK_OUT", empId?: string) {
    const employeeId = empId || clockInEmployeeId;
    if (!employeeId) return;
    setFeedback({ error: "", message: "" });
    try {
      const res = await fetch("/api/commerce/personnel/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          employeeId,
          workDate: selectedDate,
          action,
          status: clockInStatus,
          minutesLate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors du pointage.");
      setFeedback({ error: "", message: data.message });
      void loadAttendance();
    } catch (err) {
      setFeedback({ error: err instanceof Error ? err.message : "Erreur.", message: "" });
    }
  }

  // Handle Save Target
  async function handleSaveTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmployeeId) return;
    setFeedback({ error: "", message: "" });
    try {
      const res = await fetch("/api/commerce/personnel/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          employeeId: targetEmployeeId,
          periodMonth: selectedMonth,
          targetRevenueXof: targetRevenue,
          commissionRatePercent: commissionRate,
          commissionType,
          fixedBonusXof: fixedBonus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Impossible d'enregistrer l'objectif.");
      setFeedback({ error: "", message: data.message });
      void loadCommissions();
    } catch (err) {
      setFeedback({ error: err instanceof Error ? err.message : "Erreur.", message: "" });
    }
  }

  // Handle Commission Action (approve or pay)
  async function handleCommissionAction(comm: CommissionSummary, action: "approve" | "pay") {
    setFeedback({ error: "", message: "" });
    try {
      const res = await fetch("/api/commerce/personnel/commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          employeeId: comm.employeeId,
          periodMonth: selectedMonth,
          action,
          commissionAmountXof: comm.commissionAmountXof,
          achievedRevenueXof: comm.achievedRevenueXof,
          targetRevenueXof: comm.targetRevenueXof,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action impossible.");
      setFeedback({ error: "", message: data.message });
      void loadCommissions();
    } catch (err) {
      setFeedback({ error: err instanceof Error ? err.message : "Erreur.", message: "" });
    }
  }

  const totalTeamRevenue = commissionSummaries.reduce((acc, c) => acc + c.achievedRevenueXof, 0);
  const totalTeamCommissions = commissionSummaries.reduce((acc, c) => acc + c.commissionAmountXof, 0);
  const avgAchievement =
    commissionSummaries.length > 0
      ? Math.round(commissionSummaries.reduce((acc, c) => acc + c.achievementRatePercent, 0) / commissionSummaries.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-[var(--line)] pb-5">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[var(--secondary)]">Boutique &amp; Commerce</span>
          <h1 className="text-2xl font-black text-[var(--primary)] sm:text-3xl">Personnel &amp; Rémunération</h1>
          <p className="text-xs text-[var(--muted)]">Gestion des équipes, fiches de présence et calcul automatisé des commissions sur ventes.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("COMMISSIONS")}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              activeTab === "COMMISSIONS" ? "bg-[var(--primary)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--primary)]"
            }`}
          >
            💰 Objectifs &amp; Commissions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ATTENDANCE")}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              activeTab === "ATTENDANCE" ? "bg-[var(--primary)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--primary)]"
            }`}
          >
            ⏱ Présences &amp; Pointage
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TEAM")}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              activeTab === "TEAM" ? "bg-[var(--primary)] text-white shadow" : "text-[var(--muted)] hover:text-[var(--primary)]"
            }`}
          >
            👥 Équipe &amp; Magasins
          </button>
        </div>
      </div>

      {feedback.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800">
          {feedback.error}
        </div>
      )}
      {feedback.message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
          {feedback.message}
        </div>
      )}

      {/* TAB 1: OBJECTIFS & COMMISSIONS */}
      {activeTab === "COMMISSIONS" && (
        <div className="space-y-6">
          {/* Controls & Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-[var(--muted)]">Période :</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--primary)]"
              />
            </div>
            <span className="text-xs font-bold text-[var(--muted)]">Calcul en temps réel basé sur les factures encaissées</span>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Chiffre d’affaires équipe</span>
              <p className="mt-2 text-2xl font-black text-[var(--primary)]">{formatFCFA(totalTeamRevenue)}</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-bold">Ventes réglées du mois</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Commissions totales</span>
              <p className="mt-2 text-2xl font-black text-amber-600">{formatFCFA(totalTeamCommissions)}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">À payer aux commerciaux</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Taux d’atteinte moyen</span>
              <p className="mt-2 text-2xl font-black text-indigo-600">{avgAchievement}%</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Progression globale sur quotas</p>
            </div>
          </div>

          {/* Form to configure sales target */}
          {isOwner && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h3 className="text-sm font-black text-[var(--primary)] mb-3">⚙️ Définir un objectif de vente</h3>
              <form onSubmit={handleSaveTarget} className="grid grid-cols-1 gap-3 sm:grid-cols-5 items-end">
                <div>
                  <label className="text-[11px] font-bold text-[var(--muted)]">Commercial</label>
                  <select
                    value={targetEmployeeId}
                    onChange={(e) => setTargetEmployeeId(e.target.value)}
                    required
                    className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-black text-[var(--primary)]"
                  >
                    <option value="">Sélectionner un collaborateur...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--muted)]">Objectif CA (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={targetRevenue}
                    onChange={(e) => setTargetRevenue(Number(e.target.value))}
                    required
                    className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-black text-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--muted)]">Taux Commission (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    required
                    className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-black text-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--muted)]">Règle</label>
                  <select
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value as any)}
                    className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-black text-[var(--primary)]"
                  >
                    <option value="REVENUE_PERCENT">% sur CA réalisé</option>
                    <option value="MARGIN_PERCENT">% sur Marge brute</option>
                    <option value="FIXED_BONUS">Prime fixe si objectif atteint</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-[var(--primary)] px-4 text-xs font-black text-white hover:bg-[var(--primary-dark)]"
                >
                  Enregistrer l’objectif
                </button>
              </form>
            </div>
          )}

          {/* Table of performance & commissions */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--surface-muted)]/50">
              <h3 className="text-sm font-black text-[var(--primary)]">Suivi des performances et commissions ({selectedMonth})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surface-muted)]/20 text-[var(--muted)] font-black uppercase text-[10px]">
                    <th className="p-3.5">Commercial</th>
                    <th className="p-3.5">Objectif Quota</th>
                    <th className="p-3.5">CA Réalisé</th>
                    <th className="p-3.5">% Progression</th>
                    <th className="p-3.5">Règle appliquée</th>
                    <th className="p-3.5">Commission</th>
                    <th className="p-3.5">Statut</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {commissionSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-[var(--muted)]">
                        Aucun commercial actif trouvé pour cette période.
                      </td>
                    </tr>
                  ) : (
                    commissionSummaries.map((comm) => (
                      <tr key={comm.employeeId} className="hover:bg-[var(--accent-soft)]/20 transition">
                        <td className="p-3.5">
                          <p className="font-black text-[var(--primary)]">{comm.firstName} {comm.lastName}</p>
                          <span className="text-[10px] text-[var(--muted)]">{comm.phone}</span>
                        </td>
                        <td className="p-3.5 font-bold text-[var(--muted)]">{formatFCFA(comm.targetRevenueXof)}</td>
                        <td className="p-3.5 font-black text-[var(--primary)]">{formatFCFA(comm.achievedRevenueXof)}</td>
                        <td className="p-3.5">
                          <div className="w-28">
                            <div className="flex justify-between text-[10px] font-black mb-1">
                              <span>{comm.achievementRatePercent}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  comm.achievementRatePercent >= 100
                                    ? "bg-emerald-500"
                                    : comm.achievementRatePercent >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-400"
                                }`}
                                style={{ width: `${Math.min(100, comm.achievementRatePercent)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-[11px] text-[var(--muted)]">
                          {comm.commissionType === "REVENUE_PERCENT" ? `${comm.commissionRatePercent}% du CA` : comm.commissionType === "FIXED_BONUS" ? "Bonus palier" : `${comm.commissionRatePercent}% marge`}
                        </td>
                        <td className="p-3.5 font-black text-amber-600">{formatFCFA(comm.commissionAmountXof)}</td>
                        <td className="p-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              comm.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : comm.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {comm.status === "PAID" ? "Payée" : comm.status === "APPROVED" ? "Validée" : "En attente"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-1">
                          {comm.status === "PENDING" && isOwner && (
                            <button
                              type="button"
                              onClick={() => void handleCommissionAction(comm, "approve")}
                              className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white hover:bg-blue-700"
                            >
                              Valider
                            </button>
                          )}
                          {comm.status === "APPROVED" && isOwner && (
                            <button
                              type="button"
                              onClick={() => void handleCommissionAction(comm, "pay")}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white hover:bg-emerald-700"
                            >
                              Payer
                            </button>
                          )}
                          {comm.status === "PAID" && (
                            <span className="text-[11px] font-bold text-emerald-600">Règlement effectué ✓</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRÉSENCES & POINTAGE */}
      {activeTab === "ATTENDANCE" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-[var(--muted)]">Date de travail :</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--primary)]"
              />
            </div>

            {/* Quick Clock-in widget */}
            <div className="flex items-center gap-2">
              <select
                value={clockInEmployeeId}
                onChange={(e) => setClockInEmployeeId(e.target.value)}
                className="h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--primary)]"
              >
                <option value="">Pointer un membre...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
              <select
                value={clockInStatus}
                onChange={(e) => setClockInStatus(e.target.value as any)}
                className="h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--primary)]"
              >
                <option value="PRESENT">À l’heure</option>
                <option value="LATE">En retard</option>
                <option value="ABSENT">Absent</option>
                <option value="ON_LEAVE">Congé / Repos</option>
              </select>
              {clockInStatus === "LATE" && (
                <input
                  type="number"
                  placeholder="Min. retard"
                  value={minutesLate || ""}
                  onChange={(e) => setMinutesLate(Number(e.target.value))}
                  className="h-10 w-24 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-bold"
                />
              )}
              <button
                type="button"
                onClick={() => void handleRecordAttendance("CHECK_IN")}
                className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700"
              >
                Arrivée (In)
              </button>
            </div>
          </div>

          {/* Attendances Table */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--line)] bg-[var(--surface-muted)]/50">
              <h3 className="text-sm font-black text-[var(--primary)]">Pointages du {new Date(selectedDate).toLocaleDateString("fr-FR", { dateStyle: "long" })}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surface-muted)]/20 text-[var(--muted)] font-black uppercase text-[10px]">
                    <th className="p-3.5">Collaborateur</th>
                    <th className="p-3.5">Statut</th>
                    <th className="p-3.5">Arrivée</th>
                    <th className="p-3.5">Départ</th>
                    <th className="p-3.5">Retard (min)</th>
                    <th className="p-3.5">Notes</th>
                    <th className="p-3.5 text-right">Action sortie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {attendances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-[var(--muted)]">
                        Aucun pointage enregistré pour cette date.
                      </td>
                    </tr>
                  ) : (
                    attendances.map((att) => (
                      <tr key={att.id} className="hover:bg-[var(--accent-soft)]/20 transition">
                        <td className="p-3.5 font-black text-[var(--primary)]">
                          {att.commerce_employees ? `${att.commerce_employees.first_name} ${att.commerce_employees.last_name}` : "Collaborateur"}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              att.status === "PRESENT"
                                ? "bg-emerald-100 text-emerald-800"
                                : att.status === "LATE"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-[var(--primary)]">
                          {new Date(att.check_in_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3.5 font-bold text-[var(--muted)]">
                          {att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="p-3.5 font-bold text-amber-700">{att.minutes_late > 0 ? `${att.minutes_late} min` : "0"}</td>
                        <td className="p-3.5 text-xs text-[var(--muted)]">{att.notes || "—"}</td>
                        <td className="p-3.5 text-right">
                          {!att.check_out_time ? (
                            <button
                              type="button"
                              onClick={() => void handleRecordAttendance("CHECK_OUT", att.employee_id)}
                              className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[11px] font-black text-white hover:bg-[var(--primary-dark)]"
                            >
                              Pointer Départ
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">Clôturé</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ÉQUIPE & MAGASINS */}
      {activeTab === "TEAM" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
            <h3 className="text-sm font-black text-[var(--primary)] mb-4">Équipe commerciale et opérationnelle ({employees.length})</h3>
            <div className="divide-y divide-[var(--line)]">
              {employees.map((emp) => (
                <div key={emp.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-sm text-[var(--primary)]">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-[var(--muted)]">{emp.phone} · Statut : <span className="font-bold text-emerald-600">{emp.status}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
                      {emp.roles?.map((r) => r.name).join(", ") || "Rôle standard"}
                    </span>
                    <span className="rounded-xl bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
                      {emp.stores?.map((s) => s.name).join(", ") || "Tous magasins"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
