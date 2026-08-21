// ============================================================================
// Couche API unifiée : mode réel (Supabase) ou mode démo (localStorage).
// Les pages n'utilisent que ce module — jamais supabase directement.
// ============================================================================
import { isDemoMode, supabase } from './supabase'
import { demoApi } from './demo'
import { uid } from './format'
import type {
  ActivityType, AdminCompanyRow, AffiliateInfo, AttendanceRecord, Category, Company, DiningTable,
  Employee, Inventory, Invoice, Kpis, MenuItem, Notification, Order, Payroll, Pricing,
  Product, ProductType, Profile, PublicPlans, PurchaseOrder, Supplier, Unit,
} from './types'

export type { Profile } from './types'

// ---------------------------------------------------------------------------
// Session / Auth
// ---------------------------------------------------------------------------
export interface SessionUser {
  id: string
  email?: string
  phone?: string
}

export async function getSession(): Promise<{ user: SessionUser | null; profile: Profile | null }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const p = db.profile
    return { user: p ? { id: p.id, email: p.email, phone: p.phone } : null, profile: p }
  }
  const { data } = await supabase!.auth.getSession()
  const u = data.session?.user ?? null
  if (!u) return { user: null, profile: null }
  const { data: profile } = await supabase!.from('profiles').select('*').eq('id', u.id).single()
  return { user: { id: u.id, email: u.email ?? undefined, phone: u.phone ?? undefined }, profile: profile as Profile | null }
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    if (!db.profile) {
      // Première connexion en démo : crée un profil Promoteur avec boutique d'exemple
      db.profile = {
        id: uid(), first_name: 'Afi', last_name: 'Kossi', email, phone: '+229 01 00 00 00',
        user_type: 'TENANT_STAFF', status: 'ACTIVE', tenant_id: null, created_at: new Date().toISOString(),
      }
      demoApi.save(db)
      return {}
    }
    return {}
  }
  const { error } = await supabase!.auth.signInWithPassword({ email, password })
  return { error: error?.message }
}

export async function signUp(p: {
  email: string; password: string; firstName: string; lastName: string; phone: string
}): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.profile = {
      id: uid(), first_name: p.firstName, last_name: p.lastName, email: p.email, phone: p.phone,
      user_type: 'TENANT_STAFF', status: 'ACTIVE', tenant_id: null, created_at: new Date().toISOString(),
    }
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.auth.signUp({
    email: p.email,
    password: p.password,
    options: { data: { first_name: p.firstName, last_name: p.lastName, phone: p.phone } },
  })
  return { error: error?.message }
}

export async function signOut(): Promise<void> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.profile = null
    demoApi.save(db)
    return
  }
  await supabase!.auth.signOut()
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
export async function getPlans(): Promise<PublicPlans> {
  if (isDemoMode) return demoApi.getPricing()
  const { data } = await supabase!.rpc('get_public_plans')
  return data as PublicPlans
}

export async function trackReferralClick(code: string): Promise<{ ok: boolean; referral_link?: string; error?: string }> {
  if (isDemoMode) return { ok: true, referral_link: `/r/${code}` }
  const { data } = await supabase!.rpc('track_referral_click', { p_code: code, p_source: 'web' })
  return data as { ok: boolean; referral_link?: string; error?: string }
}

// ---------------------------------------------------------------------------
// Entreprise / Abonnement
// ---------------------------------------------------------------------------
export async function createCompany(p: {
  name: string
  activity_type: ActivityType
  country: string
  currency: string
  language: string
  address?: string
  referral_code?: string
}): Promise<{ company?: Company; error?: string }> {
  if (isDemoMode) {
    const company: Company = {
      id: uid(), name: p.name, activity_type: p.activity_type, unique_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      country: p.country, currency: p.currency, language: p.language, address: p.address ?? null,
      status: 'TRIAL', trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      owner_user_id: demoApi.load().profile?.id ?? '', created_at: new Date().toISOString(),
    }
    demoApi.seedCompany(company)
    return { company }
  }
  const { data, error } = await supabase!.rpc('create_company', {
    p_name: p.name,
    p_activity_type: p.activity_type,
    p_country: p.country,
    p_currency: p.currency,
    p_language: p.language,
    p_address: p.address ?? null,
    p_logo_url: null,
    p_referral_code: p.referral_code ?? null,
  })
  return { company: (data as Company) ?? undefined, error: error?.message }
}

export async function getMyCompany(): Promise<Company | null> {
  if (isDemoMode) return demoApi.load().company
  const { data: profile } = await supabase!.from('profiles').select('tenant_id').eq('id', (await supabase!.auth.getUser()).data.user?.id).single()
  if (!profile?.tenant_id) return null
  const { data } = await supabase!.from('companies').select('*').eq('id', profile.tenant_id).single()
  return data as Company | null
}

export async function startTrial(): Promise<{ error?: string }> {
  // En mode réel, le trial est démarré automatiquement à la création (create_company).
  return {}
}

