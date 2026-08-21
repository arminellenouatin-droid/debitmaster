// ============================================================================
// Mode démo : persistance localStorage + données factices.
// Permet de parcourir l'application sans backend Supabase (prévisualisation).
// En mode réel (Supabase configuré), ce module n'est pas utilisé.
// ============================================================================
import type {
  AffiliateInfo, AttendanceRecord, Category, Company, DiningTable, Employee, Inventory,
  Invoice, Kpis, Notification, Order, Payroll, Pricing, Product, ProductType, Profile,
  PublicPlans, PurchaseOrder, Supplier, Unit,
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
  employees: Employee[]
  attendance: AttendanceRecord[]
  payrolls: Payroll[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  inventories: Inventory[]
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
    try {
      const db = JSON.parse(raw) as DemoDb
      db.employees ??= []
      db.attendance ??= []
      db.payrolls ??= []
      db.suppliers ??= []
      db.purchaseOrders ??= []
      db.inventories ??= []
      db.orders ??= []
      db.invoices ??= []
      db.notifications ??= []
      db.syncQueue ??= []
      db.products ??= []
      db.tables ??= []
      return db
    } catch { /* ignore */ }
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
    employees: [],
    attendance: [],
    payrolls: [],
    suppliers: [],
    purchaseOrders: [],
    inventories: [],
  }
  save(db)
  return db
}

function save(db: DemoDb) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

function daysAgo(n: number, hour = 20): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

