"use client";

import { useEffect, useState } from "react";

type Company = { id: string; name: string; activity_type: string };
const activityNames: Record<string, string> = {
  BUVETTE: "Buvette",
  BAR_RESTAURANT: "Bar restaurant",
  HOTEL_AUBERGE: "Hôtel / auberge",
  NIGHTCLUB_LOUNGE: "Boîte de nuit / lounge",
  BOUTIQUE_COMMERCE: "Boutique & Commerce",
};

export function CommerceCompanySwitcher({ tenantId }: { tenantId: string }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/companies", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { companies?: Company[] } : { companies: [] })
      .then((result) => { if (active) setCompanies(result.companies ?? []); })
      .catch(() => { if (active) setCompanies([]); });
    return () => { active = false; };
  }, []);

  async function changeTenant(nextTenantId: string) {
    if (!nextTenantId || nextTenantId === tenantId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/companies/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: nextTenantId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de changer d’établissement.");
      window.location.assign("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de changer d’établissement.");
      setBusy(false);
    }
  }

  if (companies.length < 2) return null;
  return <label className="min-w-0 text-[10px] font-bold text-[var(--muted)] sm:text-xs">
    <span className="sr-only">Changer d’établissement</span>
    <select aria-label="Changer d’établissement" value={tenantId} disabled={busy} onChange={(event) => void changeTenant(event.target.value)} className="min-h-10 max-w-56 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-bold text-[var(--primary)] disabled:opacity-60 sm:max-w-72">
      {companies.map((company) => <option key={company.id} value={company.id}>{company.name} · {activityNames[company.activity_type] ?? company.activity_type}</option>)}
    </select>
    {error && <span role="alert" className="sr-only">{error}</span>}
  </label>;
}