// ---------------------------------------------------------------------------
// Catalogue & Produits
// ---------------------------------------------------------------------------
export async function getCategories(): Promise<Category[]> {
  if (isDemoMode) return demoApi.getCategories()
  const { data } = await supabase!.from('categories').select('*').order('name')
  return (data as Category[]) ?? []
}
export async function getTypes(): Promise<ProductType[]> {
  if (isDemoMode) return demoApi.getTypes()
  const { data } = await supabase!.from('product_types').select('*').order('name')
  return (data as ProductType[]) ?? []
}
export async function getUnits(): Promise<Unit[]> {
  if (isDemoMode) return demoApi.getUnits()
  const { data } = await supabase!.from('units').select('*').order('name')
  return (data as Unit[]) ?? []
}

export async function getProducts(): Promise<Product[]> {
  if (isDemoMode) {
    const db = demoApi.load()
    return db.products.map((p) => ({
      ...p,
      categories: seedName('categories', p.category_id),
      units: seedName('units', p.unit_id),
      product_types: seedName('types', p.type_id),
    }))
  }
  const { data } = await supabase!
    .from('products')
    .select('*, categories(name), units(name), product_types(name)')
    .eq('is_active', true)
    .order('name')
  return (data as Product[]) ?? []
}

function seedName(kind: 'categories' | 'units' | 'types', id?: string | null) {
  const list =
    kind === 'categories' ? demoApi.getCategories() : kind === 'units' ? demoApi.getUnits() : demoApi.getTypes()
  const found = list.find((c) => c.id === id)
  return found ? { name: found.name } : null
}

export async function createProduct(p: {
  name: string; price: number; category_id?: string; type_id?: string; unit_id?: string;
  alert_threshold: number; safety_threshold: number; section: 'BAR' | 'KITCHEN'; current_stock: number
}): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique' }
    db.products.push({
      id: uid(), tenant_id: company.id, name: p.name, price: p.price, category_id: p.category_id ?? null,
      type_id: p.type_id ?? null, unit_id: p.unit_id ?? null, alert_threshold: p.alert_threshold,
      safety_threshold: p.safety_threshold, section: p.section, current_stock: p.current_stock,
      is_active: true, created_at: new Date().toISOString(),
    })
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.from('products').insert({
    name: p.name, price: p.price, category_id: p.category_id, type_id: p.type_id, unit_id: p.unit_id,
    alert_threshold: p.alert_threshold, safety_threshold: p.safety_threshold, section: p.section,
    current_stock: p.current_stock,
  })
  return { error: error?.message }
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.products = db.products.map((p) => (p.id === id ? { ...p, ...patch } : p))
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.from('products').update(patch).eq('id', id)
  return { error: error?.message }
}

export async function recordStockMovement(p: {
  product_id: string; movement_type: string; quantity: number; reason?: string
}): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.products = db.products.map((prod) =>
      prod.id === p.product_id ? { ...prod, current_stock: Math.max(0, prod.current_stock + p.quantity) } : prod)
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.from('stock_movements').insert({
    product_id: p.product_id, movement_type: p.movement_type, quantity: p.quantity, reason: p.reason ?? null,
  })
  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
export async function getTables(): Promise<DiningTable[]> {
  if (isDemoMode) return demoApi.load().tables
  const { data } = await supabase!.from('dining_tables').select('*').order('number')
  return (data as DiningTable[]) ?? []
}

export async function updateTableStatus(id: string, status: DiningTable['status']): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.tables = db.tables.map((t) => (t.id === id ? { ...t, status } : t))
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.from('dining_tables').update({ status }).eq('id', id)
  return { error: error?.message }
}

export async function createTable(t: { number: string; zone?: string; capacity: number }): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique' }
    db.tables.push({ id: uid(), tenant_id: company.id, number: t.number, zone: t.zone ?? null, capacity: t.capacity, status: 'FREE', qr_order_enabled: false })
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.from('dining_tables').insert({ number: t.number, zone: t.zone ?? null, capacity: t.capacity })
  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Commandes & paiements
// ---------------------------------------------------------------------------
export async function getOrders(): Promise<Order[]> {
  if (isDemoMode) {
    const db = demoApi.load()
    return db.orders.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data } = await supabase!
    .from('orders')
    .select('*, order_items(*, products(name)), dining_tables(number), profiles(first_name,last_name)')
    .order('created_at', { ascending: false })
  return (data as Order[]) ?? []
}

export async function createOrder(p: {
  table_id?: string | null
  items: { product_id: string; quantity: number; unit_price: number; section: 'BAR' | 'KITCHEN' }[]
  offline?: boolean
}): Promise<{ order?: Order; error?: string }> {
  const orderId = uid()
  const clientGeneratedId = uid()
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique' }
    const order: Order = {
      id: orderId, tenant_id: company.id, table_id: p.table_id ?? null, status: 'PENDING',
      source: 'SERVER', offline_created: p.offline ?? false, client_generated_id: clientGeneratedId,
      server_user_id: db.profile?.id ?? null, created_at: new Date().toISOString(),
      order_items: p.items.map((it) => ({
        id: uid(), order_id: orderId, product_id: it.product_id, quantity: it.quantity,
        unit_price: it.unit_price, section: it.section, status: 'PENDING',
        products: { name: db.products.find((pr) => pr.id === it.product_id)?.name ?? 'Produit' },
      })),
    }
    db.orders.unshift(order)
    if (p.table_id) {
      db.tables = db.tables.map((t) => (t.id === p.table_id ? { ...t, status: 'OCCUPIED' } : t))
    }
    if (p.offline) db.syncQueue.push({ id: orderId, kind: 'order', at: new Date().toISOString() })
    demoApi.save(db)
    return { order }
  }
  // Mode réel : déduplication par client_generated_id (synchronisation offline)
  const { data: existing } = await supabase!.from('orders').select('id').eq('client_generated_id', clientGeneratedId)
  if (existing && existing.length > 0) return { error: 'Commande déjà synchronisée' }

  const { data: order, error } = await supabase!
    .from('orders')
    .insert({
      id: orderId, table_id: p.table_id ?? null, source: 'SERVER',
      offline_created: p.offline ?? false, client_generated_id: clientGeneratedId,
    })
    .select()
    .single()
  if (error) return { error: error.message }

  const { error: itemsError } = await supabase!.from('order_items').insert(
    p.items.map((it) => ({ order_id: orderId, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, section: it.section })),
  )
  if (itemsError) return { error: itemsError.message }

  if (p.table_id) {
    await supabase!.from('dining_tables').update({ status: 'OCCUPIED' }).eq('id', p.table_id)
  }
  return { order: order as Order }
}

