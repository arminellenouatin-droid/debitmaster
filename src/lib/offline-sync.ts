// DebitMaster Offline Resilience & PWA Synchronization Helper (Sprint 12)
// Permet la saisie des devis/ventes hors-connexion et la synchronisation automatique dès le retour du réseau.

export type OfflinePendingAction = {
  id: string;
  type: "CREATE_QUOTE" | "CREATE_INVOICE" | "RECORD_ATTENDANCE";
  endpoint: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
};

const OFFLINE_QUEUE_KEY = "debitmaster_offline_queue";

export function getOfflineQueue(): OfflinePendingAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflinePendingAction[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(action: Omit<OfflinePendingAction, "id" | "createdAt" | "attempts">): OfflinePendingAction {
  const item: OfflinePendingAction = {
    ...action,
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    attempts: 0,
  };
  const queue = getOfflineQueue();
  queue.push(item);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[offline-sync] storage error", err);
  }
  return item;
}

export async function flushOfflineQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  const remaining: OfflinePendingAction[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const response = await fetch(item.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        processed++;
      } else if (response.status >= 400 && response.status < 500) {
        // Validation rejection, do not retry indefinitely
        failed++;
      } else {
        item.attempts++;
        remaining.push(item);
      }
    } catch {
      item.attempts++;
      remaining.push(item);
    }
  }

  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // Ignore
  }

  return { processed, failed };
}

export function registerOfflineSyncListener(onSyncComplete?: (result: { processed: number; failed: number }) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => {
    void flushOfflineQueue().then((res) => {
      if (onSyncComplete && (res.processed > 0 || res.failed > 0)) {
        onSyncComplete(res);
      }
    });
  };

  window.addEventListener("online", handleOnline);
  return () => window.removeEventListener("online", handleOnline);
}
