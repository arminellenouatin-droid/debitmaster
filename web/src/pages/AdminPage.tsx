import React, { useEffect, useState } from 'react'
import { ShieldCheck, Store, TrendingUp, ScrollText } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { adminGetCompanies, adminGetRevenue, getAuditLogs } from '../lib/api'
import { Card, Spinner, StatusBadge, StatCard, EmptyState } from '../components/ui'
import { fmtXof, fmtDateTime } from '../lib/format'
import type { AdminCompanyRow } from '../lib/types'

export default function AdminPage() {
  const { t } = useI18n()
  const [companies, setCompanies] = useState<AdminCompanyRow[] | null>(null)
  const [revenue, setRevenue] = useState<{ subscriptions: number; commissions: number; companies: number; mrr: number } | null>(null)
  const [audit, setAudit] = useState<any[]>([])

  useEffect(() => {
    Promise.all([adminGetCompanies(), adminGetRevenue(), getAuditLogs()]).then(([c, r, a]) => {
      setCompanies(c); setRevenue(r); setAudit(a)
    })
  }, [])

  if (!companies || !revenue) return <Spinner />

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> {t('admin')} — DebitManager</h1>
        <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Poste de pilotage plateforme (équipe DebitManager)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        <StatCard icon={<Store className="w-6 h-6" />} label={t('tenants')} value={String(revenue.companies)} tone="primary" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label="MRR" value={fmtXof(revenue.mrr)} tone="success" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label={`${t('revenue')} (abonnements actifs)`} value={fmtXof(revenue.subscriptions)} tone="info" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label={`${t('commission')} 1% (transactions)`} value={fmtXof(revenue.commissions)} tone="warning" />
      </div>

      <Card>
        <h2 className="font-bold mb-md">{t('tenants')} — {companies.length}</h2>
        {companies.length === 0 ? (
          <EmptyState icon={<Store className="w-8 h-8" />} title="Aucune boutique" subtitle="Les boutiques inscrites apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-secondary dark:text-ink-darkSecondary border-b border-line dark:border-line dark">
                  <th className="py-2 pr-3">Boutique</th>
                  <th className="py-2 pr-3">Activité</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Pays</th>
                  <th className="py-2 pr-3">Inscrite le</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 dark:border-line dark/60">
                    <td className="py-2 pr-3 font-semibold">{c.name}</td>
                    <td className="py-2 pr-3">{c.activity_type.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3"><StatusBadge status={c.status} /></td>
                    <td className="py-2 pr-3 font-mono">{c.unique_code}</td>
                    <td className="py-2 pr-3">{c.country}</td>
                    <td className="py-2 pr-3">{fmtDateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-bold mb-md flex items-center gap-2"><ScrollText className="w-4 h-4" /> {t('auditLog')}</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Aucune entrée pour l'instant (journal d'audit immuable).</p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {audit.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm p-2 rounded-sm bg-surface dark:bg-surface dark">
                <span className="font-mono text-xs">{a.action}</span>
                <span className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{fmtDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
