// DebitManager shared header: quiet account controls, visible unread feedback, keyboard-safe menus and responsive spacing.
"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

type Notification = { id: string; subject: string | null; body: string; created_at: string; action_path: string | null; action_allowed: boolean; };

type DashboardHeaderProps = {
  firstName: string;
  companyName: string;
  tenantId: string;
  role: string;
  isOwner: boolean;
  subscriptionStatus: string;
  avatarUrl?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

export function DashboardHeader({ firstName, companyName, tenantId, role, isOwner, subscriptionStatus, avatarUrl }: DashboardHeaderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  async function markRead(notificationId: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId, notificationId }) });
  }

  async function loadNotifications() {
    if (!tenantId) return;
    setLoadingNotifications(true);
    try {
      const response = await fetch(`/api/notifications?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const result = await response.json() as { notifications?: Notification[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les notifications.");
      setNotifications(result.notifications ?? []);
      setNotificationError("");
    } catch (cause) {
      setNotificationError(cause instanceof Error ? cause.message : "Notifications indisponibles.");
    } finally {
      setLoadingNotifications(false);
    }
  }

  useLiveRefresh(loadNotifications, 15000);
  const unreadCount = notifications.length;
  const displayName = firstName || "Compte";
  const initials = displayName.slice(0, 1).toUpperCase();

  return <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)]/95 px-5 py-3 backdrop-blur lg:px-8">
    <Link href="/" className="flex shrink-0 items-center gap-2 font-black text-[var(--primary)] lg:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] text-sm text-white">D</span>DebitManager</Link>
    <div className="min-w-0"><p className="hidden text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)] sm:block">Établissement actif</p><p className="max-w-[42vw] truncate text-sm font-black text-[var(--primary)] sm:max-w-[44vw] lg:max-w-[32vw]" title={companyName}>{companyName}</p><p className="hidden text-[11px] font-semibold text-[var(--muted)] sm:block">{role}</p></div>
    <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
      {isOwner && <div className="hidden items-center gap-2 md:flex"><Link href="/dashboard/subscription#subscription-status" className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-black text-[var(--primary)]">Statut : {subscriptionStatus}</Link><Link href="/dashboard/subscription#plans" className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-white">Mettre à jour</Link></div>}
      <details className="relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)]">{avatarUrl ? <img src={avatarUrl} alt="Photo de profil" className="relative h-9 w-9 rounded-full object-cover" /> : <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--primary)]">{initials}</span>}<span className="hidden text-sm font-bold text-[var(--muted)] md:block">{displayName}</span><span aria-hidden="true" className="text-xs text-[var(--muted)]">⌄</span></summary>
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[0_18px_40px_-24px_var(--primary)]">
          <div className="border-b border-[var(--line)] px-3 py-2"><p className="text-sm font-black text-[var(--primary)]">{displayName}</p><p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{role}</p></div>
          <Link href="/dashboard/settings" className="mt-1 block rounded-lg px-3 py-3 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--surface-muted)]">Paramétrer mon compte</Link>
          <form action="/api/auth/logout" method="post"><button type="submit" className="w-full rounded-lg px-3 py-3 text-left text-sm font-bold text-[var(--danger)] transition hover:bg-[#fff1ef]">Se déconnecter</button></form>
        </div>
      </details>
      <details className="relative">
        <summary onClick={() => { if (!notifications.length) void loadNotifications(); }} aria-label={unreadCount ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"} className="relative flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-[var(--primary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>{unreadCount > 0 && <span className="absolute right-0.5 top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-black leading-none text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</summary>
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_18px_40px_-24px_var(--primary)]"><div className="flex items-center justify-between gap-3 px-1"><p className="text-sm font-black text-[var(--primary)]">Notifications</p>{loadingNotifications && <span className="text-xs font-semibold text-[var(--muted)]">Actualisation…</span>}</div>{notificationError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-xs font-bold text-[var(--danger)]">{notificationError}</p>}{!loadingNotifications && !notificationError && !notifications.length && <p className="mt-3 px-1 py-2 text-sm leading-5 text-[var(--muted)]">Aucune notification non lue.</p>}{notifications.length > 0 && <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">{notifications.map((notification) => <Link key={notification.id} href={notification.action_path || "/dashboard/messages"} onClick={() => { void markRead(notification.id); }} className="block rounded-lg px-3 py-3 transition hover:bg-[var(--surface-muted)]"><p className="text-xs font-black text-[var(--primary)]">{notification.subject || "Nouveau message"}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{notification.body}</p><time className="mt-1 block text-[10px] font-bold text-[var(--muted)] date">{dateFormatter.format(new Date(notification.created_at))}</time></Link>)}</div>}<Link href="/dashboard/messages" className="mt-2 block border-t border-[var(--line)] px-1 pt-3 text-xs font-black text-[var(--primary)]">Ouvrir tous les messages</Link></div>
      </details>
    </div>
  </header>;
}
