import React, { useEffect, useMemo, useState } from 'react'
import { Wallet, Sparkles, CheckCircle2, HandCoins } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getEmployees, getPayrolls, preparePayrolls, suggestBonuses, validatePayrolls, payPayrolls } from '../lib/api'
import { Button, Card, EmptyState, Spinner, StatusBadge, useHasPermission } from '../components/ui'
import { fmtXof } from '../lib/format'
import type { Payroll } from '../lib/types'

export default function PayrollPage() {
  const { t } = useI18n()
  const canValidate = useHasPermission('payroll.validate')
  const [payrolls, setPayrolls] = useState<Payroll[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const refresh = () => getPayrolls().then(setPayrolls)
  useEffect(() => { refresh() }, [])

  const period = useMemo(() => payrolls?.filter((p) => p.period_month === month && p.period_year === year) ?? [], [payrolls, month, year])
  const prepared = period.filter((p) => p.status === 'DRAFT')
  const validated = period.filter((p) => p.status === 'VALIDATED')
  const paid = period.filter((p) => p.status === 'PAID')

  const run = async (key: string, fn: () => Promise<{ error?: string; created?: number }>) => {
    setBusy(key)
    await fn()
    setBusy(null)
    refresh()
  }

  if (!payrolls) return <Spinner />

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-2xl font-bold">{t('payroll')}</h1>
        <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
          Période : {month}/{year} — {t('payrollFlow')}
        </p>
      </div>

      {/* Workflow paie */}
      <div className="grid grid-cols-3 gap-md">
        <Card className="text-center">
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{t('prepare')}</p>
          <p className="text-xl font-bold text-info dark:text-info dark">{prepared.length}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{t('validate')}</p>
          <p className="text-xl font-bold text-warning dark:text-warning dark">{validated.length}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{t('paid')}</p>
          <p className="text-xl font-bold text-success dark:text-success dark">{paid.length}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button loading={busy === 'prepare'} onClick={() => run('prepare', () => preparePayrolls(month, year))}>
          <Wallet className="w-4 h-4" /> {t('preparePayroll')}
        </Button>
        <Button variant="secondary" loading={busy === 'bonus'} onClick={() => run('bonus', () => suggestBonuses(month, year))}>
          <Sparkles className="w-4 h-4" /> {t('suggestBonuses')}
        </Button>
        {canValidate && (
          <>
            <Button variant="secondary" loading={busy === 'validate'} onClick={() => run('validate', () => validatePayrolls(month, year))}>
              <CheckCircle2 className="w-4 h-4" /> {t('validate')}
            </Button>
            <Button loading={busy === 'pay'} onClick={() => run('pay', () => payPayrolls(month, year))}>
              <HandCoins className="w-4 h-4" /> {t('payPayroll')}
            </Button>
          </>
        )}
      </div>

      {/* Détail du mois */}
      <Card>
        <h2 className="font-bold mb-md">{t('payroll')} — {month}/{year}</h2>
        {period.length === 0 ? (
          <EmptyState icon={<Wallet className="w-8 h-8" />} title="Paie non préparée" subtitle="Cliquez sur « Préparer la paie » : le comptable prépare, le promoteur valide, puis paiement mobile money." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-secondary dark:text-ink-darkSecondary border-b border-line dark:border-line dark">
                  <th className="py-2 pr-3">Employé</th>
                  <th className="py-2 pr-3">{t('position')}</th>
                  <th className="py-2 pr-3">{t('baseSalary')}</th>
                  <th className="py-2 pr-3">{t('bonus')}</th>
                  <th className="py-2 pr-3">{t('total')}</th>
                  <th className="py-2 pr-3">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {period.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 dark:border-line dark/60">
                    <td className="py-2 pr-3 font-semibold">{p.first_name} {p.last_name}</td>
                    <td className="py-2 pr-3">{p.position?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtXof(p.base_amount)}</td>
                    <td className="py-2 pr-3 tabular-nums text-success dark:text-success dark">{p.bonus_amount ? `+${fmtXof(p.bonus_amount)}` : '—'}</td>
                    <td className="py-2 pr-3 tabular-nums font-bold">{fmtXof(p.total_amount)}</td>
                    <td className="py-2 pr-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Historique */}
      <Card>
        <h2 className="font-bold mb-md">{t('history')}</h2>
        {payrolls.length === 0 ? (
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Aucun bulletin pour l'instant.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {payrolls.slice(0, 10).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm p-2 rounded-sm bg-surface dark:bg-surface dark">
                <span>{p.first_name} {p.last_name} — {p.period_month}/{p.period_year}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{fmtXof(p.total_amount)}</span>
                  <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
