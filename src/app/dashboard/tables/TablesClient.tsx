/* DebitManager / maquette plandesalle: surface claire, vert profond, ambre de signalement, actions visibles seulement si le rôle peut les exécuter. */
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";

type Company = { id: string; name: string };
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

type QrPoster = {
  companyName: string;
  table: Pick<DiningTable, "label" | "zone">;
  qrDataUrl: string;
};

const htmlEscapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => htmlEscapes[character] ?? character);
}

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
  const [poster, setPoster] = useState<QrPoster | null>(null);
  const posterDialogRef = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    const dialog = posterDialogRef.current;
    if (!dialog) return;
    if (poster && !dialog.open) dialog.showModal();
    else if (!poster && dialog.open) dialog.close();
  }, [poster]);

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
      const qrDataUrl = await QRCode.toDataURL(table.public_menu_url, { width: 900, margin: 3, errorCorrectionLevel: "M", color: { dark: "#07150f", light: "#fffdf7" } });
      setPoster({
        companyName: companies.find((company) => company.id === table.tenant_id)?.name ?? "Établissement",
        table: { label: table.label, zone: table.zone },
        qrDataUrl,
      });
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "QR_NOT_CONFIGURED" ? "Le QR n’est pas disponible pour cette table." : "Impossible d’afficher l’affiche QR de cette table.");
    }
  }

  function printPoster() {
    if (!poster) return;
    const printWindow = window.open("", "_blank", "popup,width=900,height=1200");
    if (!printWindow) {
      setError("Autorisez les fenêtres contextuelles pour imprimer l’affiche QR.");
      return;
    }
    const companyName = escapeHtml(poster.companyName);
    const tableLabel = escapeHtml(poster.table.label);
    const zone = `ZONE ${escapeHtml(poster.table.zone?.trim() || "Zone non renseignée")}`;
    const imageAlt = escapeHtml(`QR de ${poster.companyName}, table ${poster.table.label}, zone ${poster.table.zone || "Zone non renseignée"}`);
    printWindow.opener = null;
    printWindow.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Affiche QR - ${companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 7mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; min-height: 100%; background: #fff; font-family: Arial, sans-serif; }
    .poster { width: 196mm; min-height: 283mm; margin: 0 auto; padding: 12mm 10mm; border: 3px solid #d9a83e; color: #fff; background: linear-gradient(145deg, #09261c, #06110d); display: flex; flex-direction: column; align-items: center; justify-content: space-around; text-align: center; }
    .mark { color: #d9a83e; font-size: 26pt; }
    .eyebrow { margin: 0; color: #d9a83e; font-size: 13pt; font-weight: 800; letter-spacing: 4pt; }
    .poster h1 { max-width: 100%; margin: 4mm 0; color: #fff; font: 700 32pt/1.08 Georgia, serif; text-transform: uppercase; overflow-wrap: anywhere; }
    .scan { margin: 2mm 0; color: #d9a83e; font-size: 23pt; font-weight: 900; }
    .message { margin: 0; color: #fff; font-size: 14pt; font-weight: 800; line-height: 1.35; text-transform: uppercase; }
    .qr { width: 125mm; aspect-ratio: 1; margin: 7mm auto; padding: 7mm; border: 3px solid #d9a83e; border-radius: 8mm; background: #fff; }
    .qr img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .table { margin: 0; color: #fff; font-size: 19pt; font-weight: 900; text-transform: uppercase; }
    .zone { margin: 2mm 0 0; color: #e7c77d; font-size: 15pt; font-weight: 700; }
    @media print { html, body { height: 100%; } .poster { width: 100%; min-height: 283mm; margin: 0; break-inside: avoid; } }
  </style>
</head>
<body>
  <main class="poster">
    <div class="mark" aria-hidden="true">✦</div>
    <p class="eyebrow">COMMANDE DIRECTE</p>
    <h1>${companyName}</h1>
    <p class="scan">SCANNEZ LE QR CODE</p>
    <p class="message">ET COMMANDEZ DIRECTEMENT<br>CE QUE VOUS VOULEZ</p>
    <div class="qr"><img src="${escapeHtml(poster.qrDataUrl)}" alt="${imageAlt}"></div>
    <p class="table">TABLE ${tableLabel}</p>
    <p class="zone">${zone}</p>
  </main>
</body>
</html>`);
    printWindow.document.close();
    window.setTimeout(() => {
      if (printWindow.closed) return;
      printWindow.focus();
      printWindow.print();
    }, 250);
  }

  async function downloadPoster() {
    if (!poster) return;
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = 2546;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponible.");
      const gradient = context.createLinearGradient(0, 0, 1800, 2546);
      gradient.addColorStop(0, "#09261c");
      gradient.addColorStop(1, "#06110d");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "#d9a83e";
      context.lineWidth = 12;
      context.strokeRect(25, 25, 1750, 2496);
      context.textAlign = "center";
      context.fillStyle = "#d9a83e";
      context.font = "800 50px Arial";
      context.fillText("COMMANDE DIRECTE", 900, 185, 1600);
      context.fillStyle = "#ffffff";
      context.font = "700 100px Georgia";
      context.fillText(poster.companyName.toLocaleUpperCase("fr-FR"), 900, 350, 1560);
      context.fillStyle = "#d9a83e";
      context.font = "900 76px Arial";
      context.fillText("SCANNEZ LE QR CODE", 900, 530, 1600);
      context.fillStyle = "#ffffff";
      context.font = "700 43px Arial";
      context.fillText("ET COMMANDEZ DIRECTEMENT", 900, 615, 1600);
      context.fillText("CE QUE VOUS VOULEZ", 900, 680, 1600);
      const qrImage = new window.Image();
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = () => reject(new Error("QR image indisponible."));
        qrImage.src = poster.qrDataUrl;
      });
      context.fillStyle = "#fff";
      context.fillRect(250, 760, 1300, 1300);
      context.strokeStyle = "#d9a83e";
      context.lineWidth = 12;
      context.strokeRect(250, 760, 1300, 1300);
      context.drawImage(qrImage, 310, 820, 1180, 1180);
      context.fillStyle = "#ffffff";
      context.font = "900 54px Arial";
      context.fillText(`TABLE ${poster.table.label.toLocaleUpperCase("fr-FR")}`, 900, 2170, 1600);
      context.fillStyle = "#e7c77d";
      context.font = "700 42px Arial";
      context.fillText(`ZONE ${(poster.table.zone?.trim() || "Zone non renseignée").toLocaleUpperCase("fr-FR")}`, 900, 2260, 1600);
      context.fillStyle = "#d9a83e";
      context.font = "italic 86px Georgia";
      context.fillText("Merci", 900, 2400, 1500);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image non générée.")), "image/png");
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = poster.table.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "table";
      link.href = objectUrl;
      link.download = `affiche-qr-${slug}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage(`Affiche QR de la table ${poster.table.label} téléchargée.`);
    } catch {
      setError("Impossible de télécharger l’affiche QR.");
    }
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
                    {canManage && <button type="button" onClick={() => void openQrPoster(table)} aria-label={`Afficher l’affiche QR de ${table.label}`} className="inline-flex text-xs font-black text-[var(--primary)] underline underline-offset-4">Affiche QR</button>}
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
      {poster && (
        <dialog ref={posterDialogRef} className="qr-poster-dialog" aria-labelledby="qr-poster-title" onClose={() => setPoster(null)} onClick={(event) => { if (event.target === event.currentTarget) setPoster(null); }}>
          <div className="qr-poster-preview">
            <span className="qr-poster-decoration qr-poster-decoration-one" aria-hidden="true">✦</span>
            <span className="qr-poster-decoration qr-poster-decoration-two" aria-hidden="true">✦</span>
            <div className="qr-poster-content">
              <div className="qr-poster-logo" aria-hidden="true">✦</div>
              <p className="qr-poster-label">COMMANDE DIRECTE</p>
              <h2 id="qr-poster-title">{poster.companyName}</h2>
              <div className="qr-poster-separator" aria-hidden="true">◆ ───────── ◆</div>
              <p className="qr-poster-scan">SCANNEZ LE QR CODE</p>
              <p className="qr-poster-message">ET COMMANDEZ DIRECTEMENT<br />CE QUE VOUS VOULEZ</p>
              <div className="qr-poster-qr">
                <Image src={poster.qrDataUrl} alt={`QR de ${poster.companyName}, table ${poster.table.label}, zone ${poster.table.zone || "Zone non renseignée"}`} width={900} height={900} unoptimized />
              </div>
              <p className="qr-poster-table">TABLE {poster.table.label}</p>
              <p className="qr-poster-zone">ZONE {poster.table.zone?.trim() || "Zone non renseignée"}</p>
              <p className="qr-poster-thanks">Merci</p>
            </div>
          </div>
          <div className="qr-poster-actions">
            <button type="button" autoFocus onClick={printPoster} className="qr-poster-action qr-poster-primary">Imprimer</button>
            <button type="button" onClick={() => void downloadPoster()} className="qr-poster-action">Télécharger l’affiche</button>
            <button type="button" onClick={() => setPoster(null)} className="qr-poster-close">Fermer</button>
          </div>
        </dialog>
      )}
    </section>
  );
}
