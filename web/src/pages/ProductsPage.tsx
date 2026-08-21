import React, { useEffect, useState } from 'react'
import { Package, Plus, Pencil, AlertTriangle } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getProducts, createProduct, updateProduct, recordStockMovement, getCategories, getTypes, getUnits } from '../lib/api'
import { Button, Card, EmptyState, Input, Label, Modal, Select, Spinner, useHasPermission } from '../components/ui'
import { fmtXof } from '../lib/format'
import type { Category, Product, ProductType, Section, Unit } from '../lib/types'

const emptyForm = {
  name: '', price: '', category_id: '', type_id: '', unit_id: '',
  alert_threshold: '', safety_threshold: '', current_stock: '', section: 'BAR' as Section,
}

export default function ProductsPage() {
  const { t } = useI18n()
  const canManage = useHasPermission('products.manage')
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [types, setTypes] = useState<ProductType[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [modal, setModal] = useState<null | 'create' | 'stock'>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = () => getProducts().then(setProducts)
  useEffect(() => {
    refresh()
    Promise.all([getCategories(), getTypes(), getUnits()]).then(([c, ty, u]) => { setCategories(c); setTypes(ty); setUnits(u) })
  }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal('create') }
  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name, price: String(p.price), category_id: p.category_id ?? '', type_id: p.type_id ?? '',
      unit_id: p.unit_id ?? '', alert_threshold: String(p.alert_threshold),
      safety_threshold: String(p.safety_threshold), current_stock: String(p.current_stock), section: p.section,
    })
    setModal('create')
  }

  const save = async () => {
    setSaving(true); setError(null)
    const payload = {
      name: form.name,
      price: Number(form.price) || 0,
      category_id: form.category_id || undefined,
      type_id: form.type_id || undefined,
      unit_id: form.unit_id || undefined,
      alert_threshold: Number(form.alert_threshold) || 0,
      safety_threshold: Number(form.safety_threshold) || 0,
      section: form.section,
      current_stock: Number(form.current_stock) || 0,
    }
    const res = editing
      ? await updateProduct(editing.id, payload)
      : await createProduct(payload)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setModal(null); refresh()
  }

  const adjustStock = async (p: Product, delta: number) => {
    await recordStockMovement({
      product_id: p.id,
      movement_type: delta > 0 ? 'IN_PURCHASE' : 'OUT_LOSS',
      quantity: delta,
      reason: delta > 0 ? 'Réapprovisionnement' : 'Perte/casse',
    })
    refresh()
  }

  if (!products) return <Spinner />

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('products')}</h1>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">{products.length} produits · {fmtXof(products.reduce((s, p) => s + p.price, 0))} de catalogue</p>
        </div>
        {canManage && <Button onClick={openCreate}><Plus className="w-4 h-4" /> {t('create')}</Button>}
      </div>

      {products.length === 0 ? (
        <Card><EmptyState icon={<Package className="w-8 h-8" />} title="Aucun produit" subtitle="Ajoutez votre premier produit (boisson ou plat) pour commencer à prendre des commandes." action={canManage ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> {t('create')}</Button> : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-primary-light dark:bg-primary-dark text-primary flex items-center justify-center font-bold shrink-0">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{p.name}</p>
                    <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">
                      {p.categories?.name ?? '—'} · {p.units?.name ?? '—'} · {p.section}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => openEdit(p)} className="p-2 rounded-sm hover:bg-surface" aria-label={t('edit')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-lg font-bold tabular-nums">{fmtXof(p.price)}</span>
                <span className={`badge ${p.current_stock <= p.alert_threshold ? 'bg-danger/10 text-danger dark:text-danger dark' : 'bg-success/10 text-success dark:text-success dark'}`}>
                  <AlertTriangle className="w-3 h-3" /> {p.current_stock} {p.units?.name ?? ''}
                </span>
              </div>

              {canManage && (
                <div className="flex gap-2">
                  <button className="btn-secondary !h-10 !px-3 text-sm flex-1" onClick={() => adjustStock(p, 10)}>+ Réappro</button>
                  <button className="btn-ghost !h-10 !px-3 text-sm flex-1" onClick={() => adjustStock(p, -1)}>− Perte</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {modal === 'create' && (
        <Modal title={editing ? `${t('edit')} ${t('product')}` : `${t('create')} ${t('product')}`} onClose={() => setModal(null)} wide>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <div className="sm:col-span-2">
              <Label>{t('name')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Coca-Cola 33cl" />
            </div>
            <div>
              <Label>{t('price')} (F)</Label>
              <Input type="number" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label>{t('category')}</Label>
              <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t('type')}</Label>
              <Select value={form.type_id} onChange={(e) => setForm({ ...form, type_id: e.target.value })}>
                <option value="">—</option>
                {types.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t('unit')}</Label>
              <Select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
                <option value="">—</option>
                {units.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t('threshold')}</Label>
              <Input type="number" inputMode="numeric" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })} />
            </div>
            <div>
              <Label>{t('securityThreshold')}</Label>
              <Input type="number" inputMode="numeric" value={form.safety_threshold} onChange={(e) => setForm({ ...form, safety_threshold: e.target.value })} />
            </div>
            <div>
              <Label>{t('stock')}</Label>
              <Input type="number" inputMode="numeric" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
            </div>
            <div>
              <Label>Section</Label>
              <Select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value as Section })}>
                <option value="BAR">Bar</option>
                <option value="KITCHEN">Cuisine</option>
              </Select>
            </div>
          </div>
          {error && <p className="mt-md text-sm text-danger font-semibold">{error}</p>}
          <div className="flex gap-md mt-lg">
            <Button variant="ghost" className="flex-1" onClick={() => setModal(null)}>{t('cancel')}</Button>
            <Button className="flex-1" loading={saving} onClick={save}>{t('save')}</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
