-- ============================================================================
-- DebitManager — Migration 0003 : RLS, triggers et fonctions métier (RPC)
-- Isolation multi-tenant stricte : toute requête filtrée par tenant_id
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers d'autorisation
-- ---------------------------------------------------------------------------
create or replace function public.get_my_user_type()
returns text language sql stable security definer set search_path = public as $$
  select user_type::text from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select user_type = 'SUPER_ADMIN' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Trigger : création automatique du profil à l'inscription auth
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, phone, first_name, last_name, user_type)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    'TENANT_STAFF'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Compteurs par tenant (numérotation légale des factures)
-- ---------------------------------------------------------------------------
create table if not exists public.company_counters (
  tenant_id uuid primary key references public.companies(id) on delete cascade,
  invoice_counter integer not null default 0
);

-- ---------------------------------------------------------------------------
-- RPC : numéro de facture séquentiel légal
-- ---------------------------------------------------------------------------
create or replace function public.next_invoice_number(p_tenant_id uuid)
returns varchar(30) language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from now());
  v_count int;
begin
  insert into public.company_counters (tenant_id, invoice_counter)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update set invoice_counter = public.company_counters.invoice_counter + 1
  returning invoice_counter into v_count;
  return 'FAC-' || v_year || '-' || lpad(v_count::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : initialisation d'une boutique (clone des 11 rôles prédéfinis)
-- ---------------------------------------------------------------------------
create or replace function public.initialize_company(p_company_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_template record;
  v_new_role_id uuid;
begin
  for v_template in
    select r.id as template_role_id, r.name
    from public.roles r
    where r.tenant_id is null and r.is_predefined
  loop
    insert into public.roles (tenant_id, name, is_predefined)
    values (p_company_id, v_template.name, true)
    returning id into v_new_role_id;

    insert into public.role_permissions (role_id, permission_id, granted)
    select v_new_role_id, rp.permission_id, rp.granted
    from public.role_permissions rp
    where rp.role_id = v_template.template_role_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : création de boutique (parcours exploitant, flow 1 user-flows)
-- ---------------------------------------------------------------------------
create or replace function public.create_company(
  p_name varchar,
  p_activity_type activity_type,
  p_country varchar default 'BJ',
  p_currency varchar default 'XOF',
  p_language varchar default 'fr',
  p_address varchar default null,
  p_logo_url text default null,
  p_referral_code varchar default null
) returns public.companies language plpgsql security definer set search_path = public as $$
declare
  v_company public.companies;
  v_code varchar(10);
  v_affiliate public.affiliates;
  v_tracking_id uuid;
  v_config jsonb;
  v_trial_days int := 14;
  v_promo_role uuid;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  -- Code société unique
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.companies where unique_code = v_code);
  end loop;

  -- Durée d'essai depuis la config plateforme
  select (value->>'days')::int into v_trial_days
  from public.platform_config where key = 'trial';

  insert into public.companies (
    name, activity_type, unique_code, country, currency, language,
    logo_url, address, status, trial_ends_at, owner_user_id
  ) values (
    p_name, p_activity_type, v_code, p_country, p_currency, p_language,
    p_logo_url, p_address, 'TRIAL', now() + (v_trial_days || ' days')::interval, auth.uid()
  ) returning * into v_company;

  -- Clone des rôles prédéfinis
  perform public.initialize_company(v_company.id);

  -- Rattachement de l'exploitant au rôle Promoteur
  select id into v_promo_role from public.roles where tenant_id = v_company.id and name = 'PROMOTEUR';
  update public.profiles set tenant_id = v_company.id, role_id = v_promo_role, user_type = 'TENANT_STAFF'
  where id = auth.uid();

  -- Attribution affilié (premier lien cliqué / code saisi)
  if p_referral_code is not null and p_referral_code <> '' then
    select * into v_affiliate from public.affiliates
    where referral_code = upper(p_referral_code) and status = 'ACTIVE';
    if v_affiliate.id is not null then
      insert into public.referral_trackings (affiliate_id, tracking_token, source, converted_company_id, converted_at, expires_at)
      values (v_affiliate.id, md5(random()::text || clock_timestamp()::text), 'CODE', v_company.id, now(), now() + interval '30 days')
      returning id into v_tracking_id;

      update public.companies
      set affiliate_id = v_affiliate.id, referral_tracking_id = v_tracking_id
      where id = v_company.id;
    end if;
  end if;

  -- Audit
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (v_company.id, auth.uid(), 'TENANT_CREATED', 'Company', v_company.id,
          jsonb_build_object('name', p_name, 'activity_type', p_activity_type::text));

  return v_company;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : encaissement espèces (atomique : facture + paiement + stock + trésorerie)
-- ---------------------------------------------------------------------------
create or replace function public.record_cash_payment(
  p_order_id uuid,
  p_amount integer,
  p_tip integer default 0
) returns public.invoices language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_invoice public.invoices;
  v_payment public.payments;
  v_tax_pct numeric;
  v_tax integer;
  v_total integer;
  v_item record;
  v_tenant uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.status = 'PAID' then raise exception 'Commande déjà payée'; end if;
  v_tenant := v_order.tenant_id;

  -- TVA configurée (défaut 18%)
  select coalesce((value->>'vat_percent')::numeric, 18) into v_tax_pct
  from public.platform_config where key = 'tax';
  v_tax := round((p_amount - p_tip) * v_tax_pct / 100.0);

  -- Facture avec numéro légal séquentiel
  insert into public.invoices (tenant_id, order_id, legal_sequential_number, total_amount, tax_amount, tip_amount, status)
  values (v_tenant, v_order.id, public.next_invoice_number(v_tenant), p_amount, v_tax, p_tip, 'PAID')
  returning * into v_invoice;

  -- Paiement espèces
  insert into public.payments (tenant_id, payment_purpose, reference_id, amount, method, aggregator, status, reconciled)
  values (v_tenant, 'ORDER', v_invoice.id, p_amount, 'CASH', 'NONE', 'SUCCESS', true)
  returning * into v_payment;

  -- Mouvement de trésorerie
  insert into public.treasury_movements (tenant_id, movement_type, payment_method, amount, reference_id)
  values (v_tenant, 'SALE_INCOME', 'CASH', p_amount, v_invoice.id);

  -- Sortie de stock + mouvements OUT_SALE
  for v_item in
    select oi.product_id, oi.quantity
    from public.order_items oi where oi.order_id = v_order.id
  loop
    update public.products
    set current_stock = greatest(0, current_stock - v_item.quantity)
    where id = v_item.product_id;

    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reference_id)
    values (v_tenant, v_item.product_id, 'OUT_SALE', -v_item.quantity, v_invoice.id);
  end loop;

  -- Clôture de la commande
  update public.orders set status = 'PAID', updated_at = now() where id = v_order.id;
  if v_order.table_id is not null then
    update public.dining_tables set status = 'FREE', updated_at = now() where id = v_order.table_id;
  end if;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (v_tenant, auth.uid(), 'CASH_PAYMENT_RECORDED', 'Invoice', v_invoice.id,
          jsonb_build_object('amount', p_amount, 'payment_id', v_payment.id));

  return v_invoice;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger : alerte stock dès franchissement du seuil
