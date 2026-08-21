import React, { useEffect, useState } from 'react'
import { TrendingUp, Download, AlertTriangle, Package } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getDashboardKpis, getInvoices, getProducts, exportInvoicesCsv } from '../lib/api'
import { Button, Card, Spinner, StatCard, StatusBadge } from '../components/ui'
import { fmtXof } from '../lib/format'
import type { Invoice, Kpis, Product } from '../lib/types'

export default function ReportsPage() {
  const { t } = useI18n()
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    Promise.all([getDashboardKpis(), getInvoices(), getProducts()]).then(([k, i, p]) => { setKpis(k); setProducts(p); setInvoices(i) })
  }, [])

  if (!kpis) return <Spinner />

  const lowStock = products.filter((p) => p.current_stock <= p.alert_threshold && p.alert_threshold > 0)

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('reports')}</h1>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">KPI · stocks · exports (PDF/Excel/CSV)</p>
        </div>
        <Button variant="secondary" onClick={() => exportInvoicesCsv(invoices)}>
          <Download className="w-4 h-4" /> {t('exportCsv')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label={`${t('ca')} — ${t('month')}`} value={fmtXof(kpis.revenueMonth)} tone="success" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label={`${t('ca')} — ${t('week')}`} value={fmtXof(kpis.revenueWeek)} tone="primary" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label={t('avgTicket')} value={fmtXof(kpis.avgTicket)} tone="info" />
        <StatCard icon={<Package className="w-6 h-6" />} label={t('alerts')} value={String(kpis.lowStock)} tone={kpis.lowStock > 0 ? 'danger' : 'success'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <Card>
          <h2 className="font-bold mb-md">⚠️ {t('stockLow')}</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Aucun stock sous le seuil d'alerte ✅</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm p-2 rounded-sm bg-surface dark:bg-surface dark">
                  <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-danger" /> {p.name}</span>
                  <span className="font-bold tabular-nums">{p.current_stock} <span className="text-xs text-ink-secondary">/ seuil {p.alert_threshold}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-bold mb-md">🧾 {t('invoice')}s — {t('history')}</h2>
          <div className="max-h-80 overflow-y-auto flex flex-col gap-1.5">
            {invoices.slice(0, 20).map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm p-2 rounded-sm bg-surface dark:bg-surface dark">
                <span className="font-mono text-xs">{i.legal_sequential_number}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{fmtXof(i.total_amount)}</span>
                  <StatusBadge status={i.status} />
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