export async function payOrderCash(orderId: string, amount: number, tip = 0): Promise<{ invoice?: Invoice; error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) return { error: 'Commande introuvable' }
    const invoice: Invoice = {
      id: uid(), tenant_id: order.tenant_id, order_id: order.id,
      legal_sequential_number: `FAC-${new Date().getFullYear()}-${String(db.invoices.length + 1).padStart(6, '0')}`,
      total_amount: amount, tax_amount: Math.round((amount - tip) * 0.18), tip_amount: tip, status: 'PAID',
      created_at: new Date().toISOString(),
    }
    db.invoices.unshift(invoice)
    order.status = 'PAID'
    db.orders = db.orders.map((o) => (o.id === order.id ? order : o))
    if (order.table_id) {
      db.tables = db.tables.map((t) => (t.id === order.table_id ? { ...t, status: 'FREE' } : t))
    }
    // Décrément du stock
    for (const item of order.order_items ?? []) {
      db.products = db.products.map((prod) =>
        prod.id === item.product_id ? { ...prod, current_stock: Math.max(0, prod.current_stock - item.quantity) } : prod)
    }
    demoApi.save(db)
    return { invoice }
  }
  const { data, error } = await supabase!.rpc('record_cash_payment', {
    p_order_id: orderId, p_amount: amount, p_tip: tip,
  })
  return { invoice: (data as Invoice) ?? undefined, error: error?.message }
}

// ---------------------------------------------------------------------------
// Factures, KPI, notifications
// ---------------------------------------------------------------------------
export async function getInvoices(): Promise<Invoice[]> {
  if (isDemoMode) return demoApi.load().invoices
  const { data } = await supabase!.from('invoices').select('*').order('created_at', { ascending: false }).limit(50)
  return (data as Invoice[]) ?? []
}

export async function getDashboardKpis(): Promise<Kpis> {
  if (isDemoMode) return demoApi.kpis(demoApi.load())
  const tenant = await getMyCompany()
  if (!tenant) return { revenueToday: 0, revenueWeek: 0, revenueMonth: 0, ordersToday: 0, ordersOpen: 0, lowStock: 0, avgTicket: 0 }
  const { data: inv } = await supabase!.from('invoices').select('total_amount, created_at')
  const { data: orders } = await supabase!.from('orders').select('status, created_at')
  const { data: products } = await supabase!.from('products').select('current_stock, alert_threshold')
  const now = new Date()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const week = day - now.getDay() * 86400000
  const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const sum = (from: number) => (inv ?? []).filter((i) => new Date(i.created_at).getTime() >= from).reduce((s, i) => s + i.total_amount, 0)
  return {
    revenueToday: sum(day), revenueWeek: sum(week), revenueMonth: sum(month),
    ordersToday: (orders ?? []).filter((o) => new Date(o.created_at).getTime() >= day).length,
    ordersOpen: (orders ?? []).filter((o) => !['PAID', 'CANCELLED'].includes(o.status)).length,
    lowStock: (products ?? []).filter((p) => p.current_stock <= p.alert_threshold && p.alert_threshold > 0).length,
    avgTicket: inv && inv.length ? Math.round(inv.reduce((s, i) => s + i.total_amount, 0) / inv.length) : 0,
  }
}

export async function getNotifications(): Promise<Notification[]> {
  if (isDemoMode) return demoApi.load().notifications
  const { data } = await supabase!.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
  return (data as Notification[]) ?? []
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.notifications = db.notifications.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    demoApi.save(db)
    return
  }
  await supabase!.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
}

