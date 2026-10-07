"use client";

import { useId, useState, type ChangeEvent } from "react";

type CatalogImageFieldProps = {
  tenantId: string;
  imageUrl: string;
  onImageUrlChange: (imageUrl: string) => void;
  label: string;
  uploadEndpoint?: string;
};

export function CatalogImageField({ tenantId, imageUrl, onImageUrlChange, label, uploadEndpoint = "/api/uploads/image" }: CatalogImageFieldProps) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 5 Mo.");
      return;
    }

    const body = new FormData();
    body.set("file", file);
    body.set("tenantId", tenantId);
    setUploading(true);

    try {
      const response = await fetch(uploadEndpoint, { method: "POST", body });
      const result = (await response.json()) as { imageUrl?: string; error?: string };
      if (!response.ok || !result.imageUrl) throw new Error(result.error || "Impossible d’envoyer la photo.");
      onImageUrlChange(result.imageUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’envoyer la photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold text-[var(--primary)]">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt={`Aperçu : ${label}`} className="h-20 w-20 rounded-xl border border-[var(--line)] object-cover" />
        ) : (
          <div aria-hidden="true" className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)] text-2xl text-[var(--muted)]">＋</div>
        )}
        <div className="flex flex-wrap gap-2">
          <label htmlFor={inputId} className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-[var(--primary)] hover:bg-[var(--surface-muted)] ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            {uploading ? "Téléversement…" : imageUrl ? "Remplacer la photo" : "Ajouter une photo"}
          </label>
          <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={uploadImage} className="sr-only" aria-describedby={`${inputId}-help ${inputId}-error`} />
          {imageUrl && <button type="button" disabled={uploading} onClick={() => { onImageUrlChange(""); setError(""); }} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-[var(--muted)] disabled:opacity-50">Retirer</button>}
        </div>
      </div>
      <p id={`${inputId}-help`} className="text-xs text-[var(--muted)]">JPEG, PNG ou WebP · 5 Mo maximum.</p>
      {error && <p id={`${inputId}-error`} role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