-- ---------------------------------------------------------------------------
create or replace function public.stock_alert_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_product public.products;
  v_company public.companies;
begin
  select * into v_product from public.products where id = new.product_id;
  if v_product.current_stock <= v_product.alert_threshold and v_product.alert_threshold > 0 then
    select * into v_company from public.companies where id = new.tenant_id;
    insert into public.notifications (tenant_id, recipient_user_id, channel, event_type, content)
    select new.tenant_id, p.id, 'PUSH', 'STOCK_ALERT',
           'Stock bas : ' || v_product.name || ' (' || v_product.current_stock || ')'
    from public.profiles p
    where p.tenant_id = new.tenant_id
      and p.status = 'ACTIVE'
      and (
        p.id = v_company.owner_user_id
        or p.role_id in (
          select r.id from public.roles r
          where r.tenant_id = new.tenant_id and r.name in ('ADMINISTRATEUR', 'MAGASINIER', 'APPROVISIONNEMENT')
        )
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stock_alert on public.stock_movements;
create trigger trg_stock_alert
  after insert on public.stock_movements
  for each row execute function public.stock_alert_trigger();

-- ---------------------------------------------------------------------------
-- RPC : tracking public d'un clic de lien de parrainage (flow 9 user-flows)
-- ---------------------------------------------------------------------------
create or replace function public.track_referral_click(p_code varchar, p_source varchar default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_affiliate public.affiliates;
  v_token varchar(64);
  v_ttl_days int := 30;
  v_expires timestamptz;
begin
  select * into v_affiliate from public.affiliates
  where referral_code = upper(p_code) and status = 'ACTIVE';
  if v_affiliate.id is null then
    return jsonb_build_object('ok', false, 'error', 'Code invalide');
  end if;

  select (value->>'tracking_ttl_days')::int into v_ttl_days
  from public.platform_config where key = 'affiliate_program';

  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires := now() + (v_ttl_days || ' days')::interval;

  insert into public.referral_trackings (affiliate_id, tracking_token, source, expires_at)
  values (v_affiliate.id, v_token, p_source, v_expires);

  return jsonb_build_object('ok', true, 'tracking_token', v_token,
                            'expires_at', v_expires, 'referral_link', v_affiliate.referral_link);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : grille tarifaire publique (plans + essai)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_plans()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pricing', coalesce((select value from public.platform_config where key = 'pricing'), '{}'::jsonb),
    'trial_days', coalesce((select (value->>'days')::int from public.platform_config where key = 'trial'), 14)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS : activation sur toutes les tables
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.subscriptions enable row level security;
alter table public.platform_config enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.employees enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.leaves enable row level security;
alter table public.categories enable row level security;
alter table public.product_types enable row level security;
alter table public.units enable row level security;
alter table public.products enable row level security;
alter table public.price_history enable row level security;
alter table public.stock_movements enable row level security;
alter table public.inventories enable row level security;
alter table public.inventory_lines enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.dining_tables enable row level security;
alter table public.reservations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payrolls enable row level security;
alter table public.treasury_movements enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.affiliates enable row level security;
alter table public.referral_trackings enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.company_counters enable row level security;

-- ---------------------------------------------------------------------------
-- POLICIES
-- ---------------------------------------------------------------------------

-- COMPANIES : propriétaire ou staff du tenant ; Super-Admin tout
create policy companies_select on public.companies for select
  using (id = public.get_my_tenant_id() or owner_user_id = auth.uid() or public.is_super_admin());
create policy companies_insert on public.companies for insert
  with check (owner_user_id = auth.uid());
create policy companies_update on public.companies for update
  using (owner_user_id = auth.uid() or public.is_super_admin())
  with check (owner_user_id = auth.uid() or public.is_super_admin());

-- SUBSCRIPTIONS
create policy subscriptions_select on public.subscriptions for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy subscriptions_insert on public.subscriptions for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy subscriptions_update on public.subscriptions for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

-- PLATFORM_CONFIG : lecture pour les connectés (RPC public pour l'anon), écriture Super-Admin
create policy platform_config_select on public.platform_config for select
  using (auth.role() = 'authenticated');
create policy platform_config_update on public.platform_config for update
  using (public.is_super_admin());

-- PROFILES
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- ROLES / PERMISSIONS : lecture partout (connectés), gestion par tenant ou Super-Admin
create policy roles_select on public.roles for select using (auth.role() = 'authenticated');
create policy roles_insert on public.roles for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy roles_update on public.roles for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy permissions_select on public.permissions for select using (auth.role() = 'authenticated');
create policy role_permissions_select on public.role_permissions for select using (auth.role() = 'authenticated');
create policy role_permissions_insert on public.role_permissions for insert
  with check (exists (select 1 from public.roles r where r.id = role_id and (r.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy role_permissions_update on public.role_permissions for update
  using (exists (select 1 from public.roles r where r.id = role_id and (r.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

-- EMPLOYEES / SCHEDULES / ATTENDANCE / LEAVES
create policy employees_select on public.employees for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy employees_insert on public.employees for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy employees_update on public.employees for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy employees_delete on public.employees for delete
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

create policy schedules_select on public.schedules for select using (true);
create policy schedules_insert on public.schedules for insert
  with check (exists (select 1 from public.employees e where e.id = employee_id and (e.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy schedules_update on public.schedules for update
  using (exists (select 1 from public.employees e where e.id = employee_id and (e.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

create policy attendance_select on public.attendance for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin()
         or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()));
create policy attendance_insert on public.attendance for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy attendance_update on public.attendance for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

create policy leaves_select on public.leaves for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin()
         or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()));
create policy leaves_insert on public.leaves for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy leaves_update on public.leaves for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

-- CATALOGUE (tenant_id nullable = global)
create policy catalog_select on public.categories for select using (auth.role() = 'authenticated');
create policy catalog_insert on public.categories for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy catalog_update on public.categories for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy catalog_delete on public.categories for delete
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy catalog_select_t on public.product_types for select using (auth.role() = 'authenticated');
create policy catalog_insert_t on public.product_types for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy catalog_update_t on public.product_types for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy catalog_select_u on public.units for select using (auth.role() = 'authenticated');
create policy catalog_insert_u on public.units for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy catalog_update_u on public.units for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

-- PRODUCTS / PRICE_HISTORY / STOCK_MOVEMENTS
create policy products_select on public.products for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy products_insert on public.products for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy products_update on public.products for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy products_delete on public.products for delete
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

create policy price_history_select on public.price_history for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy price_history_insert on public.price_history for insert
  with check (exists (select 1 from public.products p where p.id = product_id and (p.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

create policy stock_movements_select on public.stock_movements for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy stock_movements_insert on public.stock_movements for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

-- INVENTORIES / INVENTORY_LINES
create policy inventories_select on public.inventories for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy inventories_insert on public.inventories for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy inventories_update on public.inventories for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy inventory_lines_select on public.inventory_lines for select
  using (exists (select 1 from public.inventories i where i.id = inventory_id and (i.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy inventory_lines_insert on public.inventory_lines for insert
  with check (exists (select 1 from public.inventories i where i.id = inventory_id and (i.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy inventory_lines_update on public.inventory_lines for update
  using (exists (select 1 from public.inventories i where i.id = inventory_id and (i.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

-- SUPPLIERS / PURCHASE_ORDERS
create policy suppliers_select on public.suppliers for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy suppliers_insert on public.suppliers for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy suppliers_update on public.suppliers for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

create policy purchase_orders_select on public.purchase_orders for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy purchase_orders_insert on public.purchase_orders for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy purchase_orders_update on public.purchase_orders for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy poi_select on public.purchase_order_items for select
  using (exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and (po.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy poi_insert on public.purchase_order_items for insert
  with check (exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and (po.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy poi_update on public.purchase_order_items for update
  using (exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and (po.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

-- DINING_TABLES / RESERVATIONS
create policy tables_select on public.dining_tables for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy tables_insert on public.dining_tables for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy tables_update on public.dining_tables for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy reservations_select on public.reservations for select
  using (exists (select 1 from public.dining_tables t where t.id = table_id and (t.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy reservations_insert on public.reservations for insert
  with check (exists (select 1 from public.dining_tables t where t.id = table_id and (t.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy reservations_update on public.reservations for update
  using (exists (select 1 from public.dining_tables t where t.id = table_id and (t.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

-- ORDERS / ORDER_ITEMS
create policy orders_select on public.orders for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy orders_insert on public.orders for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy orders_update on public.orders for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

create policy order_items_select on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy order_items_insert on public.order_items for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and (o.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy order_items_update on public.order_items for update
  using (exists (select 1 from public.orders o where o.id = order_id and (o.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

-- INVOICES / PAYMENTS
create policy invoices_select on public.invoices for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy invoices_insert on public.invoices for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy invoices_update on public.invoices for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

create policy payments_select on public.payments for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin() or tenant_id is null);
create policy payments_insert on public.payments for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin() or tenant_id is null);
create policy payments_update on public.payments for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin() or tenant_id is null);

-- PAYROLLS / TREASURY
create policy payrolls_select on public.payrolls for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin()
         or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()));
create policy payrolls_insert on public.payrolls for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy payrolls_update on public.payrolls for update
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

create policy treasury_select on public.treasury_movements for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy treasury_insert on public.treasury_movements for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin());

-- NOTIFICATIONS
create policy notifications_select on public.notifications for select
  using (recipient_user_id = auth.uid() or sender_user_id = auth.uid()
         or tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy notifications_insert on public.notifications for insert
  with check (tenant_id = public.get_my_tenant_id() or public.is_super_admin() or sender_user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (recipient_user_id = auth.uid() or public.is_super_admin());

-- AUDIT_LOGS : insertion connectée, lecture tenant/Super-Admin, jamais de modification
create policy audit_logs_select on public.audit_logs for select
  using (tenant_id = public.get_my_tenant_id() or public.is_super_admin());
create policy audit_logs_insert on public.audit_logs for insert
  with check (auth.role() = 'authenticated');

-- AFFILIATES
create policy affiliates_select on public.affiliates for select
  using (user_id = auth.uid() or public.is_super_admin());
create policy affiliates_insert on public.affiliates for insert
  with check (user_id = auth.uid());
create policy affiliates_update on public.affiliates for update
  using (user_id = auth.uid() or public.is_super_admin());

-- REFERRAL_TRACKINGS : lecture propriétaire/Super-Admin (insertion via RPC track_referral_click)
create policy referral_trackings_select on public.referral_trackings for select
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()) or public.is_super_admin());

-- AFFILIATE_COMMISSIONS
create policy affiliate_commissions_select on public.affiliate_commissions for select
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()) or public.is_super_admin());
create policy affiliate_commissions_update on public.affiliate_commissions for update
  using (public.is_super_admin());

-- AFFILIATE_PAYOUTS
create policy affiliate_payouts_select on public.affiliate_payouts for select
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()) or public.is_super_admin());
create policy affiliate_payouts_insert on public.affiliate_payouts for insert
  with check (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));
create policy affiliate_payouts_update on public.affiliate_payouts for update
  using (public.is_super_admin());

-- SUPPORT_TICKETS / TICKET_MESSAGES
create policy support_tickets_select on public.support_tickets for select
  using (created_by_user_id = auth.uid() or tenant_id = public.get_my_tenant_id()
         or affiliate_id in (select id from public.affiliates where user_id = auth.uid())
         or public.is_super_admin());
create policy support_tickets_insert on public.support_tickets for insert
  with check (created_by_user_id = auth.uid());
create policy support_tickets_update on public.support_tickets for update
  using (public.is_super_admin() or tenant_id = public.get_my_tenant_id());
create policy ticket_messages_select on public.ticket_messages for select
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id
                 and (t.created_by_user_id = auth.uid() or t.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));
create policy ticket_messages_insert on public.ticket_messages for insert
  with check (exists (select 1 from public.support_tickets t where t.id = ticket_id
                 and (t.created_by_user_id = auth.uid() or t.tenant_id = public.get_my_tenant_id() or public.is_super_admin())));

-- COMPANY_COUNTERS : accès via fonctions security definer uniquement
create policy company_counters_select on public.company_counters for select
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- REALTIME (WebSocket : commandes, notifications, alertes stock, tables)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.stock_movements;
alter publication supabase_realtime add table public.dining_tables;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant execute on function public.get_public_plans(text) to anon, authenticated;
grant execute on function public.track_referral_click(varchar, varchar) to anon, authenticated;
grant execute on function public.create_company(varchar, activity_type, varchar, varchar, varchar, varchar, text, varchar) to authenticated;
grant execute on function public.record_cash_payment(uuid, integer, integer) to authenticated;
grant execute on function public.next_invoice_number(uuid) to authenticated;
grant execute on function public.get_my_user_type() to anon, authenticated;
grant execute on function public.get_my_tenant_id() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
