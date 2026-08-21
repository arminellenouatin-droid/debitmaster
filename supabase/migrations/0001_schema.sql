-- ============================================================================
-- DebitManager — Migration 0001 : Schéma complet
-- Source de vérité : docs/data-model.md
-- Conventions : UUID PK, created_at/updated_at, soft delete (deleted_at),
--               montants en entier (plus petite unité monétaire), enums natifs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type activity_type as enum ('BUVETTE', 'BAR_RESTAURANT', 'NIGHTCLUB_LOUNGE');
create type company_status as enum ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
create type subscription_plan as enum ('BASE', 'MOYENNE', 'SEMESTRIELLE', 'SUPREME');
create type subscription_status as enum ('PENDING', 'ACTIVE', 'EXPIRED', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED');
create type user_type as enum ('TENANT_STAFF', 'SUPER_ADMIN', 'AFFILIATE');
create type user_status as enum ('PENDING_VALIDATION', 'ACTIVE', 'SUSPENDED', 'DELETED');
create type employee_status as enum ('ACTIVE', 'ON_LEAVE', 'TERMINATED');
create type payment_method_enum as enum ('MOBILE_MONEY', 'BANK_TRANSFER', 'CASH');
create type day_of_week as enum ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');
create type attendance_status as enum ('ON_TIME', 'LATE', 'ABSENT', 'EXCEPTION');
create type leave_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type stock_movement_type as enum ('IN_PURCHASE', 'OUT_SALE', 'OUT_LOSS', 'OUT_BREAKAGE', 'OUT_EXPIRY', 'ADJUSTMENT');
create type inventory_status as enum ('IN_PROGRESS', 'COMPLETED');
create type inventory_interpretation as enum ('OK', 'PROBABLE_LOSS', 'PROBABLE_THEFT', 'INPUT_ERROR');
create type purchase_order_status as enum ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'SENT', 'RECEIVED', 'CANCELLED');
create type table_status as enum ('FREE', 'OCCUPIED', 'RESERVED', 'TO_CLEAN');
create type order_status as enum ('PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED', 'PAID', 'CANCELLED');
create type order_source as enum ('SERVER', 'QR_CLIENT');
create type order_item_section as enum ('BAR', 'KITCHEN');
create type order_item_status as enum ('PENDING', 'IN_PREPARATION', 'READY');
create type invoice_status as enum ('ISSUED', 'PAID', 'CANCELLED', 'REFUNDED');
create type payment_purpose as enum ('ORDER', 'SUBSCRIPTION', 'PAYROLL');
create type payment_method as enum ('CASH', 'CARD', 'MOBILE_MONEY');
create type aggregator_enum as enum ('KKIAPAY', 'MONEROO', 'CINETPAY', 'NONE');
create type payment_status as enum ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
create type payroll_status as enum ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'PAID');
create type treasury_movement_type as enum ('SALE_INCOME', 'WITHDRAWAL', 'EXPENSE', 'PAYROLL_OUTFLOW', 'SUPPLIER_PAYMENT');
create type notification_channel as enum ('PUSH', 'SMS', 'EMAIL');
create type affiliate_status as enum ('PENDING_VALIDATION', 'ACTIVE', 'SUSPENDED', 'REJECTED');
create type commission_status as enum ('PENDING', 'VALIDATED', 'PAID', 'REJECTED');
create type commission_mode as enum ('FIRST_PAYMENT', 'RECURRING');
create type payout_status as enum ('REQUESTED', 'PROCESSING', 'PAID', 'REJECTED');
create type support_ticket_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
create type reservation_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- ---------------------------------------------------------------------------
-- 1. COMPANIES (Entreprise/Boutique)
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  activity_type activity_type not null,
  unique_code varchar(10) not null unique,
  country varchar(2) not null default 'BJ',
  currency varchar(3) not null default 'XOF',
  language varchar(5) not null default 'fr',
  logo_url text,
  address varchar(255),
  status company_status not null default 'TRIAL',
  trial_ends_at timestamptz,
  owner_user_id uuid references auth.users(id),
  affiliate_id uuid, -- FK ajoutée après création de la table affiliates
  referral_tracking_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_companies_tenant on public.companies(id);
create index if not exists idx_companies_status on public.companies(status);
create index if not exists idx_companies_owner on public.companies(owner_user_id);

