import React, { useEffect, useState } from 'react'
import { Grid3x3, Plus } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getTables, updateTableStatus, createTable } from '../lib/api'
import { Button, Card, EmptyState, Input, Label, Modal, Spinner, StatusBadge, useHasPermission } from '../components/ui'
import type { DiningTable } from '../lib/types'

const NEXT: Record<string, DiningTable['status']> = {
  FREE: 'OCCUPIED', OCCUPIED: 'TO_CLEAN', TO_CLEAN: 'FREE', RESERVED: 'OCCUPIED',
}

export default function TablesPage() {
  const { t } = useI18n()
  const canConfigure = useHasPermission('tables.configure_plan')
  const [tables, setTables] = useState<DiningTable[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [num, setNum] = useState('')
  const [zone, setZone] = useState('')
  const [capacity, setCapacity] = useState('4')

  const refresh = () => getTables().then(setTables)
  useEffect(() => { refresh() }, [])

  const cycle = async (tb: DiningTable) => {
    await updateTableStatus(tb.id, NEXT[tb.status] ?? 'FREE')
    refresh()
  }

  const add = async () => {
    if (!num.trim()) return
    await createTable({ number: num.trim(), zone: zone || undefined, capacity: Number(capacity) || 4 })
    setShowCreate(false); setNum(''); setZone(''); setCapacity('4')
    refresh()
  }

  if (!tables) return <Spinner />

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('tables')}</h1>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
            {tables.filter((tb) => tb.status === 'OCCUPIED').length} occupées · {tables.filter((tb) => tb.status === 'FREE').length} libres
          </p>
        </div>
        {canConfigure && <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {t('create')}</Button>}
      </div>

      {tables.length === 0 ? (
        <Card><EmptyState icon={<Grid3x3 className="w-8 h-8" />} title="Aucune table" subtitle="Configurez votre plan de salle : zones, tables et capacité." action={canConfigure ? <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {t('create')}</Button> : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-md">
          {tables.map((tb) => (
            <button key={tb.id} onClick={() => cycle(tb)} className={`card flex flex-col items-center gap-2 !p-lg transition-all border-2 ${
              tb.status === 'FREE' ? 'border-success/40' : tb.status === 'OCCUPIED' ? 'border-warning/60' : tb.status === 'RESERVED' ? 'border-info/60' : 'border-warning/40'
            }`}>
              <span className="text-3xl font-bold">{tb.number}</span>
              <StatusBadge status={tb.status} label={t(tb.status.toLowerCase() as never)} />
              <span className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{tb.zone ?? '—'} · {tb.capacity} pers.</span>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title={`${t('create')} — ${t('tables')}`} onClose={() => setShowCreate(false)}>
          <div className="flex flex-col gap-md">
            <div>
              <Label>{t('name')}</Label>
              <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="T5" />
            </div>
            <div>
              <Label>Zone</Label>
              <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Terrasse" />
            </div>
            <div>
              <Label>Capacité</Label>
              <Input type="number" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="flex gap-md">
              <Button variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>{t('cancel')}</Button>
              <Button className="flex-1" onClick={add}>{t('create')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