// ---------------------------------------------------------------------------
// Affiliation
// ---------------------------------------------------------------------------
export async function registerAffiliate(p: {
  firstName: string; lastName: string; email: string; phone: string; paymentMethod: string; accountRef: string
}): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const code = Math.random().toString(36).slice(2, 10).toUpperCase()
    db.affiliate = {
      id: uid(), referral_code: code, referral_link: `${location.origin}/r/${code}`, status: 'ACTIVE',
      companies_count: 0, pending: 0, available: 0, paid: 0, companies: [],
    }
    if (db.profile) db.profile.user_type = 'AFFILIATE'
    demoApi.save(db)
    return {}
  }
  const me = (await supabase!.auth.getUser()).data.user
  if (!me) return { error: 'Non authentifié' }
  const code = Math.random().toString(36).slice(2, 10).toUpperCase()
  const link = `${location.origin}/r/${code}`
  const { error } = await supabase!.from('affiliates').insert({
    user_id: me.id, referral_code: code, referral_link: link,
    payment_method: p.paymentMethod as never, payment_account_ref: p.accountRef,
  })
  if (error) return { error: error.message }
  await supabase!.from('profiles').update({ user_type: 'AFFILIATE' }).eq('id', me.id)
  return {}
}

export async function getAffiliateInfo(): Promise<AffiliateInfo | null> {
  if (isDemoMode) return demoApi.load().affiliate
  const me = (await supabase!.auth.getUser()).data.user
  if (!me) return null
  let aff: any = null
  try {
    const { data } = await supabase!.from('affiliates').select('*').eq('user_id', me.id).maybeSingle()
    aff = data
  } catch { aff = null }
  if (!aff) return null
  const { data: companies } = await supabase!.from('companies').select('id, name, status, created_at').eq('affiliate_id', aff.id)
  const { data: commissions } = await supabase!.from('affiliate_commissions').select('amount, status')
  const sum = (s: string) => (commissions ?? []).filter((c) => c.status === s).reduce((a, c) => a + c.amount, 0)
  return {
    id: aff.id, referral_code: aff.referral_code, referral_link: aff.referral_link, status: aff.status,
    companies_count: (companies ?? []).length,
    pending: sum('PENDING'), available: sum('VALIDATED'), paid: sum('PAID'),
    companies: (companies ?? []) as AffiliateInfo['companies'],
  }
}