-- ---------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  plan subscription_plan not null,
  activity_coefficient numeric(3,2) not null,
  amount integer not null,
  currency varchar(3) not null default 'XOF',
  period_start timestamptz not null,
  period_end timestamptz not null,
  status subscription_status not null default 'PENDING',
  payment_id uuid,
  auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_tenant on public.subscriptions(tenant_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

-- ---------------------------------------------------------------------------
-- 3. PLATFORM_CONFIG (configuration globale Super-Admin)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_config (
  id uuid primary key default gen_random_uuid(),
  key varchar(100) not null unique,
  value jsonb not null,
  updated_by_user_id uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. PROFILES (Utilisateurs — lié à auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.companies(id),
  first_name varchar(80),
  last_name varchar(80),
  phone varchar(20) unique,
  email varchar(150) unique,
  user_type user_type not null default 'TENANT_STAFF',
  role_id uuid, -- FK ajoutée après création de roles
  status user_status not null default 'ACTIVE',
  two_factor_enabled boolean not null default false,
  last_login_at timestamptz,
  last_login_ip varchar(45),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_profiles_tenant on public.profiles(tenant_id);
create index if not exists idx_profiles_type on public.profiles(user_type);

-- ---------------------------------------------------------------------------
-- 5. ROLES / PERMISSIONS
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id),
  name varchar(80) not null,
  is_predefined boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_roles_tenant on public.roles(tenant_id);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code varchar(100) not null unique,
  module varchar(50) not null,
  description varchar(255),
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted boolean not null default true,
  primary key (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- 6. EMPLOYEES
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  user_id uuid not null references public.profiles(id),
  position varchar(80),
  hourly_rate integer,
  monthly_salary integer,
  payment_method payment_method_enum,
  payment_account_ref varchar(100), -- chiffré au repos (niveau applicatif / vault)
  id_document_url text,
  contract_document_url text,
  status employee_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_employees_tenant on public.employees(tenant_id);
create index if not exists idx_employees_user on public.employees(user_id);

-- ---------------------------------------------------------------------------
-- 7. SCHEDULES
-- ---------------------------------------------------------------------------
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  day_of_week day_of_week not null,
  start_time time not null,
  end_time time not null,
  exception_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_schedules_employee on public.schedules(employee_id);

-- ---------------------------------------------------------------------------
-- 8. ATTENDANCE
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  tenant_id uuid not null references public.companies(id),
  check_in_at timestamptz not null,
  check_in_lat numeric(9,6),
  check_in_lng numeric(9,6),
  status attendance_status not null default 'ON_TIME',
  exception_reason varchar(255),
  exception_granted_by_user_id uuid references auth.users(id),
  check_out_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_attendance_tenant on public.attendance(tenant_id);
create index if not exists idx_attendance_employee on public.attendance(employee_id);

-- Congés / absences (workflow demande → approbation)
create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  employee_id uuid not null references public.employees(id),
  start_date date not null,
  end_date date not null,
  reason varchar(255),
  status leave_status not null default 'PENDING',
  approved_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leaves_tenant on public.leaves(tenant_id);

-- ---------------------------------------------------------------------------
-- 9. CATEGORIES / PRODUCT_TYPES / UNITS (tenant_id nullable = global)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id),
  name varchar(120) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_categories_tenant on public.categories(tenant_id);

create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id),
  name varchar(120) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_product_types_tenant on public.product_types(tenant_id);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id),
  name varchar(120) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_units_tenant on public.units(tenant_id);

-- ---------------------------------------------------------------------------
-- 10. PRODUCTS + PRICE_HISTORY
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  name varchar(120) not null,
  category_id uuid references public.categories(id),
  type_id uuid references public.product_types(id),
  unit_id uuid references public.units(id),
  price integer not null default 0,
  image_url text,
  current_stock integer not null default 0,
  alert_threshold integer not null default 0,
  safety_threshold integer not null default 0,
  section order_item_section not null default 'BAR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_products_tenant on public.products(tenant_id);
create index if not exists idx_products_category on public.products(category_id);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  old_price integer,
  new_price integer not null,
  changed_by_user_id uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create index if not exists idx_price_history_product on public.price_history(product_id);

