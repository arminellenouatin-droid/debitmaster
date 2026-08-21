// ============================================================================
// Couche API unifiée : mode réel (Supabase) ou mode démo (localStorage).
// Les pages n'utilisent que ce module — jamais supabase directement.
// ============================================================================
import { isDemoMode, supabase } from './supabase'
import { demoApi } from './demo'
import { uid } from './format'
import type {
  ActivityType, AdminCompanyRow, AffiliateInfo, Category, Company, DiningTable,
  Invoice, Kpis, Notification, Order, Pricing, Product, ProductType, Profile,
  PublicPlans, Unit,
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
        products: seedName('categories', null),
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
