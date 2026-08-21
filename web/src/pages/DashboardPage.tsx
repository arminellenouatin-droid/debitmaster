import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, ClipboardList, Package, TrendingUp, AlertTriangle, Receipt } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getDashboardKpis, getMyCompany, getNotifications, getInvoices, markNotificationRead } from '../lib/api'
import { StatCard, Card, StatusBadge, EmptyState, Spinner } from '../components/ui'
import { fmtXof, fmtDateTime } from '../lib/format'
import type { Company, Invoice, Kpis, Notification } from '../lib/types'

export default function DashboardPage() {
  const { t } = useI18n()
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    Promise.all([getDashboardKpis(), getMyCompany(), getNotifications(), getInvoices()]).then(
      ([k, c, n, inv]) => { setKpis(k); setCompany(c); setNotifications(n); setInvoices(inv) },
    )
  }, [])

  if (!kpis) return <Spinner />

  const daysLeft = company?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(company.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
          {company && (
            <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
              {company.name} · {t(company.activity_type.toLowerCase() as never)} · Code {company.unique_code}
              {company.status === 'TRIAL' && daysLeft !== null && (
                <span className="ml-2 badge bg-info/10 text-info dark:text-info dark">
                  {t('trial')} — {daysLeft} {t('daysLeft')}
                </span>
              )}
            </p>
          )}
        </div>
        <Link to="/orders" className="btn-primary !h-11">{t('newOrder')}</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label={`${t('ca')} — ${t('today')}`} value={fmtXof(kpis.revenueToday)} tone="success" />
        <StatCard icon={<Banknote className="w-6 h-6" />} label={`${t('ca')} — ${t('month')}`} value={fmtXof(kpis.revenueMonth)} tone="primary" />
        <StatCard icon={<ClipboardList className="w-6 h-6" />} label={t('orders')} value={String(kpis.ordersOpen)} hint={`${kpis.ordersToday} ${t('today')}`} tone="info" />
        <StatCard icon={<Package className="w-6 h-6" />} label={t('alerts')} value={String(kpis.lowStock)} hint={t('stockLow')} tone={kpis.lowStock > 0 ? 'danger' : 'success'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Notifications */}
        <Card>
          <h2 className="font-bold mb-md">🔔 {t('alerts')}</h2>
          {notifications.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="w-8 h-8" />} title="Aucune notification" subtitle="Les alertes de stock, commandes et paie apparaîtront ici." />
          ) : (
            <ul className="flex flex-col gap-2">
              {notifications.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <button
                    className={`w-full text-left p-3 rounded-sm text-sm ${n.read_at ? 'opacity-60' : 'bg-primary-light dark:bg-primary-dark'}`}
                    onClick={() => markNotificationRead(n.id)}
                  >
                    <p className="font-medium">{n.content}</p>
                    <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{fmtDateTime(n.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Dernières factures */}
        <Card>
          <h2 className="font-bold mb-md">🧾 {t('invoice')}s récentes</h2>
          {invoices.length === 0 ? (
            <EmptyState icon={<Receipt className="w-8 h-8" />} title="Aucune facture" subtitle="Encaissiez votre première commande pour voir les factures avec numéro légal séquentiel." />
          ) : (
            <ul className="flex flex-col gap-2">
              {invoices.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between p-3 rounded-sm bg-surface dark:bg-surface dark">
                  <div>
                    <p className="text-sm font-semibold tabular-nums">{i.legal_sequential_number}</p>
                    <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{fmtDateTime(i.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{fmtXof(i.total_amount)}</span>
                    <StatusBadge status={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