-- ---------------------------------------------------------------------------
-- 11. STOCK_MOVEMENTS / INVENTORIES / INVENTORY_LINES
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  product_id uuid not null references public.products(id),
  movement_type stock_movement_type not null,
  quantity integer not null,
  reason varchar(255),
  responsible_user_id uuid references auth.users(id),
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_movements_tenant on public.stock_movements(tenant_id);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);

create table if not exists public.inventories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  performed_at timestamptz not null default now(),
  performed_by_user_id uuid references auth.users(id),
  status inventory_status not null default 'IN_PROGRESS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inventories_tenant on public.inventories(tenant_id);

create table if not exists public.inventory_lines (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  product_id uuid not null references public.products(id),
  theoretical_quantity integer not null default 0,
  actual_quantity integer,
  discrepancy integer,
  interpretation inventory_interpretation,
  created_at timestamptz not null default now(),
  unique (inventory_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 12. SUPPLIERS
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  name varchar(120) not null,
  phone varchar(20),
  email varchar(150),
  address varchar(255),
  average_delivery_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_suppliers_tenant on public.suppliers(tenant_id);

-- ---------------------------------------------------------------------------
-- 13. PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  supplier_id uuid references public.suppliers(id),
  created_by_user_id uuid references auth.users(id),
  status purchase_order_status not null default 'DRAFT',
  validated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_purchase_orders_tenant on public.purchase_orders(tenant_id);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity_ordered integer not null,
  quantity_received integer,
  unit_price integer not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 14. DINING_TABLES + RESERVATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  number varchar(10) not null,
  zone varchar(50),
  capacity integer not null default 4,
  status table_status not null default 'FREE',
  qr_order_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index if not exists idx_dining_tables_tenant on public.dining_tables(tenant_id);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dining_tables(id),
  customer_name varchar(120),
  customer_phone varchar(20),
  reserved_at timestamptz not null,
  party_size integer not null default 1,
  status reservation_status not null default 'CONFIRMED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reservations_table on public.reservations(table_id);

-- ---------------------------------------------------------------------------
-- 15. ORDERS / ORDER_ITEMS
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  table_id uuid references public.dining_tables(id),
  server_user_id uuid references auth.users(id),
  status order_status not null default 'PENDING',
  source order_source not null default 'SERVER',
  offline_created boolean not null default false,
  client_generated_id uuid unique,
  cancelled_reason varchar(255),
  cancelled_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_tenant on public.orders(tenant_id);
create index if not exists idx_orders_status on public.orders(status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price integer not null,
  section order_item_section not null,
  assigned_to_user_id uuid references auth.users(id),
  status order_item_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_order_items_order on public.order_items(order_id);

-- ---------------------------------------------------------------------------
-- 16. INVOICES
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  order_id uuid references public.orders(id),
  legal_sequential_number varchar(30) not null,
  total_amount integer not null,
  tax_amount integer not null default 0,
  tip_amount integer not null default 0,
  pdf_url text,
  status invoice_status not null default 'ISSUED',
  created_at timestamptz not null default now(),
  unique (tenant_id, legal_sequential_number)
);
create index if not exists idx_invoices_tenant on public.invoices(tenant_id);
create index if not exists idx_invoices_order on public.invoices(order_id);

-- ---------------------------------------------------------------------------
-- 17. PAYMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id), -- nullable pour paiement d'abonnement avant activation
  payment_purpose payment_purpose not null,
  reference_id uuid,
  amount integer not null,
  method payment_method not null,
  aggregator aggregator_enum not null default 'NONE',
  aggregator_reference varchar(100),
  platform_commission_amount integer not null default 0,
  status payment_status not null default 'PENDING',
  webhook_received_at timestamptz,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_tenant on public.payments(tenant_id);
create index if not exists idx_payments_status on public.payments(status);

-- ---------------------------------------------------------------------------
-- 18. PAYROLLS
-- ---------------------------------------------------------------------------
create table if not exists public.payrolls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  employee_id uuid not null references public.employees(id),
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null,
  base_amount integer not null default 0,
  bonus_amount integer not null default 0,
  deduction_amount integer not null default 0,
  total_amount integer not null default 0,
  status payroll_status not null default 'DRAFT',
  validated_by_user_id uuid references auth.users(id),
  payment_id uuid,
  payslip_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_id, period_month, period_year)
);
create index if not exists idx_payrolls_tenant on public.payrolls(tenant_id);

