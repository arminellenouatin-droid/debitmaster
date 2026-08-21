-- ============================================================================
-- DebitManager — Migration 0004 : Opérations métier avancées
-- Paiements (initiation/confirmation/remboursement), cycle de vie abonnement,
-- badgeage géolocalisé, approvisionnements, inventaire, commande QR client.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Géolocalisation du lieu de travail (badgeage)
-- Évolution documentée du schéma (docs/data-model.md §28)
-- ---------------------------------------------------------------------------
alter table public.companies add column if not exists geo_lat numeric(9,6);
alter table public.companies add column if not exists geo_lng numeric(9,6);

-- ---------------------------------------------------------------------------
-- Helper config
-- ---------------------------------------------------------------------------
create or replace function public.cfg_int(p_key text, p_field text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((value->>p_field)::int, p_default) from public.platform_config where key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- RPC : initiation d'un paiement (mobile money / carte)
-- ---------------------------------------------------------------------------
create or replace function public.start_payment(
  p_purpose payment_purpose,
  p_reference_id uuid,
  p_amount integer,
  p_method payment_method,
  p_aggregator aggregator_enum default 'NONE',
  p_tenant uuid default null
) returns public.payments language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
  v_tenant uuid := coalesce(p_tenant, public.get_my_tenant_id());
begin
  insert into public.payments (tenant_id, payment_purpose, reference_id, amount, method, aggregator, status)
  values (v_tenant, p_purpose, p_reference_id, p_amount, p_method, p_aggregator, 'PENDING')
  returning * into v_payment;
  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC interne : commission d'affiliation sur paiement d'abonnement
-- ---------------------------------------------------------------------------
create or replace function public.create_affiliate_commission(p_subscription_id uuid, p_amount integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions;
  v_company public.companies;
  v_affiliate public.affiliates;
  v_cfg jsonb;
  v_rate numeric := 10;
  v_mode text := 'RECURRING';
  v_is_first boolean;
  v_amount integer;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if v_sub.id is null then return; end if;
  select * into v_company from public.companies where id = v_sub.tenant_id;
  if v_company.affiliate_id is null then return; end if;

  select value into v_cfg from public.platform_config where key = 'affiliate_program';
  v_rate := coalesce((v_cfg->>'commission_rate_percent')::numeric, 10);
  v_mode := coalesce((v_cfg->>'commission_mode')::text, 'RECURRING');

  select * into v_affiliate from public.affiliates where id = v_company.affiliate_id;
  if v_affiliate.commission_rate_override is not null then v_rate := v_affiliate.commission_rate_override; end if;
  if v_affiliate.commission_mode_override is not null then v_mode := v_affiliate.commission_mode_override::text; end if;

  v_is_first := not exists (
    select 1 from public.affiliate_commissions ac
    where ac.affiliate_id = v_company.affiliate_id and ac.company_id = v_company.id
  );
  if v_mode = 'FIRST_PAYMENT' and not v_is_first then return; end if;

  v_amount := round(p_amount * v_rate / 100.0);
  insert into public.affiliate_commissions (affiliate_id, company_id, subscription_id, amount, status)
  values (v_company.affiliate_id, v_company.id, v_sub.id, v_amount, 'PENDING');

  insert into public.notifications (tenant_id, recipient_user_id, channel, event_type, content)
  select null, v_affiliate.user_id, 'PUSH', 'AFFILIATE_COMMISSION',
         'Commission créditée : ' || v_amount || ' F — boutique ' || v_company.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : confirmation de paiement (appelé par les webhooks agrégateurs)
-- Marque SUCCESS, calcule la commission 1%, met à jour la ressource liée.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_aggregator_reference varchar default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
  v_rate numeric := 1;
  v_invoice public.invoices;
  v_order public.orders;
  v_sub public.subscriptions;
  v_item record;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then raise exception 'Paiement introuvable'; end if;
  if v_payment.status = 'SUCCESS' then return; end if; -- idempotent

  update public.payments
  set status = 'SUCCESS', aggregator_reference = coalesce(p_aggregator_reference, aggregator_reference),
      webhook_received_at = now(), reconciled = true
  where id = p_payment_id;

  -- Commission plateforme 1% sur carte/mobile money
  if v_payment.method <> 'CASH' then
    v_rate := coalesce((select (value->>'percent')::numeric from public.platform_config where key = 'platform_commission_rate'), 1);
    update public.payments set platform_commission_amount = round(v_payment.amount * v_rate / 100.0)
    where id = p_payment_id;
  end if;

  if v_payment.payment_purpose = 'ORDER' then
    select * into v_invoice from public.invoices where id = v_payment.reference_id;
    if v_invoice.id is not null then
      update public.invoices set status = 'PAID' where id = v_invoice.id;
      if v_invoice.order_id is not null then
        select * into v_order from public.orders where id = v_invoice.order_id;
        update public.orders set status = 'PAID', updated_at = now() where id = v_order.id;
        if v_order.table_id is not null then
          update public.dining_tables set status = 'FREE', updated_at = now() where id = v_order.table_id;
        end if;
        for v_item in select oi.product_id, oi.quantity from public.order_items oi where oi.order_id = v_order.id loop
          update public.products set current_stock = greatest(0, current_stock - v_item.quantity) where id = v_item.product_id;
          insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reference_id)
          values (v_payment.tenant_id, v_item.product_id, 'OUT_SALE', -v_item.quantity, v_invoice.id);
        end loop;
      end if;
      insert into public.treasury_movements (tenant_id, movement_type, payment_method, amount, reference_id)
      values (v_payment.tenant_id, 'SALE_INCOME', v_payment.method, v_payment.amount, v_invoice.id);
    end if;
  elsif v_payment.payment_purpose = 'SUBSCRIPTION' then
    select * into v_sub from public.subscriptions where id = v_payment.reference_id;
    if v_sub.id is not null then
      update public.subscriptions set status = 'ACTIVE', payment_id = p_payment_id, updated_at = now()
      where id = v_sub.id;
      update public.companies set status = 'ACTIVE', trial_ends_at = null, updated_at = now()
      where id = v_sub.tenant_id;
      perform public.create_affiliate_commission(v_sub.id, v_payment.amount);
    end if;
  elsif v_payment.payment_purpose = 'PAYROLL' then
    update public.payrolls set status = 'PAID', payment_id = p_payment_id, updated_at = now()
    where id = v_payment.reference_id;
    insert into public.treasury_movements (tenant_id, movement_type, payment_method, amount, reference_id)
    values (v_payment.tenant_id, 'PAYROLL_OUTFLOW', v_payment.method, -v_payment.amount, v_payment.reference_id);
  end if;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (v_payment.tenant_id, auth.uid(), 'PAYMENT_CONFIRMED', 'Payment', p_payment_id,
          jsonb_build_object('amount', v_payment.amount, 'method', v_payment.method::text,
                             'purpose', v_payment.payment_purpose::text));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : remboursement (traçé, rejette les commissions d'affiliation liées)
-- ---------------------------------------------------------------------------
create or replace function public.refund_payment(p_payment_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then raise exception 'Paiement introuvable'; end if;

  update public.payments set status = 'REFUNDED', reconciled = true, updated_at = now() where id = p_payment_id;

  if v_payment.payment_purpose = 'SUBSCRIPTION' then
    update public.subscriptions set status = 'CANCELLED', updated_at = now() where id = v_payment.reference_id;
    update public.affiliate_commissions set status = 'REJECTED', validated_at = now()
    where subscription_id = v_payment.reference_id and status = 'PENDING';
  elsif v_payment.payment_purpose = 'ORDER' then
    update public.invoices set status = 'REFUNDED' where id = v_payment.reference_id;
  end if;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (v_payment.tenant_id, auth.uid(), 'PAYMENT_REFUNDED', 'Payment', p_payment_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : badgeage entrée avec contrainte de géolocalisation (user-flows §4)
-- ---------------------------------------------------------------------------
create or replace function public.check_in(p_lat numeric, p_lng numeric)
returns public.attendance language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_emp public.employees;
  v_company public.companies;
  v_radius int := 500;
  v_dist numeric;
  v_status attendance_status := 'ON_TIME';
  v_sched public.schedules;
  v_late_min int := 10;
  v_block_min int := 30;
  v_att public.attendance;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.tenant_id is null then raise exception 'Employé non rattaché à une boutique'; end if;
  select * into v_emp from public.employees where user_id = auth.uid() and deleted_at is null order by created_at desc limit 1;
  if v_emp.id is null then raise exception 'Profil employé introuvable'; end if;
  select * into v_company from public.companies where id = v_profile.tenant_id;

  v_radius := public.cfg_int('attendance', 'geo_radius_meters', 500);
  v_late_min := public.cfg_int('attendance', 'late_minutes', 10);
  v_block_min := public.cfg_int('attendance', 'block_minutes', 30);

  -- Contrôle géographique (si le lieu de travail est renseigné)
  if v_company.geo_lat is not null and v_company.geo_lng is not null then
    if p_lat is null or p_lng is null then raise exception 'Géolocalisation requise pour le badgeage'; end if;
    v_dist := 6371000 * acos(
      least(1, cos(radians(v_company.geo_lat)) * cos(radians(p_lat)) * cos(radians(p_lng - v_company.geo_lng))
            + sin(radians(v_company.geo_lat)) * sin(radians(p_lat)))
    );
    if v_dist > v_radius then
      raise exception 'Hors zone : position à %m du lieu de travail (rayon %m)', round(v_dist), v_radius
        using errcode = 'P0001';
    end if;
  end if;

  -- Règle de temporisation vs planning du jour
  select * into v_sched from public.schedules
  where employee_id = v_emp.id
    and day_of_week = (select case extract(dow from now()) when 0 then 'SUN' when 1 then 'MON' when 2 then 'TUE' when 3 then 'WED' when 4 then 'THU' when 5 then 'FRI' else 'SAT' end)
    and exception_date is null
  order by start_time limit 1;

  if v_sched.id is not null and now()::time > v_sched.start_time + (v_block_min || ' minutes')::interval then
    raise exception 'Retard supérieur à % minutes : autorisation superviseur requise', v_block_min
      using errcode = 'P0001';
  elsif v_sched.id is not null and now()::time > v_sched.start_time + (v_late_min || ' minutes')::interval then
    v_status := 'LATE';
  end if;

  insert into public.attendance (employee_id, tenant_id, check_in_at, check_in_lat, check_in_lng, status)
  values (v_emp.id, v_profile.tenant_id, now(), p_lat, p_lng, v_status)
  returning * into v_att;

  -- Notification temps réel au superviseur (canal attendance)
  insert into public.notifications (tenant_id, recipient_user_id, channel, event_type, content)
  select v_att.tenant_id, p.id, 'PUSH', 'ATTENDANCE_CHECK_IN',
         v_profile.first_name || ' ' || v_profile.last_name || ' a pointé (' || v_status || ')'
  from public.profiles p
  where p.tenant_id = v_att.tenant_id and p.status = 'ACTIVE' and p.role_id in (
    select r.id from public.roles r
    where r.tenant_id = v_att.tenant_id and r.name in ('PROMOTEUR', 'ADMINISTRATEUR', 'GERANT_SUPERVISEUR')
  );

  return v_att;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : badgeage sortie
-- ---------------------------------------------------------------------------
create or replace function public.check_out()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_emp public.employees;
  v_tenant uuid := public.get_my_tenant_id();
begin
  select * into v_emp from public.employees where user_id = auth.uid() and deleted_at is null order by created_at desc limit 1;
  update public.attendance set check_out_at = now()
  where employee_id = v_emp.id and check_out_at is null
    and check_in_at::date = current_date;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : bon de commande — validation
-- ---------------------------------------------------------------------------
create or replace function public.validate_purchase_order(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_po public.purchase_orders;
begin
  select * into v_po from public.purchase_orders where id = p_id;
  if v_po.id is null then raise exception 'Bon de commande introuvable'; end if;
  update public.purchase_orders set status = 'VALIDATED', validated_by_user_id = auth.uid(), updated_at = now()
  where id = p_id;
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id)
  values (v_po.tenant_id, auth.uid(), 'PURCHASE_ORDER_VALIDATED', 'PurchaseOrder', p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : bon de commande — réception marchandise (met à jour le stock)
-- ---------------------------------------------------------------------------
create or replace function public.receive_purchase_order(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_po public.purchase_orders;
  v_item record;
begin
  select * into v_po from public.purchase_orders where id = p_id;
  if v_po.id is null then raise exception 'Bon de commande introuvable'; end if;

  for v_item in select * from public.purchase_order_items where purchase_order_id = p_id loop
    update public.purchase_order_items
    set quantity_received = coalesce(quantity_received, quantity_ordered)
    where id = v_item.id;
    update public.products
    set current_stock = current_stock + coalesce(v_item.quantity_received, v_item.quantity_ordered)
    where id = v_item.product_id;
    insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reference_id)
    values (v_po.tenant_id, v_item.product_id, 'IN_PURCHASE',
            coalesce(v_item.quantity_received, v_item.quantity_ordered), v_po.id);
  end loop;

  update public.purchase_orders set status = 'RECEIVED', updated_at = now() where id = p_id;
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id)
  values (v_po.tenant_id, auth.uid(), 'PURCHASE_ORDER_RECEIVED', 'PurchaseOrder', p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : inventaire — clôture (écarts + interprétation + ajustement stock)
-- ---------------------------------------------------------------------------
create or replace function public.complete_inventory(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv public.inventories;
  v_line record;
  v_interpretation inventory_interpretation;
  v_pct numeric;
begin
  select * into v_inv from public.inventories where id = p_id;
  if v_inv.id is null then raise exception 'Inventaire introuvable'; end if;

  for v_line in select * from public.inventory_lines where inventory_id = p_id loop
    if v_line.actual_quantity is null then
      update public.inventory_lines set actual_quantity = v_line.theoretical_quantity where id = v_line.id;
    end if;
    select actual_quantity - theoretical_quantity into v_line.discrepancy
    from public.inventory_lines where id = v_line.id;

    v_pct := case when v_line.theoretical_quantity > 0
             then abs(v_line.discrepancy)::numeric / v_line.theoretical_quantity * 100 else 0 end;

    v_interpretation := case
      when v_line.discrepancy = 0 then 'OK'
      when v_line.discrepancy < 0 and v_pct <= 5 then 'PROBABLE_LOSS'
      when v_line.discrepancy < 0 then 'PROBABLE_THEFT'
      else 'INPUT_ERROR' end;

    update public.inventory_lines
    set discrepancy = v_line.discrepancy, interpretation = v_interpretation
    where id = v_line.id;

    if v_line.discrepancy < 0 then
      update public.products set current_stock = greatest(0, current_stock + v_line.discrepancy)
      where id = v_line.product_id;
      insert into public.stock_movements (tenant_id, product_id, movement_type, quantity, reason, reference_id)
      values (v_inv.tenant_id, v_line.product_id, 'ADJUSTMENT', v_line.discrepancy,
              'Ajustement inventaire', v_inv.id);
    end if;
  end loop;

  update public.inventories set status = 'COMPLETED', updated_at = now() where id = p_id;
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id)
  values (v_inv.tenant_id, auth.uid(), 'INVENTORY_COMPLETED', 'Inventory', p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : cycle de vie des abonnements (rappel J-7/J-3/J-1, grâce 3 j, suspension)
-- À appeler quotidiennement (cron / Edge Function run-lifecycle)
-- ---------------------------------------------------------------------------
create or replace function public.run_subscription_lifecycle()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_grace int := 3;
  v_company record;
begin
  v_grace := public.cfg_int('grace', 'days', 3);

  -- Essais expirés → période de grâce
  update public.companies set status = 'GRACE_PERIOD', updated_at = now()
  where status = 'TRIAL' and trial_ends_at < now();

  -- Abonnements actifs expirés → grâce
  update public.subscriptions set status = 'GRACE_PERIOD', updated_at = now()
  where status = 'ACTIVE' and period_end < now();
  update public.companies c set status = 'GRACE_PERIOD', updated_at = now()
  where c.status = 'ACTIVE' and exists (
    select 1 from public.subscriptions s
    where s.tenant_id = c.id and s.status = 'GRACE_PERIOD'
  );

  -- Grâce dépassée → suspension
  update public.companies set status = 'SUSPENDED', updated_at = now()
  where status = 'GRACE_PERIOD' and updated_at < now() - (v_grace || ' days')::interval;

  -- Rappels J-7 / J-3 / J-1 (sans doublon par jour)
  for v_company in
    select c.id, c.name, c.owner_user_id,
           (select s.period_end from public.subscriptions s
            where s.tenant_id = c.id and s.status = 'ACTIVE' order by period_end desc limit 1) as period_end
    from public.companies c where c.status = 'ACTIVE'
  loop
    if v_company.period_end is not null then
      if v_company.period_end - now() <= interval '7 days'
         and not exists (select 1 from public.notifications n
                         where n.tenant_id = v_company.id and n.event_type = 'SUBSCRIPTION_EXPIRING'
                           and n.created_at::date = current_date) then
        insert into public.notifications (tenant_id, recipient_user_id, channel, event_type, content)
        values (v_company.id, v_company.owner_user_id, 'PUSH', 'SUBSCRIPTION_EXPIRING',
                'Abonnement ' || v_company.name || ' expire le ' || to_char(v_company.period_end, 'DD/MM/YYYY'));
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : menu public d'une table (QR client) — lecture bornée au tenant de la table
-- ---------------------------------------------------------------------------
create or replace function public.get_menu(p_table_id uuid)
returns table (product_id uuid, name varchar, price integer, category varchar, section order_item_section)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.dining_tables where id = p_table_id;
  if v_tenant is null then return; end if;
  return query
    select p.id, p.name, p.price, coalesce(c.name, 'Autres'), p.section
    from public.products p
    left join public.categories c on c.id = p.category_id
    where p.tenant_id = v_tenant and p.is_active and p.deleted_at is null
    order by c.name, p.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC : commande via QR client (public, tracée source=QR_CLIENT)
-- ---------------------------------------------------------------------------
create or replace function public.create_qr_order(p_table_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_table public.dining_tables;
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product public.products;
begin
  select * into v_table from public.dining_tables where id = p_table_id;
  if v_table.id is null then raise exception 'Table introuvable'; end if;
  if not v_table.qr_order_enabled then raise exception 'Commande QR désactivée pour cette table'; end if;

  insert into public.orders (id, tenant_id, table_id, status, source, client_generated_id)
  values (v_order_id, v_table.tenant_id, v_table.id, 'PENDING', 'QR_CLIENT', gen_random_uuid());

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and tenant_id = v_table.tenant_id and is_active;
    if v_product.id is null then raise exception 'Produit invalide'; end if;
    insert into public.order_items (order_id, product_id, quantity, unit_price, section)
    values (v_order_id, v_product.id, (v_item->>'quantity')::int, v_product.price, v_product.section);
  end loop;

  update public.dining_tables set status = 'OCCUPIED', updated_at = now() where id = v_table.id;
  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.start_payment(payment_purpose, uuid, integer, payment_method, aggregator_enum, uuid) to authenticated;
grant execute on function public.confirm_payment(uuid, varchar) to authenticated, service_role;
grant execute on function public.refund_payment(uuid, text) to authenticated;
grant execute on function public.check_in(numeric, numeric) to authenticated;
grant execute on function public.check_out() to authenticated;
grant execute on function public.validate_purchase_order(uuid) to authenticated;
grant execute on function public.receive_purchase_order(uuid) to authenticated;
grant execute on function public.complete_inventory(uuid) to authenticated;
grant execute on function public.run_subscription_lifecycle() to service_role;
grant execute on function public.get_menu(uuid) to anon, authenticated;
grant execute on function public.create_qr_order(uuid, jsonb) to anon, authenticated;
grant execute on function public.cfg_int(text, text, int) to authenticated;
