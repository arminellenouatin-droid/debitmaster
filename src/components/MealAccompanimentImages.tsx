"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { mealAccompanimentNames, type MealAccompanimentName } from "@/lib/meal-accompaniments";

type AccompanimentImage = { name: MealAccompanimentName; imagePath: string | null; imageUrl: string | null };

export function MealAccompanimentImages({ tenantId }: { tenantId: string }) {
  const [images, setImages] = useState<AccompanimentImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyName, setBusyName] = useState<MealAccompanimentName | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/meal-accompaniment-images?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { images?: AccompanimentImage[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Impossible de charger les photos.");
        if (active) setImages(result.images ?? []);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Impossible de charger les photos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);

  async function savePath(name: MealAccompanimentName, imagePath: string | null) {
    const response = await fetch("/api/meal-accompaniment-images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, name, imagePath }),
    });
    const result = (await response.json()) as { imagePath?: string | null; imageUrl?: string | null; error?: string };
    if (!response.ok) throw new Error(result.error || "Impossible d’enregistrer cette photo.");
    setImages((current) => current.map((item) => item.name === name
      ? { ...item, imagePath: result.imagePath ?? null, imageUrl: result.imageUrl ?? null }
      : item));
  }

  async function upload(name: MealAccompanimentName, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setNotice("");
    if (file.size > 5 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 5 Mo.");
      return;
    }

    const body = new FormData();
    body.set("file", file);
    body.set("tenantId", tenantId);
    setBusyName(name);
    try {
      const response = await fetch("/api/uploads/image", { method: "POST", body });
      const uploaded = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !uploaded.path) throw new Error(uploaded.error || "Impossible d’envoyer la photo.");
      await savePath(name, uploaded.path);
      setNotice(`Photo de ${name} enregistrée.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer cette photo.");
    } finally {
      setBusyName(null);
    }
  }

  async function remove(name: MealAccompanimentName) {
    setError("");
    setNotice("");
    setBusyName(name);
    try {
      await savePath(name, null);
      setNotice(`Photo de ${name} retirée.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de retirer cette photo.");
    } finally {
      setBusyName(null);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--secondary)]">Menu cuisine</p>
        <h2 className="mt-1 text-xl font-black text-[var(--primary)]">Photos des accompagnements</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">Ces photos sont propres à cet établissement et apparaissent à la serveuse quand elle choisit un accompagnement avant d’ajouter un repas au panier.</p>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notice}</p>}

      {loading ? <p className="mt-5 text-sm text-[var(--muted)]">Chargement des photos…</p> : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mealAccompanimentNames.map((name) => {
            const item = images.find((image) => image.name === name);
            const busy = busyName === name;
            const inputId = `accompagnement-photo-${encodeURIComponent(name).replaceAll("%", "")}`;
            return (
              <article key={name} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
                {item?.imageUrl ? <img src={item.imageUrl} alt={`Photo de l’accompagnement ${name}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)] text-xl text-[var(--muted)]">＋</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[var(--primary)]">{name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label htmlFor={inputId} className={`inline-flex min-h-9 cursor-pointer items-center rounded-md border border-[var(--line)] px-2.5 text-[11px] font-bold text-[var(--primary)] ${busy ? "pointer-events-none opacity-50" : "hover:bg-[var(--surface-muted)]"}`}>
                      {busy ? "En cours…" : item?.imageUrl ? "Remplacer" : "Ajouter une photo"}
                    </label>
                    <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || busyName !== null} onChange={(event) => void upload(name, event)} className="sr-only" />
                    {item?.imageUrl && <button type="button" disabled={busyName !== null} onClick={() => void remove(name)} className="min-h-9 rounded-md border border-[var(--line)] px-2.5 text-[11px] font-bold text-[var(--muted)] disabled:opacity-50">Retirer</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
