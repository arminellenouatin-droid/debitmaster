// DebitMaster Firebase Client: Enregistrement Service Worker et obtention du jeton FCM Web Push Chrome
// sans dépendance npm lourde, via chargement dynamique optimisé du CDN officiel Google.
"use client";

interface FirebaseMessagingCompat {
  getToken: (options: { vapidKey: string; serviceWorkerRegistration?: ServiceWorkerRegistration }) => Promise<string>;
  onMessage: (nextOrObserver: (payload: unknown) => void) => () => void;
}

interface FirebaseAppCompat {
  messaging: () => FirebaseMessagingCompat;
  apps: unknown[];
  initializeApp: (config: Record<string, unknown>) => unknown;
}

declare global {
  interface Window {
    firebase?: FirebaseAppCompat;
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA5S_WLhWSG_OBCSAeCGfK607kCfA10i9E",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "debitmaster.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "debitmaster",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "debitmaster.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "591130540553",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:591130540553:web:175f171894c3dc442156d8",
};

const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  "BDosUvEpm_PCIaEGs3MX_4jkksVZzOxmo8-NPVVUb5iv2uOvTY28uNUc0Xfr-SFFprinj1oQR_V-ztyg2n19m7E";

export type PushPermissionStatus = "default" | "granted" | "denied" | "unsupported";

export function checkPushSupport(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

async function ensureFirebaseMessagingLoaded(): Promise<FirebaseMessagingCompat | null> {
  if (typeof window === "undefined") return null;

  if (!window.firebase) {
    await loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  }
  if (!window.firebase?.messaging) {
    await loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
  }

  if (!window.firebase) return null;

  if (!window.firebase.apps.length) {
    window.firebase.initializeApp(firebaseConfig);
  }

  return window.firebase.messaging();
}

export async function requestPushPermission(
  tenantId: string
): Promise<{ success: boolean; token?: string; status: PushPermissionStatus }> {
  if (!checkPushSupport()) {
    return { success: false, status: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, status: permission as PushPermissionStatus };
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const messaging = await ensureFirebaseMessagingLoaded();
    if (!messaging) {
      console.warn("[FCM] Firebase Messaging CDN non disponible");
      return { success: false, status: "unsupported" };
    }

    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { success: false, status: "granted" };
    }

    const deviceType =
      typeof navigator !== "undefined" && /Mobi|Android|iPhone/i.test(navigator.userAgent)
        ? "CHROME_MOBILE"
        : "CHROME_DESKTOP";

    await fetch("/api/notifications/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, token, deviceType }),
    });

    // Enregistrement local pour éviter les sollicitations répétées
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`fcm_push_active_${tenantId}`, token);
    }

    return { success: true, token, status: "granted" };
  } catch (err) {
    console.error("[FCM] Erreur activation push Chrome:", err instanceof Error ? err.message : err);
    return { success: false, status: "denied" };
  }
}
