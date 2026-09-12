// DebitManager shared header: quiet account controls, mobile drawer navigation, live notifications with chime, and responsive spacing.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

type Notification = {
  id: string;
  subject: string | null;
  body: string;
  created_at: string;
  action_path: string | null;
  action_allowed: boolean;
};

type NavItem = readonly [string, string, string];

type DashboardHeaderProps = {
  firstName: string;
  companyName: string;
  tenantId: string;
  role: string;
  isOwner: boolean;
  subscriptionStatus: string;
  avatarUrl?: string | null;
  navigationItems?: ReadonlyArray<NavItem>;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Audio autoplay restrictions or unsupported
  }
}

export function DashboardHeader({
  firstName,
  companyName,
  tenantId,
  role,
  isOwner,
  subscriptionStatus,
  avatarUrl,
  navigationItems = [],
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const previousUnreadCount = useRef<number | null>(null);

  const markRead = useCallback(
    async (notificationId: string) => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, notificationId }),
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Impossible de marquer la notification comme lue.");
      setNotifications((current) => current.filter((n) => n.id !== notificationId));
    },
    [tenantId]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, markAllRead: true }),
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Impossible de marquer les notifications comme lues.");
      setNotifications([]);
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : "Erreur.");
    }
  }, [tenantId]);

  const loadNotifications = useCallback(async () => {
    if (!tenantId) {
      setNotifications([]);
      return;
    }
    setLoadingNotifications(true);
    try {
      const response = await fetch(`/api/notifications?tenantId=${encodeURIComponent(tenantId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = (await response.json()) as { notifications?: Notification[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les notifications.");
      const list = result.notifications ?? [];
      
      // Chime on new incoming notifications
      if (previousUnreadCount.current !== null && list.length > previousUnreadCount.current) {
        playNotificationChime();
      }
      previousUnreadCount.current = list.length;
      
      setNotifications(list);
      setNotificationError("");
    } catch (cause) {
      setNotificationError(cause instanceof Error ? cause.message : "Notifications indisponibles.");
    } finally {
      setLoadingNotifications(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useLiveRefresh(loadNotifications, 12000);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const unreadCount = notifications.length;
  const displayName = firstName || "Compte";
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur lg:px-8">
        {/* Left Section: Mobile Menu Trigger + Brand & Active establishment */}
        <div className="flex items-center gap-3">
          {/* Hamburger button for mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu de navigation complet"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-muted)] lg:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2 font-black text-[var(--primary)] lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] text-sm text-white">
              D
            </span>
            <span className="font-black">DebitManager</span>
          </Link>

          <div className="hidden min-w-0 sm:block">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Établissement actif</p>
            <p className="max-w-[42vw] truncate text-sm font-black text-[var(--primary)] lg:max-w-[32vw]" title={companyName}>
              {companyName}
            </p>
            <p className="text-[11px] font-semibold text-[var(--muted)]">{role}</p>
          </div>
        </div>

        {/* Right Section: Subscription, Profile, Notifications */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {isOwner && (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/dashboard/subscription#subscription-status"
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-black text-[var(--primary)]"
              >
                Statut : {subscriptionStatus}
              </Link>
              <Link
                href="/dashboard/subscription#plans"
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-white"
              >
                Mettre à jour
              </Link>
            </div>
          )}

          {/* User Profile dropdown */}
          <details className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Photo de profil" className="relative h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--primary)]">
                  {initials}
                </span>
              )}
              <span className="hidden text-sm font-bold text-[var(--muted)] md:block">{displayName}</span>
              <span aria-hidden="true" className="text-xs text-[var(--muted)]">
                ⌄
              </span>
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-2xl">
              <div className="border-b border-[var(--line)] px-3 py-2">
                <p className="text-sm font-black text-[var(--primary)]">{displayName}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{role}</p>
                <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{companyName}</p>
              </div>
              <Link
                href="/dashboard/settings"
                className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--surface-muted)]"
              >
                Paramètres du compte
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[var(--danger)] transition hover:bg-[#fff1ef]"
                >
                  Se déconnecter
                </button>
              </form>
            </div>
          </details>

          {/* Notifications Popover */}
          <details className="relative">
            <summary
              onClick={() => {
                void loadNotifications();
              }}
              aria-label={
                unreadCount
                  ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
                  : "Notifications"
              }
              className="relative flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--primary)] shadow-sm transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-2 pb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-[var(--primary)]">Notifications</p>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {loadingNotifications && <span className="text-[11px] font-semibold text-[var(--muted)]">Actualisation…</span>}
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllAsRead()}
                      className="text-[11px] font-bold text-[var(--primary)] underline hover:text-[var(--primary)]/80"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
              </div>

              {notificationError && (
                <p role="alert" className="mt-3 rounded-xl bg-[#fff1ef] px-3 py-2 text-xs font-bold text-[var(--danger)]">
                  {notificationError}
                </p>
              )}

              {!loadingNotifications && !notificationError && !notifications.length && (
                <div className="py-6 text-center text-xs font-semibold text-[var(--muted)]">
                  🔔 Aucune nouvelle notification.
                </div>
              )}

              {notifications.length > 0 && (
                <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.action_path || "/dashboard/messages"}
                      onClick={(event) => {
                        void markRead(n.id).catch(() => {
                          event.preventDefault();
                          setNotificationError("La notification n’a pas pu être marquée comme lue.");
                        });
                      }}
                      className="block rounded-xl border border-transparent bg-[var(--surface-muted)]/70 p-3 transition hover:border-[var(--line)] hover:bg-[var(--surface-muted)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-[var(--primary)]">{n.subject || "Alerte système"}</p>
                        <time className="text-[10px] font-bold text-[var(--muted)]">
                          {dateFormatter.format(new Date(n.created_at))}
                        </time>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{n.body}</p>
                    </Link>
                  ))}
                </div>
              )}

              <Link
                href="/dashboard/messages"
                className="mt-2 block border-t border-[var(--line)] px-2 pt-2.5 text-center text-xs font-black text-[var(--primary)] hover:underline"
              >
                Ouvrir la messagerie interne
              </Link>
            </div>
          </details>
        </div>
      </header>

      {/* MOBILE FULL DRAWER NAVIGATION */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <aside className="relative flex h-full w-[82vw] max-w-sm flex-col bg-[var(--primary)] p-5 text-white shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-base font-black text-[var(--primary)]">
                  D
                </span>
                <div>
                  <h2 className="text-base font-black leading-tight">DebitManager</h2>
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Menu complet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                aria-label="Fermer le menu"
              >
                ✕
              </button>
            </div>

            {/* Active Establishment & User Badge */}
            <div className="mt-4 rounded-xl bg-white/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Établissement</p>
              <p className="truncate text-sm font-black text-white" title={companyName}>
                {companyName}
              </p>
              <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                <span>{displayName}</span>
                <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-black">{role}</span>
              </div>
            </div>

            {/* Navigation items list */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              <p className="px-1 text-[10px] font-black uppercase tracking-wider text-white/50">
                Onglets autorisés ({navigationItems.length})
              </p>
              <nav className="mt-2 space-y-1">
                {navigationItems.map(([icon, label, href]) => {
                  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <Link
                      key={`${label}-${href}`}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
                        isActive
                          ? "bg-white text-[var(--primary)] shadow-sm"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center text-lg">{icon}</span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-white/15 pt-3">
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 text-xs font-black text-red-200 transition hover:bg-red-500/30"
                >
                  <span>↪</span>
                  <span>Se déconnecter</span>
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
