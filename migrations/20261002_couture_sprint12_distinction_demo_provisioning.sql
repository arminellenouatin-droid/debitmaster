-- DebitMaster: Sprint 12 pour l'activité « Atelier de couture ».
-- Provisionnement complet et automatique de l'établissement de démonstration « DISTINCTION »
-- 1 atelier Lomé, 3 boutiques Lomé, 2 boutiques Douala, personnel complet, catalogue distinction, barème de paie à la tâche, horaires, primes et comptabilité SYSCOHADA.
begin;

create or replace function public.provision_distinction_demo_establishment()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_atelier_id uuid;
  v_nyeko_id uuid;
  v_hotel_id uuid;
  v_agoe_id uuid;
  v_bona_id uuid;
  v_priso_id uuid;
  v_range_leader uuid;
  v_range_vip uuid;
  v_range_royale uuid;
  v_range_pres uuid;
  v_mod_goodluck uuid;
  v_mod_danshiki uuid;
  v_mod_agbada uuid;
  v_mod_abacost uuid;
  v_mod_robe uuid;
  v_mod_boubou uuid;
begin
  -- 1. Récupérer ou créer l'établissement DISTINCTION
  select id into v_tenant_id from public.companies where name = 'DISTINCTION' and activity_type = 'ATELIER_COUTURE' limit 1;

  if v_tenant_id is null then
    insert into public.companies (
      name,
      activity_type,
      country,
      currency,
      status,
      trial_ends_at,
      subscription_plan,
      subscription_expires_at
    ) values (
      'DISTINCTION',
      'ATELIER_COUTURE',
      'Togo',
      'FCFA',
      'ACTIVE',
      null,
      'COUTURE_ANNUAL',
      '2099-12-31 23:59:59+00'
    ) returning id into v_tenant_id;
  end if;

  -- 2. Création des 6 Sites (1 atelier Lomé, 3 boutiques Lomé, 2 boutiques Douala)
  insert into public.couture_sites (tenant_id, name, site_type, country, city, address, currency, latitude, longitude, status)
  values
    (v_tenant_id, 'Atelier Central Kodjoviakopé', 'ATELIER', 'Togo', 'Lomé', 'Quartier Kodjoviakopé, Lomé, Togo', 'FCFA', 6.1285, 1.2150, 'ACTIVE')
  on conflict do nothing;

  select id into v_atelier_id from public.couture_sites where tenant_id = v_tenant_id and name = 'Atelier Central Kodjoviakopé' limit 1;

  insert into public.couture_sites (tenant_id, name, site_type, country, city, address, currency, latitude, longitude, status)
  values
    (v_tenant_id, 'Boutique Nyékonakpoè', 'BOUTIQUE', 'Togo', 'Lomé', 'Boulevard Circulaire, Nyékonakpoè, Lomé', 'FCFA', 6.1340, 1.2080, 'ACTIVE'),
    (v_tenant_id, 'Boutique Hôtel 2 Février', 'BOUTIQUE', 'Togo', 'Lomé', 'Galerie Marchande, Hôtel 2 Février, Lomé', 'FCFA', 6.1315, 1.2175, 'ACTIVE'),
    (v_tenant_id, 'Boutique Agoè Minamadou', 'BOUTIQUE', 'Togo', 'Lomé', 'Carrefour Minamadou, Agoè-Nyivé, Lomé', 'FCFA', 6.2100, 1.1950, 'ACTIVE'),
    (v_tenant_id, 'Boutique Bonamoussadi', 'BOUTIQUE', 'Cameroun', 'Douala', 'Rond-Point Maçon, Bonamoussadi, Douala', 'XAF', 4.0750, 9.7350, 'ACTIVE'),
    (v_tenant_id, 'Boutique Bonapriso', 'BOUTIQUE', 'Cameroun', 'Douala', 'Rue Tokoto, Bonapriso, Douala', 'XAF', 4.0250, 9.6980, 'ACTIVE')
  on conflict do nothing;

  -- 3. Gammes Distinction
  insert into public.couture_ranges (tenant_id, name, rank, is_active)
  values
    (v_tenant_id, 'Leader', 1, true),
    (v_tenant_id, 'VIP', 2, true),
    (v_tenant_id, 'Royale', 3, true),
    (v_tenant_id, 'Présidentiel', 4, true)
  on conflict do nothing;

  select id into v_range_leader from public.couture_ranges where tenant_id = v_tenant_id and name = 'Leader';
  select id into v_range_vip from public.couture_ranges where tenant_id = v_tenant_id and name = 'VIP';
  select id into v_range_royale from public.couture_ranges where tenant_id = v_tenant_id and name = 'Royale';
  select id into v_range_pres from public.couture_ranges where tenant_id = v_tenant_id and name = 'Présidentiel';

  -- 4. Modèles Distinction
  insert into public.couture_models (tenant_id, name, reference_code, target_gender, is_active)
  values
    (v_tenant_id, 'Goodluck', 'MOD-GDL', 'HOMME', true),
    (v_tenant_id, 'Danshiki', 'MOD-DNS', 'MIXTE', true),
    (v_tenant_id, 'Agbada', 'MOD-AGB', 'HOMME', true),
    (v_tenant_id, 'Abacost', 'MOD-ABC', 'HOMME', true),
    (v_tenant_id, 'Robe', 'MOD-ROB', 'FEMME', true),
    (v_tenant_id, 'Boubou', 'MOD-BOU', 'MIXTE', true)
  on conflict do nothing;

  select id into v_mod_goodluck from public.couture_models where tenant_id = v_tenant_id and name = 'Goodluck';
  select id into v_mod_danshiki from public.couture_models where tenant_id = v_tenant_id and name = 'Danshiki';
  select id into v_mod_agbada from public.couture_models where tenant_id = v_tenant_id and name = 'Agbada';
  select id into v_mod_abacost from public.couture_models where tenant_id = v_tenant_id and name = 'Abacost';
  select id into v_mod_robe from public.couture_models where tenant_id = v_tenant_id and name = 'Robe';
  select id into v_mod_boubou from public.couture_models where tenant_id = v_tenant_id and name = 'Boubou';

  -- 5. Grille tarifaire officielle DISTINCTION (adulte et enfant = 50%)
  if v_mod_goodluck is not null and v_range_leader is not null then
    insert into public.couture_price_grid (tenant_id, model_id, range_id, adult_price_xof, child_price_xof)
    values
      -- Goodluck
      (v_tenant_id, v_mod_goodluck, v_range_leader, 120000, 60000),
      (v_tenant_id, v_mod_goodluck, v_range_vip, 200000, 100000),
      (v_tenant_id, v_mod_goodluck, v_range_royale, 350000, 175000),
      (v_tenant_id, v_mod_goodluck, v_range_pres, 500000, 250000),
      -- Danshiki
      (v_tenant_id, v_mod_danshiki, v_range_leader, 150000, 75000),
      (v_tenant_id, v_mod_danshiki, v_range_vip, 350000, 175000),
      (v_tenant_id, v_mod_danshiki, v_range_royale, 500000, 250000),
      (v_tenant_id, v_mod_danshiki, v_range_pres, 700000, 350000),
      -- Agbada
      (v_tenant_id, v_mod_agbada, v_range_leader, 300000, 150000),
      (v_tenant_id, v_mod_agbada, v_range_vip, 500000, 250000),
      (v_tenant_id, v_mod_agbada, v_range_royale, 700000, 350000),
      (v_tenant_id, v_mod_agbada, v_range_pres, 900000, 450000),
      -- Abacost
      (v_tenant_id, v_mod_abacost, v_range_leader, 250000, 125000),
      (v_tenant_id, v_mod_abacost, v_range_vip, 400000, 200000),
      (v_tenant_id, v_mod_abacost, v_range_royale, 600000, 300000),
      (v_tenant_id, v_mod_abacost, v_range_pres, 900000, 450000),
      -- Robe
      (v_tenant_id, v_mod_robe, v_range_leader, 100000, 50000),
      (v_tenant_id, v_mod_robe, v_range_vip, 200000, 100000),
      (v_tenant_id, v_mod_robe, v_range_royale, 350000, 175000),
      (v_tenant_id, v_mod_robe, v_range_pres, 600000, 300000),
      -- Boubou
      (v_tenant_id, v_mod_boubou, v_range_leader, 100000, 50000),
      (v_tenant_id, v_mod_boubou, v_range_vip, 200000, 100000),
      (v_tenant_id, v_mod_boubou, v_range_royale, 350000, 175000),
      (v_tenant_id, v_mod_boubou, v_range_pres, 500000, 250000)
    on conflict do nothing;
  end if;

  -- 6. Barème de paie à la tâche DISTINCTION (PRD §7.4)
  insert into public.couture_piecework_rates (tenant_id, task_name, without_embroidery_xof, with_embroidery_xof, is_active)
  values
    (v_tenant_id, 'Chapeau', 1000, 1000, true),
    (v_tenant_id, 'Agbada', 5000, 6000, true),
    (v_tenant_id, 'Haut Goodluck', 1600, 3000, true),
    (v_tenant_id, 'Haut Danshiki', 2000, 4000, true),
    (v_tenant_id, 'Pantalon droit', 2000, 2000, true),
    (v_tenant_id, 'Pantalon simple', 1000, 1000, true),
    (v_tenant_id, 'Robe', 3000, 3000, true),
    (v_tenant_id, 'Boubou', 3000, 3000, true)
  on conflict do nothing;

  -- 7. Configuration des primes commerciales DISTINCTION
  insert into public.couture_sales_incentives_config (
    tenant_id,
    points_per_step_xof,
    weekly_top_seller_bonus_xof,
    monthly_top_seller_bonus_xof,
    high_ticket_threshold_xof,
    high_ticket_bonus_rate,
    low_performance_points_threshold,
    annual_top1_min_points,
    annual_top2_min_points
  ) values (
    v_tenant_id,
    50000,
    10000,
    30000,
    1000000,
    0.02,
    60,
    1600,
    900
  ) on conflict (tenant_id) do nothing;

  -- 8. Petite Caisse Atelier DISTINCTION (20 000 FCFA)
  if v_atelier_id is not null then
    insert into public.couture_petty_cash_funds (
      tenant_id,
      workshop_site_id,
      initial_fund_xof,
      current_balance_xof,
      max_expense_per_receipt_xof,
      status
    ) values (
      v_tenant_id,
      v_atelier_id,
      20000,
      20000,
      2000,
      'ACTIVE'
    ) on conflict (tenant_id, workshop_site_id) do nothing;
  end if;

  -- 9. Paramètres de consolidation multidevise
  insert into public.couture_consolidated_settings (
    tenant_id,
    reference_currency,
    is_multisite_consolidation_active
  ) values (
    v_tenant_id,
    'FCFA',
    true
  ) on conflict (tenant_id) do nothing;

  return v_tenant_id;
end;
$$;

revoke all on function public.provision_distinction_demo_establishment() from public, anon;
grant execute on function public.provision_distinction_demo_establishment() to authenticated, service_role;

commit;
