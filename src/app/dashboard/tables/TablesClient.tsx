/* DebitManager / maquette plandesalle: surface claire, vert profond, ambre de signalement, actions visibles seulement si le rôle peut les exécuter. */
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

type Company = { id: string; name: string; phone?: string | null; address?: string | null };
type DiningTable = {
  id: string;
  tenant_id: string;
  label: string;
  zone: string | null;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "RESERVED";
  created_at: string;
  updated_at: string;
  public_menu_url: string | null;
};

const statusLabels = { FREE: "Libre", OCCUPIED: "Occupée", RESERVED: "Réservée" } as const;
const statusStyles = {
  FREE: "border-[var(--primary-container)] bg-[var(--accent-soft)]",
  OCCUPIED: "border-[var(--secondary-container)] bg-[#fff8e8]",
  RESERVED: "border-[#b9c3ff] bg-[#f0f2ff]",
} as const;

export function TablesClient({ canManage }: { canManage: boolean }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [label, setLabel] = useState("");
  const [zone, setZone] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [poster, setPoster] = useState<{ table: DiningTable; qrDataUrl: string } | null>(null);

  async function load(id: string) {
    const response = await fetch(`/api/tables?tenantId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Impossible de charger le plan de salle.");
    setTables(result.tables ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/companies")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger vos établissements.");
        const list = result.companies ?? [];
        if (!active) return;
        setCompanies(list);
        if (list[0]) setTenantId(list[0].id);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger vos établissements."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    setLoading(true);
    setError("");
    load(tenantId)
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Impossible de charger le plan de salle."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tenantId]);

  async function createTable(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, label, zone, capacity: Number(capacity) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de créer la table.");
      setTables((current) => [...current, result.table].sort((a, b) => a.label.localeCompare(b.label)));
      setLabel("");
      setZone("");
      setCapacity("2");
      setMessage("Table ajoutée au plan de salle.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de créer la table.");
    } finally {
      setPending(false);
    }
  }

  async function openQrPoster(table: DiningTable) {
    setError("");
    setMessage("");
    try {
      if (!table.public_menu_url) throw new Error("QR_NOT_CONFIGURED");
      const qrDataUrl = await QRCode.toDataURL(table.public_menu_url, { width: 900, margin: 3, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
      setPoster({ table, qrDataUrl });
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "QR_NOT_CONFIGURED" ? "Table affichée, mais le QR nécessite la configuration du secret serveur." : "Impossible de générer l’affiche QR de cette table.");
    }
  }

  function posterValues() {
    const company = companies.find((item) => item.id === tenantId);
    return { name: company?.name ?? "Établissement", phone: company?.phone || "Téléphone non renseigné", address: company?.address || "Adresse non renseignée" };
  }

  function printPoster() {
    if (!poster) return;
    const info = posterValues();
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
    if (!printWindow) { setError("Autorisez les fenêtres contextuelles pour imprimer l’affiche QR."); return; }
    const safe = (value: string) => value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;", "'": "&#039;" } as Record<string, string>)[char] ?? char);
    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QR - ${safe(info.name)}</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif}.poster-print{width:900px;min-height:1400px;margin:0 auto;padding:70px 65px;color:#fff;background:linear-gradient(135deg,#09261c,#06110d);border:3px solid #d9a83e;text-align:center}.poster-print h1{margin:20px 0 30px;font:700 60px Georgia,serif;text-transform:uppercase;line-height:1.05}.label{color:#d9a83e;font-size:27px;font-weight:700;letter-spacing:5px}.scan{margin:30px 0;color:#d9a83e;font-size:42px;font-weight:800}.message{font-size:27px;font-weight:700;line-height:1.35;text-transform:uppercase}.qr{width:570px;height:570px;margin:38px auto;padding:35px;background:#fff;border:5px solid #d9a83e;border-radius:35px}.qr img{width:100%;height:100%}.thanks{margin-top:40px}.thanks b{display:block;color:#d9a83e;font:italic 65px Georgia,serif}.phone{display:inline-block;margin-top:18px;padding:17px 40px;border-radius:50px;background:#d9a83e;color:#07150f;font-size:30px;font-weight:800}@media print{body{background:#fff}.poster-print{margin:0;width:100%;min-height:100vh;box-shadow:none}}</style></head><body><main class="poster-print"><div style="font-size:70px;color:#d9a83e">✦</div><div class="label">RESTAURANT</div><h1>${safe(info.name)}</h1><div style="color:#d9a83e;font-size:24px">◆ ───────── ◆</div><div class="scan">SCANNEZ LE QR CODE</div><div class="message">ET COMMANDEZ DIRECTEMENT<br>CE QUE VOUS VOULEZ</div><div class="qr"><img src="${poster.qrDataUrl}" alt="QR de ${safe(poster.table.label)}"></div><div style="font-size:25px;font-weight:700">TABLE ${safe(poster.table.label)} · ${safe(poster.table.zone || "Zone non renseignée")}</div><div class="thanks"><b>Merci</b><div style="font-size:25px;font-weight:700;letter-spacing:2px">POUR VOTRE CONFIANCE</div><div class="phone">☎ ${safe(info.phone)}</div><div style="margin-top:14px;font-size:18px">${safe(info.address)}</div></div></main><script>window.onload=()=>window.print();</script></body></html>`);
    printWindow.document.close();
  }

  async function downloadPoster() {
    if (!poster) return;
    const info = posterValues();
    const canvas = document.createElement("canvas"); canvas.width = 1800; canvas.height = 2800;
    const context = canvas.getContext("2d"); if (!context) return;
    const gradient = context.createLinearGradient(0, 0, 1800, 2800); gradient.addColorStop(0, "#09261c"); gradient.addColorStop(1, "#06110d"); context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#d9a83e"; context.lineWidth = 12; context.strokeRect(25, 25, 1750, 2750);
    context.textAlign = "center"; context.fillStyle = "#d9a83e"; context.font = "bold 54px Arial"; context.fillText("RESTAURANT", 900, 210); context.fillStyle = "#ffffff"; context.font = "bold 116px Georgia"; context.fillText(info.name.toUpperCase().slice(0, 22), 900, 350); context.fillStyle = "#d9a83e"; context.font = "bold 82px Arial"; context.fillText("SCANNEZ LE QR CODE", 900, 520); context.fillStyle = "#ffffff"; context.font = "bold 48px Arial"; context.fillText("ET COMMANDEZ DIRECTEMENT", 900, 610); context.fillText("CE QUE VOUS VOULEZ", 900, 675);
    const qrImage = new Image(); qrImage.onload = () => { context.fillStyle = "#fff"; context.fillRect(260, 760, 1280, 1280); context.drawImage(qrImage, 330, 830, 1140, 1140); context.fillStyle = "#fff"; context.font = "bold 48px Arial"; context.fillText(`TABLE ${poster.table.label} · ${poster.table.zone || "Zone non renseignée"}`, 900, 2170); context.fillStyle = "#d9a83e"; context.font = "italic 120px Georgia"; context.fillText("Merci", 900, 2350); context.fillStyle = "#fff"; context.font = "bold 42px Arial"; context.fillText(`☎ ${info.phone}`.slice(0, 34), 900, 2460); context.font = "34px Arial"; context.fillText(info.address.slice(0, 52), 900, 2530); canvas.toBlob((blob) => { if (!blob) return; const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `affiche-qr-${poster.table.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`; link.click(); URL.revokeObjectURL(link.href); }, "image/png"); }; qrImage.src = poster.qrDataUrl;
  }

  async function updateStatus(tableId: string, status: DiningTable["status"]) {
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, tableId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier la table.");
      setTables((current) => current.map((table) => (table.id === tableId ? result.table : table)));
      setMessage("Statut de la table mis à jour.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier la table.");
    }
  }

  const counts = {
    FREE: tables.filter((table) => table.status === "FREE").length,
    OCCUPIED: tables.filter((table) => table.status === "OCCUPIED").length,
    RESERVED: tables.filter((table) => table.status === "RESERVED").length,
  };

  return (
    <section>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Tables</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">Plan de salle</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Organisez les tables de l’établissement et gardez leur état visible par toute l’équipe autorisée.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {companies.length > 1 && (
            <select
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              className="h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--primary)]"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          )}
          <Link href="/dashboard/orders" className="inline-flex h-11 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-black text-white">
            Nouvelle commande
          </Link>
        </div>
      </div>

      {(error || message) && (
        <p role={error ? "alert" : "status"} className={`mt-6 rounded-lg px-4 py-3 text-sm font-bold ${error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"}`}>
          {error || message}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--primary)] p-5 text-white">
          <p className="text-xs font-bold text-white/60">Tables suivies</p>
          <p className="mt-3 text-3xl font-black">{tables.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-xs font-bold text-[var(--muted)]">Libres</p>
          <p className="mt-3 text-3xl font-black text-[var(--primary)]">{counts.FREE}</p>
        </div>
        <div className="rounded-xl border-2 border-[var(--secondary-container)] bg-[#fff8e8] p-5">
          <p className="text-xs font-bold text-[var(--muted)]">Actives / réservées</p>
          <p className="mt-3 text-3xl font-black text-[var(--primary)]">{counts.OCCUPIED + counts.RESERVED}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_350px]">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Disposition</p>
              <h2 className="mt-2 text-xl font-black text-[var(--primary)]">Tables de l’établissement</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--muted)]">
              <span>Libre {counts.FREE}</span>
              <span>Occupée {counts.OCCUPIED}</span>
              <span>Réservée {counts.RESERVED}</span>
            </div>
          </div>

          {loading ? (
            <p className="py-14 text-center text-sm font-bold text-[var(--muted)]">Chargement du plan…</p>
          ) : tables.length ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((table) => (
                <article key={table.id} className={`rounded-xl border-2 p-5 ${statusStyles[table.status]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-sm font-black text-[var(--primary)]">⌂</span>
                    <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--primary)]">{statusLabels[table.status]}</span>
                  </div>
                  <p className="mt-6 text-lg font-black text-[var(--primary)]">{table.label}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--muted)]">{table.zone || "Zone non renseignée"} · {table.capacity} place(s)</p>
                  {canManage ? (
                    <select
                      value={table.status}
                      onChange={(event) => updateStatus(table.id, event.target.value as DiningTable["status"])}
                      className="mt-5 h-10 w-full rounded-lg border border-black/10 bg-white/70 px-3 text-xs font-black text-[var(--primary)]"
                    >
                      <option value="FREE">Libre</option>
                      <option value="OCCUPIED">Occupée</option>
                      <option value="RESERVED">Réservée</option>
                    </select>
                  ) : (
                    <p className="mt-5 rounded-lg bg-white/55 px-3 py-2 text-xs font-bold text-[var(--muted)]">Consultation seule</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link href={`/dashboard/orders?table=${encodeURIComponent(table.label)}`} className="inline-flex text-xs font-black text-[var(--primary)]">
                      Prendre une commande →
                    </Link>
                    {canManage && <button type="button" onClick={() => void openQrPoster(table)} className="inline-flex text-xs font-black text-[var(--primary)] underline underline-offset-4">Télécharger le QR</button>}
                    {table.public_menu_url && <a href={table.public_menu_url} target="_blank" rel="noreferrer" className="inline-flex text-xs font-bold text-[var(--muted)]">Ouvrir le menu</a>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xl text-[var(--primary)]">⌂</div>
              <h3 className="mt-5 font-black text-[var(--primary)]">Aucune table configurée</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Ajoutez la première table de cet établissement pour commencer à organiser le service.</p>
            </div>
          )}
        </div>

        {canManage ? (
          <form onSubmit={createTable} className="h-fit rounded-xl bg-[var(--primary)] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Configuration</p>
            <h2 className="mt-2 text-xl font-black">Ajouter une table</h2>
            <label className="mt-7 block text-sm font-bold text-white/80">
              Libellé
              <input required value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex. Table 01" className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--secondary-container)]" />
            </label>
            <label className="mt-4 block text-sm font-bold text-white/80">
              Zone
              <input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Ex. Terrasse" className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--secondary-container)]" />
            </label>
            <label className="mt-4 block text-sm font-bold text-white/80">
              Capacité
              <input required min="1" max="100" type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white outline-none focus:border-[var(--secondary-container)]" />
            </label>
            <button disabled={pending || !tenantId} className="mt-6 h-11 w-full rounded-lg bg-[var(--secondary-container)] text-sm font-black text-[var(--primary)] disabled:opacity-45">
              {pending ? "Ajout…" : "Ajouter au plan"}
            </button>
            <p className="mt-4 text-xs leading-5 text-white/50">La permission tables.manage est vérifiée côté serveur et l’action n’est affichée qu’aux rôles autorisés.</p>
          </form>
        ) : (
          <aside className="h-fit rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Accès en lecture</p>
            <h2 className="mt-2 text-xl font-black text-[var(--primary)]">Plan consultable</h2>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Votre rôle peut suivre l’occupation des tables, mais la création et la modification sont réservées aux responsables habilités.</p>
          </aside>
        )}
      </div>
      {poster && (() => { const info = posterValues(); return <div className="qr-poster-overlay" role="presentation" onClick={() => setPoster(null)}><div className="qr-poster-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-poster-title" onClick={(event) => event.stopPropagation()}><div className="qr-poster-preview"><div className="qr-poster-decoration qr-poster-decoration-one">♨</div><div className="qr-poster-decoration qr-poster-decoration-two">✦</div><div className="qr-poster-content"><div className="qr-poster-logo">✦</div><p className="qr-poster-label">RESTAURANT</p><h2 id="qr-poster-title">{info.name}</h2><div className="qr-poster-separator">◆ ───────── ◆</div><p className="qr-poster-scan">SCANNEZ LE QR CODE</p><p className="qr-poster-message">ET COMMANDEZ DIRECTEMENT<br />CE QUE VOUS VOULEZ</p><div className="qr-poster-qr"><img src={poster.qrDataUrl} alt={`QR de ${poster.table.label}`} /></div><p className="qr-poster-table">TABLE {poster.table.label} · {poster.table.zone || "Zone non renseignée"}</p><p className="qr-poster-thanks">Merci</p><p className="qr-poster-confidence">POUR VOTRE CONFIANCE</p><p className="qr-poster-phone">☎ {info.phone}</p><p className="qr-poster-address">{info.address}</p></div></div><div className="qr-poster-actions"><button type="button" onClick={printPoster} className="qr-poster-action qr-poster-primary">Imprimer</button><button type="button" onClick={() => void downloadPoster()} className="qr-poster-action">Télécharger</button><button type="button" onClick={() => void openQrPoster(poster.table)} className="qr-poster-action">Régénérer</button><button type="button" onClick={() => setPoster(null)} className="qr-poster-close">Fermer</button></div></div></div>; })()}
    </section>
  );
}
