"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ALERT";
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function CommerceNotificationBell({ tenantId }: { tenantId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch(`/api/commerce/notifications?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Ignore background fetch error
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    void fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAsRead(id: string) {
    try {
      await fetch("/api/commerce/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  }

  async function markAllAsRead() {
    setLoading(true);
    try {
      await fetch("/api/commerce/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  const badgeColor = (type: string) => {
    switch (type) {
      case "ALERT":
        return "bg-red-500 text-white";
      case "WARNING":
        return "bg-amber-500 text-white";
      case "SUCCESS":
        return "bg-emerald-500 text-white";
      default:
        return "bg-blue-500 text-white";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--primary)] transition hover:bg-[var(--accent-soft)]"
        aria-label="Centre de notifications"
        title="Notifications et alertes"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <span className="font-black text-[var(--primary)] text-sm">Notifications &amp; Alertes</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                  {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={loading}
                onClick={markAllAsRead}
                className="text-xs font-bold text-[var(--secondary)] hover:underline disabled:opacity-50"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--muted)]">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && void markAsRead(notif.id)}
                  className={`rounded-xl p-3 transition border ${
                    notif.is_read
                      ? "border-transparent bg-transparent opacity-75 hover:bg-[var(--accent-soft)]/50"
                      : "border-[var(--line)] bg-[var(--accent-soft)]/30 font-medium hover:bg-[var(--accent-soft)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${badgeColor(notif.type)}`}>
                      {notif.type}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {new Date(notif.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-black text-[var(--primary)]">{notif.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">{notif.message}</p>
                  {notif.link && (
                    <Link
                      href={notif.link}
                      onClick={() => setIsOpen(false)}
                      className="mt-2 inline-flex items-center text-[11px] font-black text-[var(--secondary)] hover:underline"
                    >
                      Ouvrir l’action &rarr;
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