export async function requestPayout(): Promise<{ error?: string }> {
  if (isDemoMode) return {}
  const aff = await getAffiliateInfo()
  if (!aff) return { error: 'Pas de compte affilié' }
  if (aff.available < 10000) return { error: 'Seuil minimum de retrait non atteint (10 000 F)' }
  const { error } = await supabase!.from('affiliate_payouts').insert({ affiliate_id: aff.id, amount: aff.available })
  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Super-Admin
// ---------------------------------------------------------------------------
export async function adminGetCompanies(): Promise<AdminCompanyRow[]> {
  if (isDemoMode) {
    const db = demoApi.load()
    const c = db.company
    return c ? [{ id: c.id, name: c.name, activity_type: c.activity_type, status: c.status, unique_code: c.unique_code, country: c.country, created_at: c.created_at, trial_ends_at: c.trial_ends_at }] : []
  }
  const { data } = await supabase!.from('companies').select('*, profiles!owner_user_id(email)').order('created_at', { ascending: false })
  return ((data as any[]) ?? []).map((c) => ({
    id: c.id, name: c.name, activity_type: c.activity_type, status: c.status, unique_code: c.unique_code,
    country: c.country, created_at: c.created_at, trial_ends_at: c.trial_ends_at,
    owner_email: c.profiles?.email ?? null,
  }))
}

export async function adminGetRevenue(): Promise<{ subscriptions: number; commissions: number; companies: number; mrr: number }> {
  if (isDemoMode) return { subscriptions: 0, commissions: 0, companies: demoApi.load().company ? 1 : 0, mrr: 0 }
  const { data: subs } = await supabase!.from('subscriptions').select('amount, status, plan')
  const { data: pays } = await supabase!.from('payments').select('platform_commission_amount').eq('status', 'SUCCESS')
  const { count } = await supabase!.from('companies').select('*', { count: 'exact', head: true })
  const active = (subs ?? []).filter((s) => s.status === 'ACTIVE')
  const months: Record<string, number> = { BASE: 1, MOYENNE: 3, SEMESTRIELLE: 6, SUPREME: 12 }
  const mrr = active.reduce((s, sub) => s + Math.round(sub.amount / (months[sub.plan] ?? 1)), 0)
  return {
    subscriptions: active.reduce((s, sub) => s + sub.amount, 0),
    commissions: (pays ?? []).reduce((s, p) => s + p.platform_commission_amount, 0),
    companies: count ?? 0,
    mrr,
  }
}

export async function getAuditLogs(): Promise<any[]> {
  if (isDemoMode) return []
  const { data } = await supabase!.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
  return (data as any[]) ?? []
}

// ---------------------------------------------------------------------------
// Permissions (matrice) — cache par session
// ---------------------------------------------------------------------------
let permCache: Set<string> | null = null

export async function getMyPermissions(): Promise<Set<string>> {
  if (permCache) return permCache
  if (isDemoMode) {
    // Démo : profil Promoteur → toutes les permissions boutique
    permCache = new Set(ALL_TENANT_PERMISSIONS)
    return permCache
  }
  const me = (await supabase!.auth.getUser()).data.user
  if (!me) return new Set()
  const { data: profile } = await supabase!.from('profiles').select('user_type, role_id').eq('id', me.id).single()
  if (profile?.user_type === 'SUPER_ADMIN') {
    permCache = new Set(ALL_TENANT_PERMISSIONS.concat(ALL_PLATFORM_PERMISSIONS))
    return permCache
  }
  if (profile?.user_type === 'AFFILIATE') {
    permCache = new Set(['affiliate.view_own_dashboard', 'affiliate.view_referral_link', 'affiliate.view_commissions', 'affiliate.request_payout'])
    return permCache
  }
  const codes = new Set<string>()
  if (profile?.role_id) {
    const { data: rp } = await supabase!
      .from('role_permissions')
      .select('permissions(code), granted')
      .eq('role_id', profile.role_id)
    for (const row of (rp as any[]) ?? []) {
      if (row.granted && row.permissions?.code) codes.add(row.permissions.code)
    }
  }
  permCache = codes
  return codes
}

export async function hasPermission(code: string): Promise<boolean> {
  const perms = await getMyPermissions()
  return perms.has(code)
}

export function invalidatePermissions() {
  permCache = null
}

const ALL_TENANT_PERMISSIONS = [
  'orders.create', 'orders.view_all', 'orders.assign_section', 'orders.mark_ready', 'orders.transfer_table',
  'orders.cancel', 'orders.approve_cancel', 'orders.qr_menu_manage',
  'tables.configure_plan', 'tables.update_status', 'tables.reserve', 'tables.merge_split',
  'payments.take_cash', 'payments.take_card_mobile', 'payments.split_bill', 'payments.refund_approve', 'invoices.view',
  'products.manage', 'products.set_thresholds', 'stock.view', 'stock.record_movement',
  'purchase_order.create', 'purchase_order.validate', 'purchase_order.receive', 'suppliers.manage',
  'inventory.perform', 'inventory.view_discrepancy_report',
  'employees.view', 'employees.create', 'employees.validate_signup', 'employees.manage_permissions', 'employees.view_files',
  'schedules.manage', 'attendance.view_own', 'attendance.view_all', 'attendance.grant_exception', 'leaves.request', 'leaves.approve',
  'payroll.prepare', 'payroll.validate', 'payroll.view_own_payslip', 'payroll.view_all', 'payroll.configure_bonus_rules',
  'treasury.view_consolidated', 'treasury.withdraw_funds',
  'accounting.manage_expenses', 'accounting.export_reports', 'accounting.bank_reconciliation',
  'reports.view_global_kpi', 'reports.view_own_performance', 'reports.view_financial', 'reports.view_stock_kpi', 'reports.export',
  'messages.send_group', 'messages.send_individual', 'messages.view_history',
  'company.edit_settings', 'company.manage_categories_types_units', 'subscription.view', 'subscription.change_plan_pay',
  'roles.create_custom_profile', 'audit_log.view',
]

const ALL_PLATFORM_PERMISSIONS = [
  'platform.view_all_tenants', 'platform.suspend_reactivate_tenant', 'platform.view_all_transactions',
  'platform.manage_refunds', 'platform.configure_pricing', 'platform.configure_affiliate_program',
  'platform.validate_affiliate', 'platform.process_affiliate_payout', 'platform.manage_internal_accounts',
  'platform.view_global_audit_log', 'platform.manage_support_tickets',
]

export function pricingFromPlans(plans: PublicPlans): Pricing {
  return plans.pricing
}

// ---------------------------------------------------------------------------
// Personnel (employés)
// ---------------------------------------------------------------------------
export async function getEmployees(): Promise<Employee[]> {
  if (isDemoMode) return demoApi.load().employees
  const { data } = await supabase!
    .from('employees')
    .select('*, profiles(first_name,last_name,phone,email)')
    .order('created_at')
  return ((data as any[]) ?? []).map((e) => ({
    id: e.id, tenant_id: e.tenant_id, user_id: e.user_id, position: e.position,
    hourly_rate: e.hourly_rate, monthly_salary: e.monthly_salary, payment_method: e.payment_method,
    status: e.status, created_at: e.created_at,
    first_name: e.profiles?.first_name ?? null, last_name: e.profiles?.last_name ?? null,
    phone: e.profiles?.phone ?? null, email: e.profiles?.email ?? null,
  }))
}

export async function createEmployee(p: {
  firstName: string; lastName: string; phone: string; position: string; monthlySalary: number
}): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique' }
    const id = uid()
    db.employees.push({
      id, tenant_id: company.id, user_id: id, first_name: p.firstName, last_name: p.lastName,
      phone: p.phone, position: p.position, monthly_salary: p.monthlySalary,
      payment_method: 'MOBILE_MONEY', status: 'ACTIVE', created_at: new Date().toISOString(),
    })
    demoApi.save(db)
    return {}
  }
  const me = (await supabase!.auth.getUser()).data.user
  if (!me) return { error: 'Non authentifié' }
  // Création directe : utilisateur auth + profil + fiche employé
  const { data: created, error } = await supabase!.auth.admin.createUser({
    email: `${p.phone.replace(/\D/g, '')}@staff.debitmanager.local`,
    phone: p.phone,
    email_confirm: true,
    user_metadata: { first_name: p.firstName, last_name: p.lastName },
  })
  if (error) return { error: error.message }
  const { error: empErr } = await supabase!.from('employees').insert({
    user_id: created.user.id, position: p.position, monthly_salary: p.monthlySalary,
  })
  return { error: empErr?.message }
}

