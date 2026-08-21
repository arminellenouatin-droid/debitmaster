import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, Check, ArrowLeft, QrCode } from 'lucide-react'
import { getMenuByTable, createQrOrder } from '../lib/api'
import { Button, Spinner } from '../components/ui'
import { fmtXof } from '../lib/format'
import type { MenuItem } from '../lib/types'

/** Menu QR client — page publique (scan du QR posé sur la table). */
export default function QrMenuPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const [state, setState] = useState<{ loading: boolean; table: { number: string; status: string; qr_enabled: boolean } | null; items: MenuItem[] }>({ loading: true, table: null, items: [] })
  const [cart, setCart] = useState<Record<string, number>>({})
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!tableId) return
    getMenuByTable(tableId).then((res) => setState({ loading: false, table: res.table ?? null, items: res.items }))
  }, [tableId])

  if (state.loading) return <Spinner />
  if (!state.table) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-md text-center">
        <QrCode className="w-12 h-12 text-ink-secondary" />
        <p className="font-bold text-lg">Table introuvable</p>
        <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Vérifiez le QR code avec le personnel.</p>
        <Link to="/" className="text-primary font-semibold text-sm">← Retour à l'accueil</Link>
      </div>
    )
  }

  const categories = [...new Set(state.items.map((i) => i.category))]
  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  const sub = (id: string) => setCart((c) => {
    const q = (c[id] ?? 0) - 1
    const n = { ...c }
    if (q <= 0) delete n[id]; else n[id] = q
    return n
  })
  const total = Object.entries(cart).reduce((s, [id, q]) => {
    const item = state.items.find((i) => i.product_id === id)
    return s + (item?.price ?? 0) * q
  }, 0)

  const order = async () => {
    if (!tableId) return
    const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }))
    const res = await createQrOrder(tableId, items)
    if (!res.error) setSent(true)
  }

  return (
    <div className="min-h-screen bg-bg dark:bg-bg dark max-w-md mx-auto px-md pb-xxl">
      <header className="flex items-center gap-3 py-md">
        <Link to="/" className="p-2 rounded-sm hover:bg-surface"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <p className="font-bold text-lg">🍽️ Menu — Table {state.table.number}</p>
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">Commandez directement, on vous sert !</p>
        </div>
      </header>

      {sent ? (
        <div className="card flex flex-col items-center gap-3 text-center py-xl">
          <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center"><Check className="w-8 h-8" /></div>
          <p className="text-xl font-bold">Commande envoyée ! 🎉</p>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Le personnel a reçu votre commande. Vous pouvez en passer une autre.</p>
          <Button onClick={() => { setSent(false); setCart({}) }}>Nouvelle commande</Button>
        </div>
      ) : (
        <>
          {categories.map((cat) => (
            <section key={cat} className="mb-lg">
              <h2 className="font-bold text-primary dark:text-primary dark mb-2">{cat}</h2>
              <div className="flex flex-col gap-2">
                {state.items.filter((i) => i.category === cat).map((i) => (
                  <div key={i.product_id} className="card flex items-center justify-between gap-2 !p-md">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{i.name}</p>
                      <p className="text-sm font-bold tabular-nums">{fmtXof(i.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(cart[i.product_id] ?? 0) > 0 && (
                        <>
                          <button className="w-9 h-9 rounded-sm bg-line dark:bg-line dark font-bold" onClick={() => sub(i.product_id)}>−</button>
                          <span className="w-6 text-center font-bold">{cart[i.product_id]}</span>
                        </>
                      )}
                      <button className="w-9 h-9 rounded-sm bg-primary text-white flex items-center justify-center" onClick={() => add(i.product_id)}>
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {total > 0 && (
            <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-md bg-surface dark:bg-surface dark border-t border-line dark:border-line dark">
              <Button className="w-full" onClick={order}>
                <ShoppingCart className="w-4 h-4" /> Commander — {fmtXof(total)}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
