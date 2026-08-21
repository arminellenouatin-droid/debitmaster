import React, { useEffect, useState } from 'react'
import { Users, Plus } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getEmployees, createEmployee } from '../lib/api'
import { Button, Card, EmptyState, Input, Label, Modal, Select, Spinner, StatusBadge, useHasPermission } from '../components/ui'
import { fmtXof } from '../lib/format'
import type { Employee } from '../lib/types'

const ROLES = [
  'PROMOTEUR', 'ADMINISTRATEUR', 'GERANT_SUPERVISEUR', 'SERVEUR', 'BAR_MAN',
  'CUISINIER', 'CHEF_CUISINE', 'MAGASINIER', 'APPROVISIONNEMENT', 'COMPTABLE', 'SECRETAIRE',
]

export default function StaffPage() {
  const { t } = useI18n()
  const canCreate = useHasPermission('employees.create')
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', position: 'SERVEUR', salary: '90000' })
  const [saving, setSaving] = useState(false)

  const refresh = () => getEmployees().then(setEmployees)
  useEffect(() => { refresh() }, [])

  const add = async () => {
    setSaving(true)
    await createEmployee({ firstName: form.firstName, lastName: form.lastName, phone: form.phone, position: form.position, monthlySalary: Number(form.salary) || 0 })
    setSaving(false)
    setShowCreate(false)
    setForm({ firstName: '', lastName: '', phone: '', position: 'SERVEUR', salary: '90000' })
    refresh()
  }

  if (!employees) return <Spinner />

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('staff')}</h1>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">{employees.length} employés · {ROLES.length} profils prédéfinis</p>
        </div>
        {canCreate && <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {t('addEmployee')}</Button>}
      </div>

      {employees.length === 0 ? (
        <Card><EmptyState icon={<Users className="w-8 h-8" />} title="Aucun employé" subtitle="Créez les comptes de votre équipe : serveurs, barman, cuisinier, comptable…" action={canCreate ? <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {t('addEmployee')}</Button> : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          {employees.map((e) => (
            <Card key={e.id} className="flex items-center gap-md">
              <div className="w-11 h-11 rounded-full bg-primary-light dark:bg-primary-dark text-primary flex items-center justify-center font-bold shrink-0">
                {(e.first_name ?? '?').slice(0, 1)}{(e.last_name ?? '').slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{e.first_name} {e.last_name}</p>
                <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{e.position?.replace(/_/g, ' ') ?? '—'}</p>
                <p className="text-xs font-semibold tabular-nums">{e.monthly_salary ? fmtXof(e.monthly_salary) : '—'} /mois</p>
              </div>
              <StatusBadge status={e.status} />
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title={t('addEmployee')} onClose={() => setShowCreate(false)}>
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-2 gap-md">
              <div><Label>{t('firstName')}</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><Label>{t('lastName')}</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            </div>
            <div><Label>{t('phone')}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+229 01 23 45 67" /></div>
            <div>
              <Label>{t('position')}</Label>
              <Select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
            <div><Label>{t('salary')} (F/mois)</Label><Input type="number" inputMode="numeric" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
            <div className="flex gap-md">
              <Button variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>{t('cancel')}</Button>
              <Button className="flex-1" loading={saving} onClick={add}>{t('create')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
