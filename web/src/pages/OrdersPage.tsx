import React, { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Plus, HandCoins, Receipt } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getOrders, getProducts, createOrder, payOrderCash, getTables } from '../lib/api'
import { Button, Card, EmptyState, Input, Label, Modal, Select, Spinner, StatusBadge, useHasPermission } from '../components/ui'
import { fmtXof, fmtDateTime, uid } from '../lib/format'
import type { DiningTable, Order, Product } from '../lib/types'

export default function OrdersPage() {
  const { t } = useI18n()
  const canCreate = useHasPermission('orders.create')
  const canPay = useHasPermission('payments.take_cash')

  const [orders, setOrders] = useState<Order[] | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [payTarget, setPayTarget] = useState<Order | null>(null)
  const [tip, setTip] = useState('')

  const refresh = () => getOrders().then(setOrders)
  useEffect(() => { refresh() }, [])

  const open = orders?.filter((o) => !['PAID', 'CANCELLED'].includes(o.status)) ?? []
  const closed = orders?.filter((o) => ['PAID', 'CANCELLED'].includes(o.status)) ?? []

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('orders')}</h1>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">{open.length} en cours · {closed.length} clôturées</p>
        </div>
        {canCreate && <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4" /> {t('newOrder')}</Button>}
      </div>

      {!orders ? <Spinner /> : orders.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Aucune commande" subtitle="Prenez votre première commande : elle sera ventilée automatiquement entre le bar et la cuisine." action={canCreate ? <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4" /> {t('newOrder')}</Button> : undefined} /></Card>
      ) : (
        <div className="flex flex-col gap-md">
          <h2 className="font-bold text-lg">🟢 {t('pending')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
            {open.map((o) => (
              <Card key={o.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">#{o.dining_tables?.number ?? 'À emporter'}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{fmtDateTime(o.created_at)} · {o.source} · {o.offline_created ? '🛜 offline' : 'en ligne'}</p>
                <ul className="text-sm flex flex-col gap-0.5">
                  {(o.order_items ?? []).map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span>{it.products?.name ?? '—'} × {it.quantity}</span>
                      <span className="tabular-nums font-semibold">{fmtXof(it.unit_price * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between items-center border-t border-line dark:border-line dark pt-2">
                  <span className="font-bold tabular-nums">
                    {fmtXof((o.order_items ?? []).reduce((s, it) => s + it.unit_price * it.quantity, 0))}
                  </span>
                  {canPay && (
                    <Button variant="secondary" className="!h-9 !px-3 text-sm" onClick={() => { setPayTarget(o); setTip('') }}>
                      <HandCoins className="w-4 h-4" /> {t('pay')}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {closed.length > 0 && (
            <>
              <h2 className="font-bold text-lg mt-lg">✅ {t('paid')} / {t('cancelled')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md opacity-70">
                {closed.slice(0, 9).map((o) => (
                  <Card key={o.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">#{o.dining_tables?.number ?? 'À emporter'}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{fmtDateTime(o.created_at)}</p>
                    <p className="font-semibold tabular-nums">
                      {fmtXof((o.order_items ?? []).reduce((s, it) => s + it.unit_price * it.quantity, 0))}
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showNew && canCreate && <NewOrderModal onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); refresh() }} />}
      {payTarget && canPay && (
        <PayModal
          order={payTarget}
          onClose={() => setPayTarget(null)}
          tip={tip}
          setTip={setTip}
          onDone={() => { setPayTarget(null); refresh() }}
        />
      )}
    </div>
  )
}

function NewOrderModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [tables, setTables] = useState<DiningTable[]>([])
  const [tableId, setTableId] = useState('')
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getProducts(), getTables()]).then(([p, tb]) => { setProducts(p); setTables(tb) })
  }, [])

  const add = (p: Product) => {
    setCart((c) => {
      const found = c.find((x) => x.product.id === p.id)
      return found ? c.map((x) => (x.product.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { product: p, qty: 1 }]
    })
  }

  const total = cart.reduce((s, c) => s + c.product.price * c.qty, 0)

  const submit = async (offline: boolean) => {
    setSaving(true)
    await createOrder({
      table_id: tableId || null,
      offline,
      items: cart.map((c) => ({ product_id: c.product.id, quantity: c.qty, unit_price: c.product.price, section: c.product.section })),
    })
    setSaving(false)
    onDone()
  }

  return (
    <Modal title={t('newOrder')} onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <div>
          <Label>{t('tables')}</Label>
          <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">À emporter</option>
            {tables.filter((tb) => tb.status !== 'RESERVED').map((tb) => (
              <option key={tb.id} value={tb.id}>{tb.number} — {tb.status === 'OCCUPIED' ? t('occupied') : t('free')}</option>
            ))}
          </Select>

          <div className="mt-md max-h-72 overflow-y-auto flex flex-col gap-1">
            {products.map((p) => (
              <button key={p.id} onClick={() => add(p)} className="flex items-center justify-between p-2.5 rounded-sm hover:bg-primary-light dark:hover:bg-primary-dark text-left">
                <span className="text-sm font-medium truncate">{p.name} <span className="text-xs text-ink-secondary dark:text-ink-darkSecondary">({p.section})</span></span>
                <span className="text-sm font-bold tabular-nums shrink-0 ml-2">{fmtXof(p.price)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>{t('total')}</Label>
          <div className="card flex flex-col gap-2">
            {cart.length === 0 && <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Panier vide — touchez un produit.</p>}
            {cart.map((c) => (
              <div key={c.product.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{c.product.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <button className="w-7 h-7 rounded-sm bg-line dark:bg-line dark font-bold" onClick={() => setCart((cs) => cs.map((x) => (x.product.id === c.product.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</button>
                  <span className="w-6 text-center font-bold">{c.qty}</span>
                  <button className="w-7 h-7 rounded-sm bg-primary text-white font-bold" onClick={() => setCart((cs) => cs.map((x) => (x.product.id === c.product.id ? { ...x, qty: x.qty + 1 } : x)))}>+</button>
                </span>
              </div>
            ))}
            <div className="border-t border-line dark:border-line dark pt-2 flex justify-between font-bold">
              <span>{t('total')}</span>
              <span className="tabular-nums">{fmtXof(total)}</span>
            </div>
          </div>

          <div className="flex gap-md mt-lg">
            <Button variant="ghost" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
            <Button className="flex-1" disabled={cart.length === 0 || saving} loading={saving} onClick={() => submit(navigator.onLine ? false : true)}>
              {t('confirm')} ({fmtXof(total)})
            </Button>
          </div>
          {!navigator.onLine && (
            <p className="mt-2 text-xs text-warning font-semibold">🛜 Hors-ligne — la commande sera synchronisée à la reconnexion.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function PayModal({ order, onClose, tip, setTip, onDone }: {
  order: Order; onClose: () => void; tip: string; setTip: (s: string) => void; onDone: () => void
}) {
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [invoice, setInvoice] = useState<{ number: string; total: number; tax: number } | null>(null)

  const subtotal = order.order_items?.reduce((s, it) => s + it.unit_price * it.quantity, 0) ?? 0
  const tipN = Number(tip) || 0
  const total = subtotal + tipN

  const pay = async () => {
    setSaving(true)
    const res = await payOrderCash(order.id, total, tipN)
    setSaving(false)
    if (res.error) return
    if (res.invoice) setInvoice({ number: res.invoice.legal_sequential_number, total: res.invoice.total_amount, tax: res.invoice.tax_amount })
  }

  if (invoice) {
    return (
      <Modal title={t('invoice')} onClose={onDone}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center">
            <Receipt className="w-8 h-8" />
          </div>
          <p className="text-2xl font-bold tabular-nums">{fmtXof(invoice.total)}</p>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">TVA incluse : {fmtXof(invoice.tax)}</p>
          <p className="badge bg-primary-light dark:bg-primary-dark text-primary dark:text-primary dark font-mono">{invoice.number}</p>
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">Facture légale séquentielle — {t('paid')} ✓</p>
          <Button className="w-full mt-2" onClick={onDone}>{t('finish')}</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`${t('pay')} — #${order.dining_tables?.number ?? 'À emporter'}`} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <div className="card">
          <div className="flex justify-between text-sm"><span>Sous-total</span><span className="tabular-nums">{fmtXof(subtotal)}</span></div>
          <div className="flex justify-between text-sm mt-1"><span>💝 {t('tip') === 'Pourboire' ? 'Pourboire' : 'Tip'}</span><span className="tabular-nums">{fmtXof(tipN)}</span></div>
          <div className="flex justify-between font-bold text-lg border-t border-line dark:border-line dark mt-2 pt-2">
            <span>{t('total')}</span><span className="tabular-nums">{fmtXof(total)}</span>
          </div>
        </div>
        <div>
          <Label>💝 Pourboire (F)</Label>
          <Input type="number" inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0" />
        </div>
        <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">
          💵 {t('cash')} — le serveur valide le règlement. (Mobile money & carte : prochaine itération via Kkiapay/Moneroo/Cinetpay)
        </p>
        <div className="flex gap-md">
          <Button variant="ghost" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
          <Button className="flex-1" loading={saving} onClick={pay}>
            <HandCoins className="w-4 h-4" /> {t('confirm')} — {fmtXof(total)}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