// ---------------------------------------------------------------------------
// Présences (badgeage)
// ---------------------------------------------------------------------------
export async function getAttendance(): Promise<AttendanceRecord[]> {
  if (isDemoMode) return demoApi.load().attendance.slice().sort((a, b) => b.check_in_at.localeCompare(a.check_in_at))
  const { data } = await supabase!
    .from('attendance')
    .select('*, employees(position, profiles(first_name,last_name))')
    .order('check_in_at', { ascending: false })
    .limit(50)
  return ((data as any[]) ?? []).map((a) => ({
    id: a.id, employee_id: a.employee_id, tenant_id: a.tenant_id, check_in_at: a.check_in_at,
    check_out_at: a.check_out_at, status: a.status, exception_reason: a.exception_reason,
    first_name: a.employees?.profiles?.first_name ?? null,
    last_name: a.employees?.profiles?.last_name ?? null,
    position: a.employees?.position ?? null,
  }))
}

export async function checkIn(): Promise<{ error?: string; status?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const emp = db.employees[0]
    if (!emp) return { error: 'Aucun profil employé' }
    if (db.attendance.some((a) => a.employee_id === emp.id && !a.check_out_at && a.check_in_at.slice(0, 10) === new Date().toISOString().slice(0, 10))) {
      return { error: 'Déjà pointé aujourd\'hui' }
    }
    db.attendance.unshift({
      id: uid(), employee_id: emp.id, tenant_id: emp.tenant_id, check_in_at: new Date().toISOString(),
      status: 'ON_TIME', first_name: emp.first_name, last_name: emp.last_name, position: emp.position,
    })
    demoApi.save(db)
    return { status: 'ON_TIME' }
  }
  const lat = 6.37, lng = 2.39 // ex. Cotonou (le serveur compare au geo_lat/lng de la boutique)
  const { data, error } = await supabase!.rpc('check_in', { p_lat: lat, p_lng: lng })
  return { error: error?.message, status: (data as any)?.status }
}

export async function checkOut(): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const emp = db.employees[0]
    if (!emp) return {}
    db.attendance = db.attendance.map((a) =>
      a.employee_id === emp.id && !a.check_out_at && a.check_in_at.slice(0, 10) === new Date().toISOString().slice(0, 10)
        ? { ...a, check_out_at: new Date().toISOString() } : a)
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.rpc('check_out')
  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Paie
// ---------------------------------------------------------------------------
export async function getPayrolls(): Promise<Payroll[]> {
  if (isDemoMode) return demoApi.load().payrolls
  const { data } = await supabase!
    .from('payrolls')
    .select('*, employees(position, profiles(first_name,last_name))')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
  return ((data as any[]) ?? []).map((p) => ({
    id: p.id, tenant_id: p.tenant_id, employee_id: p.employee_id, period_month: p.period_month,
    period_year: p.period_year, base_amount: p.base_amount, bonus_amount: p.bonus_amount,
    deduction_amount: p.deduction_amount, total_amount: p.total_amount, status: p.status,
    payslip_pdf_url: p.payslip_pdf_url, created_at: p.created_at,
    first_name: p.employees?.profiles?.first_name ?? null,
    last_name: p.employees?.profiles?.last_name ?? null,
    position: p.employees?.position ?? null,
  }))
}

export async function preparePayrolls(month: number, year: number): Promise<{ error?: string; created: number }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique', created: 0 }
    let created = 0
    for (const emp of db.employees) {
      if (db.payrolls.some((p) => p.employee_id === emp.id && p.period_month === month && p.period_year === year)) continue
      db.payrolls.push({
        id: uid(), tenant_id: company.id, employee_id: emp.id, period_month: month, period_year: year,
        base_amount: emp.monthly_salary ?? 0, bonus_amount: 0, deduction_amount: 0,
        total_amount: emp.monthly_salary ?? 0, status: 'DRAFT', created_at: new Date().toISOString(),
        first_name: emp.first_name, last_name: emp.last_name, position: emp.position,
      })
      created++
    }
    demoApi.save(db)
    return { created }
  }
  const employees = await getEmployees()
  let created = 0
  for (const emp of employees) {
    if (emp.monthly_salary == null) continue
    const { error } = await supabase!.from('payrolls').insert({
      employee_id: emp.id, period_month: month, period_year: year,
      base_amount: emp.monthly_salary, total_amount: emp.monthly_salary, status: 'DRAFT',
    }).maybeSingle()
    if (!error) created++
  }
  return { created }
}

export async function suggestBonuses(month: number, year: number): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.payrolls = db.payrolls.map((p) =>
      p.period_month === month && p.period_year === year && p.status === 'DRAFT'
        ? { ...p, bonus_amount: Math.round(p.base_amount * 0.1), total_amount: p.base_amount + Math.round(p.base_amount * 0.1) } : p)
    demoApi.save(db)
    return {}
  }
  const { data: list } = await supabase!.from('payrolls').select('id, base_amount')
    .eq('period_month', month).eq('period_year', year).eq('status', 'DRAFT')
  for (const p of (list as any[]) ?? []) {
    const bonus = Math.round(p.base_amount * 0.1)
    await supabase!.from('payrolls').update({ bonus_amount: bonus, total_amount: p.base_amount + bonus }).eq('id', p.id)
  }
  return {}
}

