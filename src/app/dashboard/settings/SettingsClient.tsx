// DebitManager account settings: clear profile editing, private avatar upload, promoter documents and explicit security states.
"use client";

import { FormEvent, ChangeEvent, useState, useEffect } from "react";
import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";

export type PromoterCompany = {
  id: string;
  name: string;
  country?: string | null;
  ifu_number: string | null;
  trade_register: string | null;
  promoter_photo_path: string | null;
  identity_card_path: string | null;
};

type Props = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  promoterCompanies?: PromoterCompany[];
};

export function SettingsClient({
  firstName: initialFirstName,
  lastName: initialLastName,
  email: initialEmail,
  phone,
  avatarUrl: initialAvatarUrl,
  mustChangePassword,
  promoterCompanies = [],
}: Props) {
  const [compact, setCompact] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(mustChangePassword);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  // Promoter legal documents state
  const [selectedCompanyId, setSelectedCompanyId] = useState(promoterCompanies[0]?.id ?? "");
  const activeCompany = promoterCompanies.find((c) => c.id === selectedCompanyId) || promoterCompanies[0];
  const [ifuNumber, setIfuNumber] = useState(activeCompany?.ifu_number ?? "");
  const [tradeRegister, setTradeRegister] = useState(activeCompany?.trade_register ?? "");
  const [promoterPhoto, setPromoterPhoto] = useState<File | null>(null);
  const [identityCard, setIdentityCard] = useState<File | null>(null);
  const [hasPhoto, setHasPhoto] = useState(Boolean(activeCompany?.promoter_photo_path));
  const [hasIdentity, setHasIdentity] = useState(Boolean(activeCompany?.identity_card_path));
  const [promoterPending, setPromoterPending] = useState(false);

  // Facturation normalisée DGI Bénin (e-MECeF)
  const [isNormalizedInvoiceEnabled, setIsNormalizedInvoiceEnabled] = useState(false);
  const [dgiNim, setDgiNim] = useState("SF00000001");
  const [dgiEnv, setDgiEnv] = useState<"sandbox" | "production">("sandbox");
  const [dgiApiToken, setDgiApiToken] = useState("");
  const [dgiPending, setDgiPending] = useState(false);
  const [dgiFeedback, setDgiFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (!activeCompany?.id) return;
    let active = true;
    fetch(`/api/companies/normalized-invoicing?tenantId=${encodeURIComponent(activeCompany.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data.success) return;
        setIsNormalizedInvoiceEnabled(Boolean(data.settings?.isNormalizedInvoiceEnabled));
        if (data.settings?.ifuNumber && !ifuNumber) setIfuNumber(data.settings.ifuNumber);
        if (data.settings?.dgiNim) setDgiNim(data.settings.dgiNim);
        if (data.settings?.dgiEnv) setDgiEnv(data.settings.dgiEnv);
        if (data.settings?.dgiApiToken) setDgiApiToken(data.settings.dgiApiToken);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeCompany?.id]);

  async function handleToggleDgi(targetState: boolean) {
    if (!activeCompany?.id) return;
    setDgiPending(true);
    setDgiFeedback(null);
    try {
      const response = await fetch("/api/companies/normalized-invoicing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: activeCompany.id,
          isNormalizedInvoiceEnabled: targetState,
          ifuNumber: ifuNumber.trim(),
          dgiNim: dgiNim.trim(),
          dgiEnv,
          dgiApiToken: dgiApiToken.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier la facturation normalisée.");
      setIsNormalizedInvoiceEnabled(targetState);
      setDgiFeedback({
        text: targetState
          ? "✓ Facturation normalisée DGI Bénin (e-MECeF) activée sur cet établissement !"
          : "Facturation simple réactivée (sans e-MECeF).",
      });
    } catch (err) {
      setDgiFeedback({
        text: err instanceof Error ? err.message : "Erreur lors de la mise à jour.",
        isError: true,
      });
    } finally {
      setDgiPending(false);
    }
  }

  function resetFeedback() {
    setError("");
    setMessage("");
  }

  function handleCompanyChange(id: string) {
    setSelectedCompanyId(id);
    const target = promoterCompanies.find((c) => c.id === id);
    if (target) {
      setIfuNumber(target.ifu_number ?? "");
      setTradeRegister(target.trade_register ?? "");
      setHasPhoto(Boolean(target.promoter_photo_path));
      setHasIdentity(Boolean(target.identity_card_path));
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    setProfilePending(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de mettre à jour le profil.");
      setMessage(
        result.emailConfirmationRequired
          ? "Profil enregistré. Confirmez le nouvel e-mail depuis votre boîte de réception pour l’activer."
          : "Profil mis à jour."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de mettre à jour le profil.");
    } finally {
      setProfilePending(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    resetFeedback();
    setAvatarPending(true);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const response = await fetch("/api/auth/profile/avatar", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer la photo.");
      setAvatarUrl(result.avatarUrl ?? null);
      setMessage("Photo de profil mise à jour.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la photo.");
    } finally {
      setAvatarPending(false);
      event.target.value = "";
    }
  }

  async function savePromoterLegal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCompany?.id) return;
    resetFeedback();
    setPromoterPending(true);
    try {
      const formData = new FormData();
      formData.set("tenantId", activeCompany.id);
      formData.set("ifuNumber", ifuNumber);
      formData.set("tradeRegister", tradeRegister);
      if (promoterPhoto) formData.set("promoterPhoto", promoterPhoto);
      if (identityCard) formData.set("identityCard", identityCard);

      const response = await fetch("/api/companies/documents", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d'enregistrer les documents du promoteur.");

      if (result.hasPromoterPhoto) setHasPhoto(true);
      if (result.hasIdentityCard) setHasIdentity(true);
      setPromoterPhoto(null);
      setIdentityCard(null);
      setMessage("Informations légales et documents du promoteur enregistrés avec succès.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible d'enregistrer les informations légales.");
    } finally {
      setPromoterPending(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de modifier le mot de passe.");
      setPassword("");
      setConfirmation("");
      setShowPasswordForm(false);
      setMessage("Mot de passe mis à jour. Votre accès est maintenant sécurisé.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier le mot de passe.");
    } finally {
      setPending(false);
    }
  }

  const initials = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || "U";

  return (
    <section>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--secondary)]">Compte & Établissement</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--primary)]">Paramètres de votre compte</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Mettez à jour vos informations personnelles, vos données légales d’établissement et sécurisez votre accès.
        </p>
      </div>

      {mustChangePassword && (
        <div className="mt-6 rounded-xl border-2 border-[var(--secondary)] bg-[var(--secondary-container)] p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">Action requise</p>
          <h2 className="mt-2 text-xl font-black text-[var(--primary)]">Remplacez votre mot de passe temporaire</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--primary)]">
            Choisissez un mot de passe personnel avant d’utiliser durablement votre espace.
          </p>
        </div>
      )}

      {(error || message) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-6 rounded-lg px-4 py-3 text-sm font-bold ${
            error ? "bg-[#ffdad6] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--primary)]"
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Profil Personnel */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Profil</p>
          <h2 className="mt-2 text-xl font-black text-[var(--primary)]">Informations personnelles</h2>
          <form onSubmit={saveProfile} className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="flex items-center gap-4 sm:col-span-2">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-xl font-black text-[var(--primary)]">
                {avatarUrl ? <img src={avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" /> : initials}
              </div>
              <div>
                <label className="inline-flex cursor-pointer rounded-lg border border-[var(--line)] px-4 py-3 text-sm font-black text-[var(--primary)]">
                  {avatarPending ? "Envoi…" : "Choisir une photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadAvatar}
                    disabled={avatarPending}
                    className="sr-only"
                  />
                </label>
                <p className="mt-2 text-xs text-[var(--muted)]">JPG, PNG ou WebP, 2 Mo maximum.</p>
              </div>
            </div>
            <label className="text-sm font-bold text-[var(--primary)]">
              Prénom
              <input
                required
                minLength={2}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4"
              />
            </label>
            <label className="text-sm font-bold text-[var(--primary)]">
              Nom
              <input
                required
                minLength={2}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4"
              />
            </label>
            <label className="text-sm font-bold text-[var(--primary)] sm:col-span-2">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4"
              />
              <span className="mt-2 block text-xs font-medium text-[var(--muted)]">
                Un changement d’e-mail peut nécessiter une confirmation.
              </span>
            </label>
            <p className="text-sm text-[var(--muted)] sm:col-span-2">
              Téléphone de connexion : <span className="font-bold text-[var(--primary)]">{phone || "Non renseigné"}</span>
            </p>
            <button
              disabled={profilePending}
              className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
            >
              {profilePending ? "Enregistrement…" : "Enregistrer le profil"}
            </button>
          </form>
        </section>

        {/* Section Promoteur : Informations légales & Documents de l'établissement */}
        {promoterCompanies.length > 0 && activeCompany && (
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--secondary)]">Promoteur & Légal</p>
                <h2 className="mt-1 text-xl font-black text-[var(--primary)]">Informations légales & Documents d’entreprise</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Complétez ou mettez à jour l’IFU, le RCCM, votre photo et votre pièce d’identité pour votre établissement.
                </p>
              </div>
              {promoterCompanies.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--muted)]">Établissement :</span>
                  <select
                    value={activeCompany.id}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-1.5 text-xs font-bold text-[var(--primary)]"
                  >
                    {promoterCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <form onSubmit={savePromoterLegal} className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-bold text-[var(--primary)]">
                Numéro IFU
                <input
                  value={ifuNumber}
                  onChange={(e) => setIfuNumber(e.target.value)}
                  placeholder="Ex. 02018100523456"
                  className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 text-sm"
                />
              </label>

              <label className="text-sm font-bold text-[var(--primary)]">
                Registre de commerce (RCCM)
                <input
                  value={tradeRegister}
                  onChange={(e) => setTradeRegister(e.target.value)}
                  placeholder="Ex. RB/COT/20-B-12345"
                  className="mt-2 h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-4 text-sm"
                />
              </label>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--primary)]">Photo du promoteur</span>
                  {hasPhoto && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                      ✓ Déjà enregistrée
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPromoterPhoto(e.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white hover:file:opacity-90"
                />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">JPG, PNG ou WebP, 5 Mo max.</span>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--primary)]">Carte d’identité du promoteur</span>
                  {hasIdentity && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                      ✓ Déjà enregistrée
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setIdentityCard(e.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white hover:file:opacity-90"
                />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">Image ou PDF, 8 Mo max.</span>
              </div>

              <button
                disabled={promoterPending}
                className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
              >
                {promoterPending ? "Enregistrement en cours…" : "Mettre à jour les informations du promoteur"}
              </button>
            </form>
          </section>
        )}

        {/* Section Facturation Normalisée DGI Bénin (e-MECeF) */}
        {promoterCompanies.length > 0 && activeCompany && (
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🇧🇯</span>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                    DGI Bénin · e-MECeF
                  </p>
                </div>
                <h2 className="mt-1 text-xl font-black text-[var(--primary)]">
                  Facture normalisée ({activeCompany.name})
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Activez la certification officielle des ventes conformément à la réglementation de la Direction Générale des Impôts du Bénin.
                </p>
              </div>

              {/* Bouton Toggle Facture Normalisée */}
              <button
                type="button"
                disabled={dgiPending}
                onClick={() => handleToggleDgi(!isNormalizedInvoiceEnabled)}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                  isNormalizedInvoiceEnabled
                    ? "bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
                    : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    isNormalizedInvoiceEnabled ? "bg-white animate-pulse" : "bg-slate-400"
                  }`}
                />
                {dgiPending
                  ? "Enregistrement…"
                  : isNormalizedInvoiceEnabled
                  ? "✓ Facture normalisée ACTIVÉE"
                  : "Facture simple (DÉSACTIVÉE)"}
              </button>
            </div>

            {dgiFeedback && (
              <p
                className={`mt-4 rounded-lg px-4 py-3 text-xs font-bold ${
                  dgiFeedback.isError
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {dgiFeedback.text}
              </p>
            )}

            {/* État Détaillé & Paramètres */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              {isNormalizedInvoiceEnabled ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Statut : Factures et tickets certifiés DGI avec QR Code
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">
                      e-MECeF {dgiEnv === "production" ? "Production" : "Sandbox (Test)"}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <span className="block text-[11px] font-bold text-slate-500">IFU Vendeur associé</span>
                      <p className="mt-1 font-mono text-sm font-black text-slate-900">
                        {ifuNumber.trim() || (
                          <span className="text-amber-600">⚠️ Aucun IFU renseigné ci-dessus</span>
                        )}
                      </p>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        Récupéré automatiquement depuis les informations légales du promoteur.
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <span className="block text-[11px] font-bold text-slate-500">NIM (Numéro Machine SFE)</span>
                      <input
                        value={dgiNim}
                        onChange={(e) => setDgiNim(e.target.value)}
                        placeholder="Ex. SF00000001"
                        className="mt-1 w-full font-mono text-sm font-black text-slate-900 outline-none border-b border-slate-200 focus:border-emerald-600"
                      />
                      <span className="mt-1 block text-[10px] text-slate-400">
                        Identifiant attribué par la DGI (défaut : SF00000001).
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">Environnement DGI</label>
                      <select
                        value={dgiEnv}
                        onChange={(e) => setDgiEnv(e.target.value as "sandbox" | "production")}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                      >
                        <option value="sandbox">Sandbox (Plateforme de test DGI)</option>
                        <option value="production">Production (Serveur officiel impots.bj)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">Jeton API DGI (Optionnel en test)</label>
                      <input
                        type="password"
                        value={dgiApiToken}
                        onChange={(e) => setDgiApiToken(e.target.value)}
                        placeholder="Bearer token e-MECeF"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={dgiPending}
                      onClick={() => handleToggleDgi(true)}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {dgiPending ? "Enregistrement…" : "Mettre à jour la configuration DGI"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-xs text-slate-600">
                    La facturation normalisée est actuellement <b>désactivée</b> pour cet établissement.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Les tickets et factures sont délivrés simplement sans certification DGI. Cliquez sur le bouton ci-dessus pour activer l’intégration e-MECeF.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Sécurité */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Sécurité</p>
              <h2 className="mt-2 text-xl font-black text-[var(--primary)]">Mot de passe</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Utilisez au moins 8 caractères et ne partagez jamais ce mot de passe.
              </p>
            </div>
            {!showPasswordForm && (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="rounded-lg border border-[var(--line)] px-4 py-3 text-sm font-black text-[var(--primary)]"
              >
                Modifier
              </button>
            )}
          </div>
          {showPasswordForm && (
            <form onSubmit={changePassword} className="mt-6 grid gap-4 sm:grid-cols-2">
              <PasswordField
                label="Nouveau mot de passe"
                required
                minLength={8}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirmer le mot de passe"
                required
                minLength={8}
                value={confirmation}
                onChange={setConfirmation}
                autoComplete="new-password"
              />
              <button
                disabled={pending}
                className="rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-black text-white sm:col-span-2 sm:justify-self-start disabled:opacity-50"
              >
                {pending ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}
              </button>
            </form>
          )}
        </section>

        {/* Préférences */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Préférences</p>
          <h2 className="mt-2 text-xl font-black text-[var(--primary)]">Votre confort de travail</h2>
          <label className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] p-4">
            <span>
              <span className="block font-black text-[var(--primary)]">Vue compacte</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">Réduit l’espace entre les éléments des listes.</span>
            </span>
            <input
              type="checkbox"
              checked={compact}
              onChange={(event) => {
                setCompact(event.target.checked);
                setMessage("Préférence appliquée à cette session.");
              }}
              className="h-5 w-5 accent-[var(--primary)]"
            />
          </label>
        </section>

        {/* Support */}
        <section className="rounded-xl bg-[var(--primary)] p-6 text-white">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Besoin d’aide ?</p>
          <h2 className="mt-2 text-xl font-black">Support DebitManager</h2>
          <p className="mt-4 text-sm leading-6 text-white/65">Revenez au tableau de bord pour poursuivre vos opérations.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-[var(--secondary-container)] px-4 py-3 text-sm font-black text-[var(--primary)]"
            >
              Retour au dashboard
            </Link>
            <Link
              href="/dashboard/messages"
              className="rounded-lg border border-white/20 px-4 py-3 text-sm font-black text-white"
            >
              Écrire à l’équipe
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
