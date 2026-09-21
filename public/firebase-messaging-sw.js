// DebitMaster Service Worker: Réception des notifications push Chrome en tâche de fond et ouverture directe au clic.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyA5S_WLhWSG_OBCSAeCGfK607kCfA10i9E",
  authDomain: "debitmaster.firebaseapp.com",
  projectId: "debitmaster",
  storageBucket: "debitmaster.firebasestorage.app",
  messagingSenderId: "591130540553",
  appId: "1:591130540553:web:175f171894c3dc442156d8",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || "DebitMaster";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "Nouvelle mise à jour de votre établissement.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      actionPath: payload.data?.actionPath || payload.data?.url || "/dashboard",
    },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.actionPath || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