export async function validatePayrolls(month: number, year: number): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.payrolls = db.payrolls.map((p) =>
      p.period_month === month && p.period_year === year && p.status === 'DRAFT'
        ? { ...p, status: 'VALIDATED' } : p)
    demoApi.save(db)
    return {}
  }
  const { data: list } = await supabase!.from('payrolls').select('id')
    .eq('period_month', month).eq('period_year', year).eq('status', 'DRAFT')
  for (const p of (list as any[]) ?? []) {
    await supabase!.from('payrolls').update({ status: 'VALIDATED' }).eq('id', p.id)
  }
  return {}
}

export async function payPayrolls(month: number, year: number): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.payrolls = db.payrolls.map((p) =>
      p.period_month === month && p.period_year === year && p.status === 'VALIDATED'
        ? { ...p, status: 'PAID' } : p)
    db.notifications.unshift({ id: uid(), content: `Paie de ${month}/${year} payée ✅`, event_type: 'PAYROLL_PAID', read_at: null, created_at: new Date().toISOString() })
    demoApi.save(db)
    return {}
  }
  const { data: list } = await supabase!.from('payrolls').select('id, total_amount')
    .eq('period_month', month).eq('period_year', year).eq('status', 'VALIDATED')
  for (const p of (list as any[]) ?? []) {
    const { data: pay } = await supabase!.rpc('start_payment', {
      p_purpose: 'PAYROLL', p_reference_id: p.id, p_amount: p.total_amount, p_method: 'MOBILE_MONEY', p_aggregator: 'NONE',
    })
    if (pay?.id) await supabase!.rpc('confirm_payment', { p_payment_id: pay.id })
  }
  return {}
}

// ---------------------------------------------------------------------------
// Approvisionnements : fournisseurs + bons de commande
// ---------------------------------------------------------------------------
export async function getSuppliers(): Promise<Supplier[]> {
  if (isDemoMode) return demoApi.load().suppliers
  const { data } = await supabase!.from('suppliers').select('*').order('name')
  return (data as Supplier[]) ?? []
}

export async function createSupplier(p: { name: string; phone?: string }): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique' }
    db.suppliers.push({ id: uid(), tenant_id: company.id, name: p.name, phone: p.phone ?? null, created_at: new Date().toISOString() })
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.from('suppliers').insert({ name: p.name, phone: p.phone ?? null })
  return { error: error?.message }
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  if (isDemoMode) return demoApi.load().purchaseOrders
  const { data } = await supabase!
    .from('purchase_orders')
    .select('*, suppliers(name), purchase_order_items(*, products(name))')
    .order('created_at', { ascending: false })
  return (data as PurchaseOrder[]) ?? []
}

export async function createPurchaseOrder(p: {
  supplier_id: string
  items: { product_id: string; quantity: number; unit_price: number }[]
}): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique' }
    const po: PurchaseOrder = {
      id: uid(), tenant_id: company.id, supplier_id: p.supplier_id, status: 'DRAFT',
      created_at: new Date().toISOString(),
      purchase_order_items: p.items.map((it) => ({
        id: uid(), purchase_order_id: '', product_id: it.product_id, quantity_ordered: it.quantity,
        unit_price: it.unit_price,
      })),
    }
    po.purchase_order_items!.forEach((it) => { it.purchase_order_id = po.id })
    db.purchaseOrders.unshift(po)
    demoApi.save(db)
    return {}
  }
  const { data: po, error } = await supabase!.from('purchase_orders').insert({ supplier_id: p.supplier_id, status: 'DRAFT' }).select().single()
  if (error) return { error: error.message }
  const { error: itErr } = await supabase!.from('purchase_order_items').insert(
    p.items.map((it) => ({ purchase_order_id: po.id, product_id: it.product_id, quantity_ordered: it.quantity, unit_price: it.unit_price })),
  )
  return { error: itErr?.message }
}

export async function validatePurchaseOrder(id: string): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.purchaseOrders = db.purchaseOrders.map((po) => (po.id === id && po.status === 'DRAFT' ? { ...po, status: 'VALIDATED' } : po))
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.rpc('validate_purchase_order', { p_id: id })
  return { error: error?.message }
}

export async function receivePurchaseOrder(id: string): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const po = db.purchaseOrders.find((x) => x.id === id)
    if (!po) return { error: 'Introuvable' }
    for (const it of po.purchase_order_items ?? []) {
      const qty = it.quantity_received ?? it.quantity_ordered
      db.products = db.products.map((prod) => (prod.id === it.product_id ? { ...prod, current_stock: prod.current_stock + qty } : prod))
    }
    db.purchaseOrders = db.purchaseOrders.map((x) => (x.id === id ? { ...x, status: 'RECEIVED' } : x))
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.rpc('receive_purchase_order', { p_id: id })
  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Inventaires
// ---------------------------------------------------------------------------
export async function getInventories(): Promise<Inventory[]> {
  if (isDemoMode) return demoApi.load().inventories
  const { data } = await supabase!
    .from('inventories')
    .select('*, inventory_lines(*, products(name))')
    .order('performed_at', { ascending: false })
  return (data as Inventory[]) ?? []
}

