import React, { useEffect, useState } from 'react'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getAttendance, checkIn, checkOut } from '../lib/api'
import { Button, Card, EmptyState, Spinner, StatusBadge } from '../components/ui'
import { fmtDateTime } from '../lib/format'
import type { AttendanceRecord } from '../lib/types'

export default function AttendancePage() {
  const { t } = useI18n()
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => getAttendance().then(setRecords)
  useEffect(() => { refresh() }, [])

  const doIn = async () => {
    setBusy(true); setErr(null); setMsg(null)
    const res = await checkIn()
    setBusy(false)
    if (res.error) setErr(res.error)
    else { setMsg(res.status === 'LATE' ? 'Pointé en retard ⏰' : 'Pointé à l\'heure ✅'); refresh() }
  }

  const doOut = async () => {
    setBusy(true); setErr(null)
    await checkOut()
    setBusy(false)
    setMsg('Sortie pointée ✅')
    refresh()
  }

  if (!records) return <Spinner />

  const today = new Date().toISOString().slice(0, 10)
  const openToday = records.find((r) => r.check_in_at.slice(0, 10) === today && !r.check_out_at)

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-2xl font-bold">{t('attendance')}</h1>
        <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
          {t('checkInGeo')} — badgeage automatique à la connexion (GPS)
        </p>
      </div>

      {/* Action badgeage */}
      <Card className="flex flex-col sm:flex-row items-center gap-md justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-primary-light dark:bg-primary-dark text-primary"><Clock className="w-7 h-7" /></div>
          <div>
            <p className="font-bold">{openToday ? 'Service en cours…' : 'Prêt à pointer'}</p>
            <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">
              {openToday ? `Pointé à ${fmtDateTime(openToday.check_in_at)}` : 'Géolocalisation vérifiée automatiquement'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {!openToday ? (
            <Button className="flex-1 sm:flex-none" loading={busy} onClick={doIn}>
              <LogIn className="w-4 h-4" /> {t('checkIn')}
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1 sm:flex-none" loading={busy} onClick={doOut}>
              <LogOut className="w-4 h-4" /> {t('checkOut')}
            </Button>
          )}
        </div>
      </Card>

      {msg && <p className="text-sm font-semibold text-success">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {/* Historique */}
      <Card>
        <h2 className="font-bold mb-md">{t('history')}</h2>
        {records.length === 0 ? (
          <EmptyState icon={<Clock className="w-8 h-8" />} title="Aucune présence" subtitle="Vos pointages apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-secondary dark:text-ink-darkSecondary border-b border-line dark:border-line dark">
                  <th className="py-2 pr-3">Employé</th>
                  <th className="py-2 pr-3">{t('position')}</th>
                  <th className="py-2 pr-3">{t('checkIn')}</th>
                  <th className="py-2 pr-3">{t('checkOut')}</th>
                  <th className="py-2 pr-3">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-line/60 dark:border-line dark/60">
                    <td className="py-2 pr-3 font-semibold">{r.first_name} {r.last_name}</td>
                    <td className="py-2 pr-3">{r.position?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtDateTime(r.check_in_at)}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.check_out_at ? fmtDateTime(r.check_out_at) : '—'}</td>
                    <td className="py-2 pr-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
