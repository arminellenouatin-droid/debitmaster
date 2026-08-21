import React, { useEffect, useState } from 'react'
import { Truck, PackagePlus, ClipboardCheck, Boxes, Plus, Check, PackageOpen } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import {
  getSuppliers, createSupplier, getPurchaseOrders, createPurchaseOrder,
  validatePurchaseOrder, receivePurchaseOrder,
  getInventories, startInventory, saveInventoryLine, completeInventory,
  getProducts,
} from '../lib/api'
import { Button, Card, EmptyState, Input, Label, Modal, Select, Spinner, StatusBadge, useHasPermission } from '../components/ui'
import { fmtXof, fmtDateTime } from '../lib/format'
import type { Inventory, Product, PurchaseOrder, Supplier } from '../lib/types'

type Tab = 'po' | 'suppliers' | 'inventory'

export default function ProcurementPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('po')
  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-2xl font-bold">{t('procurement')}</h1>
        <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">{t('procurementSub')}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['po', 'suppliers', 'inventory'] as Tab[]).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2 rounded-sm font-semibold text-sm ${tab === tb ? 'bg-primary text-white' : 'bg-surface dark:bg-surface dark border border-line dark:border-line dark'}`}>
            {tb === 'po' ? t('purchaseOrders') : tb === 'suppliers' ? t('suppliers') : t('inventory')}
          </button>
        ))}
      </div>
      {tab === 'po' && <PurchaseOrdersTab />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'inventory' && <InventoryTab />}
    </div>
  )
}

