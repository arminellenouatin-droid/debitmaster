// ============================================================================
// Mode démo : persistance localStorage + données factices.
// Permet de parcourir l'application sans backend Supabase (prévisualisation).
// En mode réel (Supabase configuré), ce module n'est pas utilisé.
// ============================================================================
import type {
  AffiliateInfo, Category, Company, DiningTable, Invoice, Kpis, Notification,
  Order, Pricing, Product, Profile, ProductType, PublicPlans, Unit,
} from './types'
import { uid } from './format'

const KEY = 'dm.demo.v1'

interface DemoDb {
  profile: Profile | null
  company: Company | null
  products: Product[]
  tables: DiningTable[]
  orders: Order[]
  invoices: Invoice[]
  notifications: Notification[]
  affiliate: AffiliateInfo | null
  syncQueue: { id: string; kind: string; at: string }[]
}

const seedPricing: Pricing = {
  currency: 'XOF',
  plans: [
    { plan: 'BASE', months: 1, prices: { BUVETTE: 50000, BAR_RESTAURANT: 75000, NIGHTCLUB_LOUNGE: 100000 } },
    { plan: 'MOYENNE', months: 3, prices: { BUVETTE: 130000, BAR_RESTAURANT: 195000, NIGHTCLUB_LOUNGE: 260000 } },
    { plan: 'SEMESTRIELLE', months: 6, prices: { BUVETTE: 240000, BAR_RESTAURANT: 360000, NIGHTCLUB_LOUNGE: 480000 } },
    { plan: 'SUPREME', months: 12, prices: { BUVETTE: 400000, BAR_RESTAURANT: 600000, NIGHTCLUB_LOUNGE: 800000 } },
  ],
  coefficients: { BUVETTE: 1, BAR_RESTAURANT: 1.5, NIGHTCLUB_LOUNGE: 2 },
}

const seedCategories: Category[] = [
  { id: 'c1', tenant_id: null, name: 'Bières' },
  { id: 'c2', tenant_id: null, name: 'Sucreries' },
  { id: 'c3', tenant_id: null, name: 'Énergisantes' },
  { id: 'c4', tenant_id: null, name: 'Spiritueux' },
  { id: 'c5', tenant_id: null, name: 'Repas' },
]
const seedTypes: ProductType[] = [
  { id: 't1', tenant_id: null, name: '33cl' }, { id: 't2', tenant_id: null, name: '50cl' },
  { id: 't3', tenant_id: null, name: '1 litre' }, { id: 't4', tenant_id: null, name: 'Dose' },
  { id: 't5', tenant_id: null, name: 'Plat' },
]
const seedUnits: Unit[] = [
  { id: 'u1', tenant_id: null, name: 'Bouteille' }, { id: 'u2', tenant_id: null, name: 'Plat' },
  { id: 'u3', tenant_id: null, name: 'Conso' }, { id: 'u4', tenant_id: null, name: 'Dose' },
  { id: 'u5', tenant_id: null, name: 'Tasse' }, { id: 'u6', tenant_id: null, name: 'Unité' },
]

function load(): DemoDb {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try { return JSON.parse(raw) as DemoDb } catch { /* ignore */ }
  }
  const db: DemoDb = {
    profile: null,
    company: null,
    products: [],
    tables: [],
    orders: [],
    invoices: [],
    notifications: [
      { id: uid(), content: 'Bienvenue sur DebitManager 👋', event_type: 'WELCOME', read_at: null, created_at: new Date().toISOString() },
    ],
    affiliate: null,
    syncQueue: [],
  }
  save(db)
  return db
}

function save(db: DemoDb) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

export const demoApi = {
  load, save,

  seedCompany(company: Company) {
    const db = load()
    db.company = company
    if (db.profile) db.profile.tenant_id = company.id
    if (db.products.length === 0) {
      db.products = [
        { id: uid(), tenant_id: company.id, name: 'Coca-Cola 33cl', category_id: 'c2', type_id: 't1', unit_id: 'u3', price: 500, current_stock: 120, alert_threshold: 30, safety_threshold: 10, section: 'BAR', is_active: true, created_at: new Date().toISOString() },
        { id: uid(), tenant_id: company.id, name: 'Castel Beer 33cl', category_id: 'c1', type_id: 't1', unit_id: 'u3', price: 800, current_stock: 18, alert_threshold: 40, safety_threshold: 15, section: 'BAR', is_active: true, created_at: new Date().toISOString() },
        { id: uid(), tenant_id: company.id, name: 'Energy Drink 25cl', category_id: 'c3', type_id: 't3', unit_id: 'u3', price: 1000, current_stock: 60, alert_threshold: 20, safety_threshold: 8, section: 'BAR', is_active: true, created_at: new Date().toISOString() },
        { id: uid(), tenant_id: company.id, name: 'Whisky (dose)', category_id: 'c4', type_id: 't4', unit_id: 'u4', price: 1500, current_stock: 200, alert_threshold: 50, safety_threshold: 20, section: 'BAR', is_active: true, created_at: new Date().toISOString() },
        { id: uid(), tenant_id: company.id, name: 'Poulet braisé + alloco', category_id: 'c5', type_id: 't5', unit_id: 'u2', price: 3500, current_stock: 12, alert_threshold: 8, safety_threshold: 3, section: 'KITCHEN', is_active: true, created_at: new Date().toISOString() },
      ]
    }
    if (db.tables.length === 0) {
      db.tables = [
        { id: uid(), tenant_id: company.id, number: 'T1', zone: 'Terrasse', capacity: 4, status: 'FREE', qr_order_enabled: true },
        { id: uid(), tenant_id: company.id, number: 'T2', zone: 'Terrasse', capacity: 4, status: 'OCCUPIED', qr_order_enabled: true },
        { id: uid(), tenant_id: company.id, number: 'T3', zone: 'Salle', capacity: 6, status: 'FREE', qr_order_enabled: true },
        { id: uid(), tenant_id: company.id, number: 'T4', zone: 'Salle', capacity: 8, status: 'RESERVED', qr_order_enabled: true },
      ]
    }
    save(db)
  },

  getPricing(): PublicPlans {
    return { pricing: seedPricing, trial_days: 14 }
  },

  getCategories(): Category[] { return seedCategories },
  getTypes(): ProductType[] { return seedTypes },
  getUnits(): Unit[] { return seedUnits },

  kpis(db: DemoDb): Kpis {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfWeek = startOfDay - now.getDay() * 86400000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const paid = db.invoices
    const sum = (from: number) => paid.filter((i) => new Date(i.created_at).getTime() >= from).reduce((s, i) => s + i.total_amount, 0)
    return {
      revenueToday: sum(startOfDay),
      revenueWeek: sum(startOfWeek),
      revenueMonth: sum(startOfMonth),
      ordersToday: db.orders.filter((o) => new Date(o.created_at).getTime() >= startOfDay).length,
      ordersOpen: db.orders.filter((o) => !['PAID', 'CANCELLED'].includes(o.status)).length,
      lowStock: db.products.filter((p) => p.current_stock <= p.alert_threshold).length,
      avgTicket: paid.length ? Math.round(paid.reduce((s, i) => s + i.total_amount, 0) / paid.length) : 0,
    }
  },
}