-- ---------------------------------------------------------------------------
-- 19. TREASURY_MOVEMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id),
  movement_type treasury_movement_type not null,
  payment_method payment_method not null,
  amount integer not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_treasury_tenant on public.treasury_movements(tenant_id);

-- ---------------------------------------------------------------------------
-- 20. NOTIFICATIONS (messagerie + notifications)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id),
  sender_user_id uuid references auth.users(id),
  recipient_user_id uuid references auth.users(id),
  recipient_group_role_id uuid references public.roles(id),
  channel notification_channel not null default 'PUSH',
  event_type varchar(50),
  content text not null,
  requires_response boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_recipient on public.notifications(recipient_user_id);
create index if not exists idx_notifications_tenant on public.notifications(tenant_id);

-- ---------------------------------------------------------------------------
-- 21. AUDIT_LOGS (immuable)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id),
  user_id uuid references auth.users(id),
  action varchar(100) not null,
  entity_type varchar(50),
  entity_id uuid,
  ip_address varchar(45),
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_tenant on public.audit_logs(tenant_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at);
-- Pas de policy UPDATE/DELETE : journal non modifiable

-- ---------------------------------------------------------------------------
-- 22. AFFILIATES
-- ---------------------------------------------------------------------------
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  referral_code varchar(20) not null unique,
  referral_link varchar(255) not null unique,
  payment_method payment_method_enum,
  payment_account_ref varchar(100), -- chiffré au repos
  status affiliate_status not null default 'PENDING_VALIDATION',
  commission_rate_override numeric(5,2),
  commission_mode_override commission_mode,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_affiliates_user on public.affiliates(user_id);
create index if not exists idx_affiliates_status on public.affiliates(status);

-- FK différée : companies.affiliate_id
alter table public.companies
  add constraint fk_companies_affiliate foreign key (affiliate_id) references public.affiliates(id);

-- ---------------------------------------------------------------------------
-- 23. REFERRAL_TRACKINGS
-- ---------------------------------------------------------------------------
create table if not exists public.referral_trackings (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id),
  tracking_token varchar(64) not null unique,
  clicked_at timestamptz not null default now(),
  source varchar(100),
  converted_company_id uuid references public.companies(id),
  converted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_referral_tracking_affiliate on public.referral_trackings(affiliate_id);
create index if not exists idx_referral_tracking_token on public.referral_trackings(tracking_token);

alter table public.companies
  add constraint fk_companies_tracking foreign key (referral_tracking_id) references public.referral_trackings(id);

-- ---------------------------------------------------------------------------
-- 24. AFFILIATE_COMMISSIONS
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id),
  company_id uuid not null references public.companies(id),
  subscription_id uuid references public.subscriptions(id),
  amount integer not null,
  status commission_status not null default 'PENDING',
  validated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_affiliate_commissions_affiliate on public.affiliate_commissions(affiliate_id);
create index if not exists idx_affiliate_commissions_status on public.affiliate_commissions(status);

-- ---------------------------------------------------------------------------
-- 25. AFFILIATE_PAYOUTS
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id),
  amount integer not null,
  period_start timestamptz,
  period_end timestamptz,
  status payout_status not null default 'REQUESTED',
  payment_reference varchar(100),
  processed_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_affiliate_payouts_affiliate on public.affiliate_payouts(affiliate_id);

-- ---------------------------------------------------------------------------
-- 26. SUPPORT_TICKETS + TICKET_MESSAGES
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.companies(id),
  affiliate_id uuid references public.affiliates(id),
  created_by_user_id uuid references auth.users(id),
  subject varchar(150) not null,
  status support_ticket_status not null default 'OPEN',
  assigned_to_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_support_tickets_tenant on public.support_tickets(tenant_id);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FK restantes
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint fk_profiles_role foreign key (role_id) references public.roles(id);

-- ---------------------------------------------------------------------------
-- Trigger générique updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['companies','subscriptions','profiles','roles','employees','schedules','products','inventories','suppliers','purchase_orders','dining_tables','orders','order_items','payments','payrolls','affiliates','affiliate_payouts','support_tickets','leaves','notifications','platform_config']
  loop
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