function SuppliersTab() {
  const { t } = useI18n()
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const refresh = () => getSuppliers().then(setSuppliers)
  useEffect(() => { refresh() }, [])

  const add = async () => {
    if (!name.trim()) return
    await createSupplier({ name, phone: phone || undefined })
    setShow(false); setName(''); setPhone('')
    refresh()
  }

  if (!suppliers) return <Spinner />
  return (
    <Card>
      <div className="flex items-center justify-between mb-md">
        <h2 className="font-bold">{t('suppliers')} ({suppliers.length})</h2>
        <Button className="!h-10 !px-3 text-sm" onClick={() => setShow(true)}><Plus className="w-4 h-4" /> {t('addSupplier')}</Button>
      </div>
      {suppliers.length === 0 ? (
        <EmptyState icon={<Truck className="w-8 h-8" />} title="Aucun fournisseur" subtitle="Ajoutez vos fournisseurs pour générer des bons de commande." />
      ) : (
        <ul className="flex flex-col gap-2">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center justify-between p-3 rounded-sm bg-surface dark:bg-surface dark">
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{s.phone ?? '—'} · Livraison moy. : {s.average_delivery_days ?? '—'} j</p>
              </div>
              <Truck className="w-4 h-4 text-ink-secondary" />
            </li>
          ))}
        </ul>
      )}
      {show && (
        <Modal title={t('addSupplier')} onClose={() => setShow(false)}>
          <div className="flex flex-col gap-md">
            <div><Label>{t('name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>{t('phone')}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="flex gap-md">
              <Button variant="ghost" className="flex-1" onClick={() => setShow(false)}>{t('cancel')}</Button>
              <Button className="flex-1" onClick={add}>{t('create')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  )
}

function PurchaseOrdersTab() {
  const { t } = useI18n()
  const canValidate = useHasPermission('purchase_order.validate')
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [show, setShow] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([])

  const refresh = () => getPurchaseOrders().then(setPos)
  useEffect(() => {
    refresh()
    Promise.all([getSuppliers(), getProducts()]).then(([s, p]) => { setSuppliers(s); setProducts(p) })
  }, [])

  const addItem = (p: Product) => {
    setCart((c) => {
      const f = c.find((x) => x.product.id === p.id)
      return f ? c.map((x) => (x.product.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { product: p, qty: 10 }]
    })
  }

  const submit = async () => {
    if (!supplierId || cart.length === 0) return
    await createPurchaseOrder({
      supplier_id: supplierId,
      items: cart.map((c) => ({ product_id: c.product.id, quantity: c.qty, unit_price: c.product.price })),
    })
    setShow(false); setCart([]); setSupplierId('')
    refresh()
  }

  if (!pos) return <Spinner />
  return (
    <div className="flex flex-col gap-md">
      <div className="flex justify-end">
        <Button className="!h-10 !px-3 text-sm" onClick={() => setShow(true)}><Plus className="w-4 h-4" /> {t('newPurchaseOrder')}</Button>
      </div>
      {pos.length === 0 ? (
        <Card><EmptyState icon={<PackagePlus className="w-8 h-8" />} title="Aucun bon de commande" subtitle="Créez un bon à partir d'une alerte de stock, faites-le valider, puis réceptionnez." /></Card>
      ) : (
        pos.map((po) => (
          <Card key={po.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">📦 {po.suppliers?.name ?? 'Fournisseur inconnu'}</p>
                <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{fmtDateTime(po.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={po.status} />
                {po.status === 'DRAFT' && canValidate && (
                  <Button variant="secondary" className="!h-9 !px-3 text-sm" onClick={async () => { await validatePurchaseOrder(po.id); refresh() }}>
                    <Check className="w-4 h-4" /> {t('validate')}
                  </Button>
                )}
                {po.status === 'VALIDATED' && (
                  <Button className="!h-9 !px-3 text-sm" onClick={async () => { await receivePurchaseOrder(po.id); refresh() }}>
                    <PackageOpen className="w-4 h-4" /> {t('receive')}
                  </Button>
                )}
              </div>
            </div>
            <ul className="text-sm flex flex-col gap-0.5">
              {(po.purchase_order_items ?? []).map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.products?.name ?? '—'} × {it.quantity_ordered}</span>
                  <span className="tabular-nums font-semibold">{fmtXof(it.unit_price * it.quantity_ordered)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      {show && (
        <Modal title={t('newPurchaseOrder')} onClose={() => setShow(false)} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <Label>{t('suppliers')}</Label>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <div className="mt-md max-h-60 overflow-y-auto flex flex-col gap-1">
                {products.filter((p) => p.current_stock <= p.alert_threshold).length > 0 && (
                  <p className="text-xs font-bold text-danger mb-1">⚠️ {t('stockLow')} :</p>
                )}
                {products.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)} className="flex justify-between items-center p-2 rounded-sm hover:bg-primary-light dark:hover:bg-primary-dark text-left">
                    <span className="text-sm truncate">{p.name} <span className="text-xs text-ink-secondary">(stock {p.current_stock})</span></span>
                    <span className="text-sm font-semibold tabular-nums shrink-0 ml-2">{fmtXof(p.price)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t('items')}</Label>
              <div className="card flex flex-col gap-2">
                {cart.length === 0 && <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Panier vide.</p>}
                {cart.map((c) => (
                  <div key={c.product.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{c.product.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <button className="w-7 h-7 rounded-sm bg-line dark:bg-line dark font-bold" onClick={() => setCart((cs) => cs.map((x) => (x.product.id === c.product.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</button>
                      <span className="w-8 text-center font-bold">{c.qty}</span>
                      <button className="w-7 h-7 rounded-sm bg-primary text-white font-bold" onClick={() => setCart((cs) => cs.map((x) => (x.product.id === c.product.id ? { ...x, qty: x.qty + 1 } : x)))}>+</button>
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-md mt-lg">
                <Button variant="ghost" className="flex-1" onClick={() => setShow(false)}>{t('cancel')}</Button>
                <Button className="flex-1" disabled={!supplierId || cart.length === 0} onClick={submit}>{t('create')}</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function InventoryTab() {
  const { t } = useI18n()
  const [inventories, setInventories] = useState<Inventory[] | null>(null)

  const refresh = () => getInventories().then(setInventories)
  useEffect(() => { refresh() }, [])

  if (!inventories) return <Spinner />

  return (
    <div className="flex flex-col gap-md">
      <div className="flex justify-end">
        <Button className="!h-10 !px-3 text-sm" onClick={async () => { await startInventory(); refresh() }}>
          <Boxes className="w-4 h-4" /> {t('startInventory')}
        </Button>
      </div>
      {inventories.length === 0 ? (
        <Card><EmptyState icon={<ClipboardCheck className="w-8 h-8" />} title="Aucun inventaire" subtitle="Démarrez un inventaire : saisissez les quantités réelles, le système calcule les écarts." /></Card>
      ) : (
        inventories.map((inv) => (
          <Card key={inv.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">📋 {t('inventory')} — {fmtDateTime(inv.performed_at)}</p>
                <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{inv.inventory_lines?.length ?? 0} produits</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={inv.status} />
                {inv.status === 'IN_PROGRESS' && (
                  <Button className="!h-9 !px-3 text-sm" onClick={async () => { await completeInventory(inv.id); refresh() }}>
                    <Check className="w-4 h-4" /> {t('complete')}
                  </Button>
                )}
              </div>
            </div>
            {inv.status === 'IN_PROGRESS' && (
              <ul className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                {(inv.inventory_lines ?? []).map((l) => (
                  <li key={l.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate">{l.products?.name ?? '—'}</span>
                    <span className="text-xs text-ink-secondary dark:text-ink-darkSecondary">théo : {l.theoretical_quantity}</span>
                    <input
                      type="number"
                      className="input !h-9 w-20 text-sm"
                      value={l.actual_quantity ?? l.theoretical_quantity}
                      onChange={(e) => { const v = Number(e.target.value) || 0; saveInventoryLine(l.id, v); refresh() }}
                    />
                    <span className={`font-bold tabular-nums w-16 text-right ${(l.discrepancy ?? 0) !== 0 ? 'text-danger' : 'text-success'}`}>
                      {(l.discrepancy ?? 0) > 0 ? '+' : ''}{l.discrepancy ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {inv.status === 'COMPLETED' && (
              <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                {(inv.inventory_lines ?? []).filter((l) => (l.discrepancy ?? 0) !== 0).slice(0, 15).map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-sm p-2 rounded-sm bg-surface dark:bg-surface dark">
                    <span className="truncate">{l.products?.name ?? '—'}</span>
                    <span className={`badge ${l.interpretation === 'PROBABLE_THEFT' ? 'bg-danger/10 text-danger dark:text-danger dark' : l.interpretation === 'PROBABLE_LOSS' ? 'bg-warning/10 text-warning dark:text-warning dark' : 'bg-info/10 text-info dark:text-info dark'}`}>
                      {l.interpretation?.replace(/_/g, ' ')} ({l.discrepancy})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