export const demoApi = {
  load, save, seedCategories, seedTypes, seedUnits,

  seedCompany(company: Company) {
    const db = load()
    db.company = company
    if (db.profile) db.profile.tenant_id = company.id
    if (db.products.length === 0) {
      db.products = [
        { id: 'p1', tenant_id: company.id, name: 'Coca-Cola 33cl', category_id: 'c2', type_id: 't1', unit_id: 'u3', price: 500, current_stock: 120, alert_threshold: 30, safety_threshold: 10, section: 'BAR', is_active: true, created_at: daysAgo(10) },
        { id: 'p2', tenant_id: company.id, name: 'Castel Beer 33cl', category_id: 'c1', type_id: 't1', unit_id: 'u3', price: 800, current_stock: 18, alert_threshold: 40, safety_threshold: 15, section: 'BAR', is_active: true, created_at: daysAgo(10) },
        { id: 'p3', tenant_id: company.id, name: 'Energy Drink 25cl', category_id: 'c3', type_id: 't3', unit_id: 'u3', price: 1000, current_stock: 60, alert_threshold: 20, safety_threshold: 8, section: 'BAR', is_active: true, created_at: daysAgo(10) },
        { id: 'p4', tenant_id: company.id, name: 'Whisky (dose)', category_id: 'c4', type_id: 't4', unit_id: 'u4', price: 1500, current_stock: 200, alert_threshold: 50, safety_threshold: 20, section: 'BAR', is_active: true, created_at: daysAgo(10) },
        { id: 'p5', tenant_id: company.id, name: 'Poulet braisé + alloco', category_id: 'c5', type_id: 't5', unit_id: 'u2', price: 3500, current_stock: 12, alert_threshold: 8, safety_threshold: 3, section: 'KITCHEN', is_active: true, created_at: daysAgo(10) },
        { id: 'p6', tenant_id: company.id, name: 'Jus de bissap', category_id: 'c5', type_id: 't5', unit_id: 'u3', price: 600, current_stock: 45, alert_threshold: 15, safety_threshold: 5, section: 'KITCHEN', is_active: true, created_at: daysAgo(10) },
      ]
    }
    if (db.tables.length === 0) {
      db.tables = [
        { id: 't1', tenant_id: company.id, number: 'T1', zone: 'Terrasse', capacity: 4, status: 'FREE', qr_order_enabled: true },
        { id: 't2', tenant_id: company.id, number: 'T2', zone: 'Terrasse', capacity: 4, status: 'OCCUPIED', qr_order_enabled: true },
        { id: 't3', tenant_id: company.id, number: 'T3', zone: 'Salle', capacity: 6, status: 'FREE', qr_order_enabled: true },
        { id: 't4', tenant_id: company.id, number: 'T4', zone: 'Salle', capacity: 8, status: 'RESERVED', qr_order_enabled: true },
      ]
    }
    if (db.employees.length === 0) {
      const mk = (id: string, first: string, last: string, position: string, salary: number): Employee => ({
        id, tenant_id: company.id, user_id: id, first_name: first, last_name: last,
        position, monthly_salary: salary, payment_method: 'MOBILE_MONEY', status: 'ACTIVE', created_at: daysAgo(9),
      })
      db.employees = [
        mk('e1', 'Afi', 'Kossi', 'PROMOTEUR', 250000),
        mk('e2', 'Jean', 'Hounkpatin', 'SERVEUR', 90000),
        mk('e3', 'Mariam', 'Diallo', 'SERVEUR', 90000),
        mk('e4', 'Kofi', 'Mensah', 'BAR_MAN', 110000),
        mk('e5', 'Awa', 'Traoré', 'CUISINIER', 120000),
        mk('e6', 'Pierre', 'Soglo', 'COMPTABLE', 180000),
      ]
    }
    if (db.suppliers.length === 0) {
      db.suppliers = [
        { id: 's1', tenant_id: company.id, name: 'SOBERDI Bénin', phone: '+229 01 11 22 33', average_delivery_days: 2, created_at: daysAgo(8) },
        { id: 's2', tenant_id: company.id, name: 'Marché Dantokpa — Grossiste', phone: '+229 97 00 00 00', average_delivery_days: 1, created_at: daysAgo(8) },
      ]
    }
    // Historique de ventes (dashboard vivant)
    if (db.invoices.length === 0) {
      const mkOrder = (oid: string, tableId: string | null, at: string, items: { pid: string; qty: number }[]): Order => ({
        id: oid, tenant_id: company.id, table_id: tableId, status: 'PAID', source: 'SERVER',
        offline_created: false, client_generated_id: uid(), created_at: at,
        order_items: items.map((it, i) => {
          const prod = db.products.find((p) => p.id === it.pid)!
          return { id: uid(), order_id: oid, product_id: prod.id, quantity: it.qty, unit_price: prod.price, section: prod.section, status: 'READY' }
        }),
      })
      const mkInvoice = (oid: string, at: string, tip = 0): Invoice => {
        const order = db.orders.find((o) => o.id === oid)!
        const total = order.order_items!.reduce((s, it) => s + it.unit_price * it.quantity, 0) + tip
        return {
          id: uid(), tenant_id: company.id, order_id: oid,
          legal_sequential_number: `FAC-${new Date(at).getFullYear()}-${String(db.invoices.length + 1).padStart(6, '0')}`,
          total_amount: total, tax_amount: Math.round((total - tip) * 0.18), tip_amount: tip, status: 'PAID', created_at: at,
        }
      }
      db.orders = [
        mkOrder('o1', 't1', daysAgo(3), [{ pid: 'p1', qty: 4 }, { pid: 'p2', qty: 2 }]),
        mkOrder('o2', 't2', daysAgo(2), [{ pid: 'p4', qty: 3 }, { pid: 'p3', qty: 2 }]),
        mkOrder('o3', 't3', daysAgo(1), [{ pid: 'p5', qty: 2 }, { pid: 'p6', qty: 2 }]),
        mkOrder('o4', 't1', daysAgo(0, 19), [{ pid: 'p2', qty: 3 }, { pid: 'p1', qty: 2 }, { pid: 'p5', qty: 1 }]),
      ]
      db.invoices = db.orders.map((o) => mkInvoice(o.id, o.created_at, o.id === 'o4' ? 1000 : 0))
      // Une commande en cours sur la table T2
      db.orders.push({
        id: 'o5', tenant_id: company.id, table_id: 't2', status: 'IN_PREPARATION', source: 'SERVER',
        offline_created: false, client_generated_id: uid(), created_at: daysAgo(0, 18),
        order_items: [
          { id: uid(), order_id: 'o5', product_id: 'p2', quantity: 2, unit_price: 800, section: 'BAR', status: 'READY' },
          { id: uid(), order_id: 'o5', product_id: 'p6', quantity: 1, unit_price: 600, section: 'KITCHEN', status: 'IN_PREPARATION' },
        ],
      })
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
