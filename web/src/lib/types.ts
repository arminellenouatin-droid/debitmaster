// Types alignés sur docs/data-model.md (snake_case DB → camelCase app)

export type ActivityType = 'BUVETTE' | 'BAR_RESTAURANT' | 'NIGHTCLUB_LOUNGE'
export type CompanyStatus = 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
export type UserType = 'TENANT_STAFF' | 'SUPER_ADMIN' | 'AFFILIATE'
export type PlanCode = 'BASE' | 'MOYENNE' | 'SEMESTRIELLE' | 'SUPREME'
export type OrderStatus = 'PENDING' | 'IN_PREPARATION' | 'READY' | 'DELIVERED' | 'PAID' | 'CANCELLED'
export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'TO_CLEAN'
export type Section = 'BAR' | 'KITCHEN'
export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_MONEY'

export interface Profile {
  id: string
  tenant_id: string | null
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  user_type: UserType
  role_id?: string | null
  status: string
  created_at: string
}

export interface Company {
  id: string
  name: string
  activity_type: ActivityType
  unique_code: string
  country: string
  currency: string
  language: string
  logo_url?: string | null
  address?: string | null
  status: CompanyStatus
  trial_ends_at?: string | null
  owner_user_id: string
  affiliate_id?: string | null
  created_at: string
}

export interface Subscription {
  id: string
  tenant_id: string
  plan: PlanCode
  activity_coefficient: number
  amount: number
  currency: string
  period_start: string
  period_end: string
  status: string
  auto_renew: boolean
}

export interface Product {
  id: string
  tenant_id: string
  name: string
  category_id?: string | null
  type_id?: string | null
  unit_id?: string | null
  price: number
  image_url?: string | null
  current_stock: number
  alert_threshold: number
  safety_threshold: number
  section: Section
  is_active: boolean
  created_at: string
  categories?: { name: string } | null
  units?: { name: string } | null
  product_types?: { name: string } | null
}

export interface Category { id: string; tenant_id: string | null; name: string }
export interface Unit { id: string; tenant_id: string | null; name: string }
export interface ProductType { id: string; tenant_id: string | null; name: string }

export interface DiningTable {
  id: string
  tenant_id: string
  number: string
  zone?: string | null
  capacity: number
  status: TableStatus
  qr_order_enabled: boolean
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  section: Section
  status: string
  products?: { name: string } | null
}

export interface Order {
  id: string
  tenant_id: string
  table_id?: string | null
  server_user_id?: string | null
  status: OrderStatus
  source: 'SERVER' | 'QR_CLIENT'
  offline_created: boolean
  client_generated_id?: string | null
  created_at: string
  order_items?: OrderItem[]
  dining_tables?: { number: string } | null
  profiles?: { first_name?: string; last_name?: string } | null
}

export interface Invoice {
  id: string
  tenant_id: string
  order_id?: string | null
  legal_sequential_number: string
  total_amount: number
  tax_amount: number
  tip_amount: number
  status: string
  created_at: string
}

export interface Notification {
  id: string
  content: string
  event_type?: string
  read_at?: string | null
  created_at: string
}

export interface Kpis {
  revenueToday: number
  revenueWeek: number
  revenueMonth: number
  ordersToday: number
  ordersOpen: number
  lowStock: number
  avgTicket: number
}

export interface AffiliateInfo {
  id: string
  referral_code: string
  referral_link: string
  status: string
  companies_count: number
  pending: number
  available: number
  paid: number
  companies: { id: string; name: string; status: string; created_at: string }[]
}

export interface AdminCompanyRow {
  id: string
  name: string
  activity_type: ActivityType
  status: CompanyStatus
  unique_code: string
  country: string
  created_at: string
  trial_ends_at?: string | null
  owner_email?: string | null
}

export interface PricingPlan {
  plan: PlanCode
  months: number
  prices: Record<ActivityType, number>
}

export interface Pricing {
  currency: string
  plans: PricingPlan[]
  coefficients: Record<ActivityType, number>
}

export interface PublicPlans {
  pricing: Pricing
  trial_days: number
}

// ---------------------------------------------------------------------------
// Personnel / Présences / Paie / Approvisionnements / Inventaire
// ---------------------------------------------------------------------------
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED'

export interface Employee {
  id: string
  tenant_id: string
  user_id: string
  position?: string | null
  hourly_rate?: number | null
  monthly_salary?: number | null
  payment_method?: string | null
  status: EmployeeStatus
  created_at: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  tenant_id: string
  check_in_at: string
  check_out_at?: string | null
  status: 'ON_TIME' | 'LATE' | 'ABSENT' | 'EXCEPTION'
  exception_reason?: string | null
  first_name?: string | null
  last_name?: string | null
  position?: string | null
}

export type PayrollStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'VALIDATED' | 'PAID'

export interface Payroll {
  id: string
  tenant_id: string
  employee_id: string
  period_month: number
  period_year: number
  base_amount: number
  bonus_amount: number
  deduction_amount: number
  total_amount: number
  status: PayrollStatus
  payslip_pdf_url?: string | null
  created_at: string
  first_name?: string | null
  last_name?: string | null
  position?: string | null
}

export interface Supplier {
  id: string
  tenant_id: string
  name: string
  phone?: string | null
  email?: string | null
  average_delivery_days?: number | null
  created_at: string
}

export type PurchaseOrderStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'VALIDATED' | 'SENT' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  quantity_ordered: number
  quantity_received?: number | null
  unit_price: number
  products?: { name: string } | null
}

export interface PurchaseOrder {
  id: string
  tenant_id: string
  supplier_id?: string | null
  status: PurchaseOrderStatus
  created_at: string
  suppliers?: { name: string } | null
  purchase_order_items?: PurchaseOrderItem[]
}

export interface Inventory {
  id: string
  tenant_id: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  performed_at: string
  inventory_lines?: InventoryLine[]
}

export interface InventoryLine {
  id: string
  inventory_id: string
  product_id: string
  theoretical_quantity: number
  actual_quantity?: number | null
  discrepancy?: number | null
  interpretation?: string | null
  products?: { name: string } | null
}

export interface MenuItem {
  product_id: string
  name: string
  price: number
  category: string
  section: Section
}