export async function startInventory(): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const company = db.company
    if (!company) return { error: 'Aucune boutique' }
    const inv: Inventory = {
      id: uid(), tenant_id: company.id, status: 'IN_PROGRESS', performed_at: new Date().toISOString(),
      inventory_lines: db.products.filter((p) => p.is_active).map((p) => ({
        id: uid(), inventory_id: '', product_id: p.id, theoretical_quantity: p.current_stock,
        actual_quantity: p.current_stock, discrepancy: 0, interpretation: 'OK', products: { name: p.name },
      })),
    }
    inv.inventory_lines!.forEach((l) => { l.inventory_id = inv.id })
    db.inventories.unshift(inv)
    demoApi.save(db)
    return {}
  }
  const { data: inv, error } = await supabase!.from('inventories').insert({}).select().single()
  if (error) return { error: error.message }
  const { data: products } = await supabase!.from('products').select('id, current_stock').eq('is_active', true)
  const { error: linesErr } = await supabase!.from('inventory_lines').insert(
    (products as any[] ?? []).map((p) => ({ inventory_id: inv.id, product_id: p.id, theoretical_quantity: p.current_stock, actual_quantity: p.current_stock })),
  )
  return { error: linesErr?.message }
}

export async function saveInventoryLine(lineId: string, actual: number): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.inventories = db.inventories.map((inv) => ({
      ...inv,
      inventory_lines: inv.inventory_lines?.map((l) => (l.id === lineId ? { ...l, actual_quantity: actual, discrepancy: actual - l.theoretical_quantity } : l)),
    }))
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.from('inventory_lines').update({ actual_quantity: actual }).eq('id', lineId)
  return { error: error?.message }
}

export async function completeInventory(id: string): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    db.inventories = db.inventories.map((inv) => {
      if (inv.id !== id) return inv
      const lines = inv.inventory_lines?.map((l) => {
        const disc = (l.actual_quantity ?? l.theoretical_quantity) - l.theoretical_quantity
        const pct = l.theoretical_quantity > 0 ? Math.abs(disc) / l.theoretical_quantity * 100 : 0
        const interp = disc === 0 ? 'OK' : disc < 0 ? (pct <= 5 ? 'PROBABLE_LOSS' : 'PROBABLE_THEFT') : 'INPUT_ERROR'
        if (disc < 0) {
          db.products = db.products.map((prod) => prod.id === l.product_id ? { ...prod, current_stock: Math.max(0, prod.current_stock + disc) } : prod)
        }
        return { ...l, discrepancy: disc, interpretation: interp }
      })
      return { ...inv, status: 'COMPLETED', inventory_lines: lines }
    })
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.rpc('complete_inventory', { p_id: id })
  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// QR menu client (public)
// ---------------------------------------------------------------------------
export async function getMenuByTable(tableId: string): Promise<{ table?: { number: string; status: string; qr_enabled: boolean } | null; items: MenuItem[] }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const table = db.tables.find((tb) => tb.id === tableId)
    if (!table) return { table: null, items: [] }
    const cats = demoApi.getCategories()
    return {
      table: { number: table.number, status: table.status, qr_enabled: table.qr_order_enabled },
      items: db.products.filter((p) => p.is_active).map((p) => ({
        product_id: p.id, name: p.name, price: p.price,
        category: cats.find((c) => c.id === p.category_id)?.name ?? 'Autres', section: p.section,
      })),
    }
  }
  const { data, error } = await supabase!.rpc('get_menu', { p_table_id: tableId })
  if (error) return { table: null, items: [] }
  const { data: table } = await supabase!.from('dining_tables').select('number, status, qr_order_enabled').eq('id', tableId).single()
  return { table: (table as any) ?? null, items: (data as MenuItem[]) ?? [] }
}

export async function createQrOrder(tableId: string, items: { product_id: string; quantity: number }[]): Promise<{ error?: string }> {
  if (isDemoMode) {
    const db = demoApi.load()
    const table = db.tables.find((tb) => tb.id === tableId)
    const company = db.company
    if (!table || !company) return { error: 'Table introuvable' }
    const order: Order = {
      id: uid(), tenant_id: company.id, table_id: tableId, status: 'PENDING', source: 'QR_CLIENT',
      offline_created: false, client_generated_id: uid(), created_at: new Date().toISOString(),
      order_items: items.map((it) => {
        const prod = db.products.find((p) => p.id === it.product_id)!
        return { id: uid(), order_id: '', product_id: prod.id, quantity: it.quantity, unit_price: prod.price, section: prod.section, status: 'PENDING' }
      }),
    }
    order.order_items!.forEach((o) => { o.order_id = order.id })
    db.orders.unshift(order)
    db.tables = db.tables.map((tb) => (tb.id === tableId ? { ...tb, status: 'OCCUPIED' } : tb))
    demoApi.save(db)
    return {}
  }
  const { error } = await supabase!.rpc('create_qr_order', { p_table_id: tableId, p_items: JSON.stringify(items) })
  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Rapports (export CSV)
// ---------------------------------------------------------------------------
export function exportInvoicesCsv(invoices: Invoice[]): void {
  const header = 'Numéro;Date;Montant total;TVA;Pourboire;Statut\n'
  const rows = invoices
    .map((i) => [i.legal_sequential_number, i.created_at, i.total_amount, i.tax_amount, i.tip_amount, i.status].join(';'))
    .join('\n')
  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `debitmanager-factures-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
