"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CatalogImageField } from "@/components/CatalogImageField";

type Model = {
  id: string;
  name: string;
  description: string | null;
  gender: "HOMME" | "FEMME" | "ENFANT" | "UNISEXE";
  image_url: string | null;
  is_active: boolean;
};

type Accessory = {
  id: string;
  name: string;
  category: string;
  selling_price_xof: number;
  photo_url: string | null;
  is_active: boolean;
};

type ApiResponse<T> = T & { error?: string };

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok) throw new Error(payload.error || "La requête n’a pas abouti.");
  return payload;
}

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(Number(value) || 0)} XOF`;
const modelGenders = ["HOMME", "FEMME", "ENFANT", "UNISEXE"] as const;
const accessoryCategories = ["SAC", "CHAUSSETTES", "LUNETTES", "MANCHETTES", "MONTRE", "AUTRE"] as const;

export function CoutureCatalogClient({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const [models, setModels] = useState<Model[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [modelImages, setModelImages] = useState<Record<string, string>>({});
  const [accessoryImages, setAccessoryImages] = useState<Record<string, string>>({});
  const [modelName, setModelName] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [modelGender, setModelGender] = useState<(typeof modelGenders)[number]>("UNISEXE");
  const [newModelImage, setNewModelImage] = useState("");
  const [accessoryName, setAccessoryName] = useState("");
  const [accessoryCategory, setAccessoryCategory] = useState<(typeof accessoryCategories)[number]>("AUTRE");
  const [accessoryPrice, setAccessoryPrice] = useState("");
  const [newAccessoryImage, setNewAccessoryImage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadCatalog() {
    const query = `?tenantId=${encodeURIComponent(tenantId)}`;
    const [modelResponse, accessoryResponse] = await Promise.all([
      fetch(`/api/couture/catalog/models${query}`, { cache: "no-store" }),
      fetch(`/api/couture/catalog/accessories${query}`, { cache: "no-store" }),
    ]);
    const modelPayload = await readJson<{ models?: Model[] }>(modelResponse);
    const accessoryPayload = await readJson<{ accessories?: Accessory[] }>(accessoryResponse);
    const loadedModels = modelPayload.models ?? [];
    const loadedAccessories = accessoryPayload.accessories ?? [];
    setModels(loadedModels);
    setAccessories(loadedAccessories);
    setModelImages(Object.fromEntries(loadedModels.map((item) => [item.id, item.image_url ?? ""])));
    setAccessoryImages(Object.fromEntries(loadedAccessories.map((item) => [item.id, item.photo_url ?? ""])));
  }

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      try {
        const query = `?tenantId=${encodeURIComponent(tenantId)}`;
        const [modelResponse, accessoryResponse] = await Promise.all([
          fetch(`/api/couture/catalog/models${query}`, { cache: "no-store" }),
          fetch(`/api/couture/catalog/accessories${query}`, { cache: "no-store" }),
        ]);
        const modelPayload = await readJson<{ models?: Model[] }>(modelResponse);
        const accessoryPayload = await readJson<{ accessories?: Accessory[] }>(accessoryResponse);
        if (cancelled) return;
        const loadedModels = modelPayload.models ?? [];
        const loadedAccessories = accessoryPayload.accessories ?? [];
        setModels(loadedModels);
        setAccessories(loadedAccessories);
        setModelImages(Object.fromEntries(loadedModels.map((item) => [item.id, item.image_url ?? ""])));
        setAccessoryImages(Object.fromEntries(loadedAccessories.map((item) => [item.id, item.photo_url ?? ""])));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Impossible de charger le catalogue Couture.");
      }
    }
    void initialLoad();
    return () => { cancelled = true; };
  }, [tenantId]);

  async function createModel(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusyId("new-model");
    try {
      const response = await fetch("/api/couture/catalog/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, name: modelName, description: modelDescription, gender: modelGender, imageUrl: newModelImage || null }),
      });
      await readJson(response);
      setModelName("");
      setModelDescription("");
      setModelGender("UNISEXE");
      setNewModelImage("");
      setNotice("Modèle ajouté au catalogue.");
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’ajouter le modèle.");
    } finally {
      setBusyId("");
    }
  }

  async function createAccessory(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusyId("new-accessory");
    try {
      const response = await fetch("/api/couture/catalog/accessories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, name: accessoryName, category: accessoryCategory, sellingPriceXof: Number(accessoryPrice), photoUrl: newAccessoryImage || null }),
      });
      await readJson(response);
      setAccessoryName("");
      setAccessoryCategory("AUTRE");
      setAccessoryPrice("");
      setNewAccessoryImage("");
      setNotice("Accessoire ajouté au catalogue.");
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’ajouter l’accessoire.");
    } finally {
      setBusyId("");
    }
  }

  async function saveModelImage(model: Model) {
    setError("");
    setNotice("");
    setBusyId(model.id);
    try {
      const response = await fetch("/api/couture/catalog/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, id: model.id, imageUrl: modelImages[model.id] || null }),
      });
      await readJson(response);
      setNotice(`Photo du modèle « ${model.name} » mise à jour.`);
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de mettre à jour la photo du modèle.");
    } finally {
      setBusyId("");
    }
  }

  async function saveAccessoryImage(accessory: Accessory) {
    setError("");
    setNotice("");
    setBusyId(accessory.id);
    try {
      const response = await fetch("/api/couture/catalog/accessories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, id: accessory.id, photoUrl: accessoryImages[accessory.id] || null }),
      });
      await readJson(response);
      setNotice(`Photo de l’accessoire « ${accessory.name} » mise à jour.`);
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de mettre à jour la photo de l’accessoire.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Atelier Couture · Catalogue</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Modèles et accessoires</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Ajoutez une photo à chaque création et accessoire. Les images sont ensuite reprises dans la vitrine et sur les cartes correspondantes.</p>
      </header>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-semibold ${error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{error || notice}</p>}

      {canManage && <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={createModel} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Ajouter un modèle</h2>
          <label className="block text-sm font-semibold text-slate-700">Nom du modèle<input required minLength={2} maxLength={100} value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          <label className="block text-sm font-semibold text-slate-700">Description<textarea maxLength={500} value={modelDescription} onChange={(event) => setModelDescription(event.target.value)} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 p-3" /></label>
          <label className="block text-sm font-semibold text-slate-700">Genre<select value={modelGender} onChange={(event) => setModelGender(event.target.value as (typeof modelGenders)[number])} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3">{modelGenders.map((gender) => <option key={gender} value={gender}>{gender}</option>)}</select></label>
          <CatalogImageField tenantId={tenantId} imageUrl={newModelImage} onImageUrlChange={setNewModelImage} label="Photo du modèle" uploadEndpoint="/api/couture/catalog/images" />
          <button disabled={busyId === "new-model"} className="min-h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{busyId === "new-model" ? "Enregistrement…" : "Créer le modèle"}</button>
        </form>
        <form onSubmit={createAccessory} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Ajouter un accessoire</h2>
          <label className="block text-sm font-semibold text-slate-700">Nom de l’accessoire<input required minLength={2} maxLength={120} value={accessoryName} onChange={(event) => setAccessoryName(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          <label className="block text-sm font-semibold text-slate-700">Catégorie<select value={accessoryCategory} onChange={(event) => setAccessoryCategory(event.target.value as (typeof accessoryCategories)[number])} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3">{accessoryCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="block text-sm font-semibold text-slate-700">Prix de vente (XOF)<input required type="number" min="0" step="1" value={accessoryPrice} onChange={(event) => setAccessoryPrice(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          <CatalogImageField tenantId={tenantId} imageUrl={newAccessoryImage} onImageUrlChange={setNewAccessoryImage} label="Photo de l’accessoire" uploadEndpoint="/api/couture/catalog/images" />
          <button disabled={busyId === "new-accessory"} className="min-h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">{busyId === "new-accessory" ? "Enregistrement…" : "Créer l’accessoire"}</button>
        </form>
      </div>}

      <section>
        <h2 className="text-xl font-black text-slate-950">Modèles ({models.length})</h2>
        {models.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{models.map((model) => <article key={model.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {model.image_url ? <img src={model.image_url} alt={`Photo de ${model.name}`} className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" /> : <div className="mb-3 grid aspect-[4/3] w-full place-items-center rounded-xl bg-slate-100 text-4xl" aria-hidden="true">👗</div>}
          <h3 className="font-black text-slate-900">{model.name}</h3><p className="mt-1 text-xs text-slate-600">{model.gender}{model.description ? ` · ${model.description}` : ""}</p>
          {canManage && <div className="mt-4 space-y-3"><CatalogImageField tenantId={tenantId} imageUrl={modelImages[model.id] ?? model.image_url ?? ""} onImageUrlChange={(imageUrl) => setModelImages((current) => ({ ...current, [model.id]: imageUrl }))} label={`Photo : ${model.name}`} uploadEndpoint="/api/couture/catalog/images" /><button type="button" disabled={busyId === model.id} onClick={() => void saveModelImage(model)} className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:opacity-60">{busyId === model.id ? "Enregistrement…" : "Enregistrer la photo"}</button></div>}
        </article>)}</div> : <p className="mt-4 rounded-xl bg-slate-100 p-5 text-sm text-slate-600">Aucun modèle à afficher pour cet établissement.</p>}
      </section>

      <section>
        <h2 className="text-xl font-black text-slate-950">Accessoires ({accessories.length})</h2>
        {accessories.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{accessories.map((accessory) => <article key={accessory.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {accessory.photo_url ? <img src={accessory.photo_url} alt={`Photo de ${accessory.name}`} className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" /> : <div className="mb-3 grid aspect-[4/3] w-full place-items-center rounded-xl bg-slate-100 text-4xl" aria-hidden="true">◈</div>}
          <h3 className="font-black text-slate-900">{accessory.name}</h3><p className="mt-1 text-xs text-slate-600">{accessory.category} · {money(accessory.selling_price_xof)}</p>
          {canManage && <div className="mt-4 space-y-3"><CatalogImageField tenantId={tenantId} imageUrl={accessoryImages[accessory.id] ?? accessory.photo_url ?? ""} onImageUrlChange={(imageUrl) => setAccessoryImages((current) => ({ ...current, [accessory.id]: imageUrl }))} label={`Photo : ${accessory.name}`} uploadEndpoint="/api/couture/catalog/images" /><button type="button" disabled={busyId === accessory.id} onClick={() => void saveAccessoryImage(accessory)} className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:opacity-60">{busyId === accessory.id ? "Enregistrement…" : "Enregistrer la photo"}</button></div>}
        </article>)}</div> : <p className="mt-4 rounded-xl bg-slate-100 p-5 text-sm text-slate-600">Aucun accessoire à afficher pour cet établissement.</p>}
      </section>
    </section>
  );
}
