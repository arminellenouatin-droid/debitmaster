// DebitMaster: Composant d'activation des notifications push Chrome natives avec design soigné et feedback clair.
"use client";

import { useEffect, useState } from "react";
import { checkPushSupport, requestPushPermission, PushPermissionStatus } from "@/lib/firebase/client";

interface PushNotificationBannerProps {
  tenantId: string;
}

export function PushNotificationBanner({ tenantId }: PushNotificationBannerProps) {
  const [status, setStatus] = useState<PushPermissionStatus>("default");
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as PushPermissionStatus);
  }, []);

  if (dismissed || status === "granted" || status === "unsupported") {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await requestPushPermission(tenantId);
      setStatus(res.status);
      if (res.success) {
        setTimeout(() => setDismissed(true), 2500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--surface)] to-[var(--surface-subtle)] p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--accent)] shadow-sm">
          <span className="text-lg">🔔</span>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[var(--secondary)]">
            Alertes en direct sur Chrome
          </p>
          <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">
            {status === "denied"
              ? "Les notifications sont bloquées dans votre navigateur Chrome. Cliquez sur le cadenas à gauche de l'URL pour les autoriser."
              : "Recevez les commandes et alertes cuisine instantanément, même écran éteint ou navigateur minimisé."}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-xl px-3 py-2 text-xs font-bold text-[var(--muted)] hover:bg-[var(--border)]"
        >
          Plus tard
        </button>
        {status !== "denied" && (
          <button
            type="button"
            disabled={loading}
            onClick={handleEnable}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-black text-[var(--primary-foreground)] shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Activation…" : "Activer sur cet appareil"}
          </button>
        )}
      </div>
    </div>
  );
}
