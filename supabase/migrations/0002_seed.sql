-- ============================================================================
-- DebitManager — Migration 0002 : Seed (permissions, rôles, catalogue, config)
-- Source de vérité : docs/permissions-matrix.md, docs/technical-specs.md §21.3
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PERMISSIONS (toutes les permissions système, matrice complète)
-- ---------------------------------------------------------------------------
insert into public.permissions (code, module, description) values
  -- Commandes
  ('orders.create', 'Commandes', 'Prendre une commande'),
  ('orders.view_all', 'Commandes', 'Voir toutes les commandes'),
  ('orders.assign_section', 'Commandes', 'Attribuer à un exécutant (bar/cuisine)'),
  ('orders.mark_ready', 'Commandes', 'Marquer une commande prête'),
  ('orders.transfer_table', 'Commandes', 'Transférer une commande vers une autre table'),
  ('orders.cancel', 'Commandes', 'Demander une annulation'),
  ('orders.approve_cancel', 'Commandes', 'Valider une annulation'),
  ('orders.qr_menu_manage', 'Commandes', 'Configurer la commande QR client'),
  -- Tables
  ('tables.configure_plan', 'Tables', 'Configurer le plan de salle'),
  ('tables.update_status', 'Tables', 'Mettre à jour le statut d''une table'),
  ('tables.reserve', 'Tables', 'Créer une réservation'),
  ('tables.merge_split', 'Tables', 'Fusionner/scinder des tables'),
  -- Paiements & facturation
  ('payments.take_cash', 'Paiements', 'Encaisser un paiement en espèces'),
  ('payments.take_card_mobile', 'Paiements', 'Encaisser par carte ou mobile money'),
  ('payments.split_bill', 'Paiements', 'Diviser l''addition (split billing)'),
  ('payments.refund_approve', 'Paiements', 'Approuver un remboursement'),
  ('invoices.view', 'Paiements', 'Consulter les factures'),
  -- Stocks & approvisionnements
  ('products.manage', 'Stocks', 'Créer/modifier les produits'),
  ('products.set_thresholds', 'Stocks', 'Définir les seuils d''alerte et de sécurité'),
  ('stock.view', 'Stocks', 'Consulter les stocks'),
  ('stock.record_movement', 'Stocks', 'Enregistrer un mouvement (perte, casse)'),
  ('purchase_order.create', 'Stocks', 'Créer un bon de commande'),
  ('purchase_order.validate', 'Stocks', 'Valider un bon de commande'),
  ('purchase_order.receive', 'Stocks', 'Réceptionner la marchandise'),
  ('suppliers.manage', 'Stocks', 'Gérer les fournisseurs'),
  ('inventory.perform', 'Stocks', 'Saisir un inventaire physique'),
  ('inventory.view_discrepancy_report', 'Stocks', 'Consulter le rapport d''écarts'),
  -- Personnel & présences
  ('employees.view', 'Personnel', 'Consulter la liste des employés'),
  ('employees.create', 'Personnel', 'Créer un compte employé'),
  ('employees.validate_signup', 'Personnel', 'Valider une inscription employé'),
  ('employees.manage_permissions', 'Personnel', 'Gérer les permissions des employés'),
  ('employees.view_files', 'Personnel', 'Consulter les documents employé'),
  ('schedules.manage', 'Personnel', 'Gérer les plannings'),
  ('attendance.view_own', 'Personnel', 'Voir ses propres présences'),
  ('attendance.view_all', 'Personnel', 'Voir toutes les présences'),
  ('attendance.grant_exception', 'Personnel', 'Accorder une exception de retard/absence'),
  ('leaves.request', 'Personnel', 'Demander un congé/absence'),
  ('leaves.approve', 'Personnel', 'Approuver une demande de congé'),
  -- Paie
  ('payroll.prepare', 'Paie', 'Préparer la paie'),
  ('payroll.validate', 'Paie', 'Valider la paie'),
  ('payroll.view_own_payslip', 'Paie', 'Consulter son bulletin de salaire'),
  ('payroll.view_all', 'Paie', 'Consulter toutes les paies'),
  ('payroll.configure_bonus_rules', 'Paie', 'Configurer les règles de primes'),
  -- Trésorerie & comptabilité
  ('treasury.view_consolidated', 'Trésorerie', 'Voir la trésorerie consolidée'),
  ('treasury.withdraw_funds', 'Trésorerie', 'Retirer des fonds'),
  ('accounting.manage_expenses', 'Comptabilité', 'Gérer les dépenses'),
  ('accounting.export_reports', 'Comptabilité', 'Exporter les rapports comptables'),
  ('accounting.bank_reconciliation', 'Comptabilité', 'Rapprochement bancaire'),
  -- Rapports / KPI
  ('reports.view_global_kpi', 'Rapports', 'Voir les KPI globaux'),
  ('reports.view_own_performance', 'Rapports', 'Voir sa performance'),
  ('reports.view_financial', 'Rapports', 'Voir les KPI financiers'),
  ('reports.view_stock_kpi', 'Rapports', 'Voir les KPI stocks'),
  ('reports.export', 'Rapports', 'Exporter les rapports'),
  -- Communication
  ('messages.send_group', 'Communication', 'Envoyer un message de groupe'),
  ('messages.send_individual', 'Communication', 'Envoyer un message individuel'),
  ('messages.view_history', 'Communication', 'Consulter l''historique des messages'),
  -- Configuration & abonnement
  ('company.edit_settings', 'Configuration', 'Modifier les paramètres de la boutique'),
  ('company.manage_categories_types_units', 'Configuration', 'Gérer catégories/types/unités'),
  ('subscription.view', 'Configuration', 'Consulter l''abonnement'),
  ('subscription.change_plan_pay', 'Configuration', 'Changer de formule et payer'),
  ('roles.create_custom_profile', 'Configuration', 'Créer des profils personnalisés'),
  ('audit_log.view', 'Configuration', 'Consulter le journal d''audit'),
  -- Super-Admin (espace plateforme)
  ('platform.view_all_tenants', 'Super-Admin', 'Voir toutes les boutiques'),
  ('platform.suspend_reactivate_tenant', 'Super-Admin', 'Suspendre/réactiver une boutique'),
  ('platform.view_all_transactions', 'Super-Admin', 'Voir toutes les transactions'),
  ('platform.manage_refunds', 'Super-Admin', 'Gérer les remboursements'),
  ('platform.configure_pricing', 'Super-Admin', 'Configurer les tarifs'),
  ('platform.configure_affiliate_program', 'Super-Admin', 'Configurer le programme d''affiliation'),
  ('platform.validate_affiliate', 'Super-Admin', 'Valider les affiliés'),
  ('platform.process_affiliate_payout', 'Super-Admin', 'Traiter les retraits affiliés'),
  ('platform.manage_internal_accounts', 'Super-Admin', 'Gérer les comptes internes'),
  ('platform.view_global_audit_log', 'Super-Admin', 'Voir le journal d''audit global'),
  ('platform.manage_support_tickets', 'Super-Admin', 'Gérer les tickets support'),
  -- Affilié (espace affiliation)
  ('affiliate.view_own_dashboard', 'Affilié', 'Voir son dashboard affilié'),
  ('affiliate.view_referral_link', 'Affilié', 'Voir son lien de parrainage'),
  ('affiliate.view_commissions', 'Affilié', 'Voir ses commissions'),
  ('affiliate.request_payout', 'Affilié', 'Demander un retrait')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- RÔLES PRÉDÉFINIS (gabarits globaux, dupliqués par boutique à la création)
-- ---------------------------------------------------------------------------
insert into public.roles (tenant_id, name, is_predefined) values
  (null, 'PROMOTEUR', true),
  (null, 'ADMINISTRATEUR', true),
  (null, 'GERANT_SUPERVISEUR', true),
  (null, 'SERVEUR', true),
  (null, 'BAR_MAN', true),
  (null, 'CUISINIER', true),
  (null, 'CHEF_CUISINE', true),
  (null, 'MAGASINIER', true),
  (null, 'APPROVISIONNEMENT', true),
  (null, 'COMPTABLE', true),
  (null, 'SECRETAIRE', true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- PRÉRÉGLAGES role_permissions (matrice des permissions, docs/permissions-matrix.md)
-- ---------------------------------------------------------------------------
do $$
declare
  v_role record;
  v_granted text[];
begin
  for v_role in select * from public.roles where is_predefined loop
    v_granted := case v_role.name
      when 'PROMOTEUR' then array[
        'orders.create','orders.view_all','orders.assign_section','orders.mark_ready','orders.transfer_table','orders.cancel','orders.approve_cancel','orders.qr_menu_manage',
        'tables.configure_plan','tables.update_status','tables.reserve','tables.merge_split',
        'payments.take_cash','payments.take_card_mobile','payments.split_bill','payments.refund_approve','invoices.view',
        'products.manage','products.set_thresholds','stock.view','stock.record_movement','purchase_order.create','purchase_order.validate','purchase_order.receive','suppliers.manage','inventory.perform','inventory.view_discrepancy_report',
        'employees.view','employees.create','employees.validate_signup','employees.manage_permissions','employees.view_files','schedules.manage','attendance.view_own','attendance.view_all','attendance.grant_exception','leaves.request','leaves.approve',
        'payroll.validate','payroll.view_own_payslip','payroll.view_all','payroll.configure_bonus_rules',
        'treasury.view_consolidated','treasury.withdraw_funds','accounting.export_reports',
        'reports.view_global_kpi','reports.view_own_performance','reports.view_financial','reports.view_stock_kpi','reports.export',
        'messages.send_group','messages.send_individual','messages.view_history',
        'company.edit_settings','company.manage_categories_types_units','subscription.view','subscription.change_plan_pay','roles.create_custom_profile','audit_log.view'
      ]
      when 'ADMINISTRATEUR' then array[
        'orders.create','orders.view_all','orders.assign_section','orders.mark_ready','orders.transfer_table','orders.cancel','orders.approve_cancel','orders.qr_menu_manage',
        'tables.configure_plan','tables.update_status','tables.reserve','tables.merge_split',
        'payments.take_cash','payments.take_card_mobile','payments.split_bill','payments.refund_approve','invoices.view',
        'products.manage','products.set_thresholds','stock.view','stock.record_movement','purchase_order.create','purchase_order.validate','purchase_order.receive','suppliers.manage','inventory.perform','inventory.view_discrepancy_report',
        'employees.view','employees.create','employees.validate_signup','employees.manage_permissions','employees.view_files','schedules.manage','attendance.view_own','attendance.view_all','attendance.grant_exception','leaves.request','leaves.approve',
        'payroll.view_own_payslip','payroll.configure_bonus_rules',
        'reports.view_global_kpi','reports.view_own_performance','reports.view_stock_kpi','reports.export',
        'messages.send_group','messages.send_individual','messages.view_history',
        'company.edit_settings','company.manage_categories_types_units','subscription.view','roles.create_custom_profile','audit_log.view'
      ]
      when 'GERANT_SUPERVISEUR' then array[
        'orders.create','orders.view_all','orders.assign_section','orders.mark_ready','orders.transfer_table','orders.cancel','orders.approve_cancel',
        'tables.update_status','tables.reserve','tables.merge_split',
        'payments.take_cash','payments.take_card_mobile','payments.split_bill','payments.refund_approve','invoices.view',
        'stock.view','stock.record_movement',
        'employees.view','schedules.manage','attendance.view_own','attendance.view_all','attendance.grant_exception','leaves.request','leaves.approve',
        'payroll.view_own_payslip',
        'reports.view_global_kpi','reports.view_own_performance','reports.view_stock_kpi','reports.export',
        'messages.send_group','messages.send_individual','messages.view_history'
      ]
      when 'SERVEUR' then array[
        'orders.create','orders.transfer_table','orders.cancel',
        'tables.update_status','tables.reserve',
        'payments.take_cash','payments.take_card_mobile','payments.split_bill',
        'attendance.view_own','leaves.request',
        'payroll.view_own_payslip',
        'reports.view_own_performance',
        'messages.send_individual','messages.view_history'
      ]
      when 'BAR_MAN' then array[
        'orders.assign_section','orders.mark_ready',
        'attendance.view_own','leaves.request',
        'payroll.view_own_payslip',
        'reports.view_own_performance',
        'messages.send_individual','messages.view_history'
      ]
      when 'CUISINIER' then array[
        'orders.assign_section','orders.mark_ready',
        'attendance.view_own','leaves.request',
        'payroll.view_own_payslip',
        'reports.view_own_performance',
        'messages.send_individual','messages.view_history'
      ]
      when 'CHEF_CUISINE' then array[
        'orders.assign_section','orders.mark_ready',
        'attendance.view_own','leaves.request',
        'payroll.view_own_payslip',
        'reports.view_own_performance',
        'messages.send_individual','messages.view_history'
      ]
      when 'MAGASINIER' then array[
        'products.set_thresholds','stock.view','stock.record_movement','purchase_order.receive','inventory.perform','inventory.view_discrepancy_report',
        'attendance.view_own','leaves.request',
        'payroll.view_own_payslip',
        'reports.view_own_performance','reports.view_stock_kpi','reports.export',
        'messages.send_individual','messages.view_history'
      ]
      when 'APPROVISIONNEMENT' then array[
        'stock.view','purchase_order.create','purchase_order.receive','suppliers.manage',
        'attendance.view_own','leaves.request',
        'payroll.view_own_payslip',
        'reports.view_own_performance','reports.view_stock_kpi','reports.export',
        'messages.send_individual','messages.view_history'
      ]
      when 'COMPTABLE' then array[
        'orders.view_all','invoices.view',
        'stock.view','purchase_order.validate','inventory.view_discrepancy_report',
        'employees.view','employees.view_files','attendance.view_own','leaves.request',
        'payroll.prepare','payroll.view_own_payslip','payroll.view_all',
        'treasury.view_consolidated','accounting.manage_expenses','accounting.export_reports','accounting.bank_reconciliation',
        'reports.view_own_performance','reports.view_financial','reports.export',
        'messages.send_individual','messages.view_history',
        'subscription.view'
      ]
      when 'SECRETAIRE' then array[
        'tables.reserve',
        'attendance.view_own','leaves.request',
        'payroll.view_own_payslip',
        'reports.view_own_performance',
        'messages.send_individual','messages.view_history'
      ]
    end;
    insert into public.role_permissions (role_id, permission_id, granted)
    select v_role.id, p.id, p.code = any(v_granted)
    from public.permissions p
    on conflict (role_id, permission_id) do update set granted = excluded.granted;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- CATALOGUE PRÉCONFIGURÉ (global — tenant_id null)
-- ---------------------------------------------------------------------------
insert into public.categories (tenant_id, name) values
  (null, 'Bières'), (null, 'Sucreries'), (null, 'Énergisantes'), (null, 'Spiritueux'), (null, 'Repas')
on conflict do nothing;

insert into public.product_types (tenant_id, name) values
  (null, '33cl'), (null, '50cl'), (null, '60cl'), (null, '1 litre'), (null, 'Champagnes'),
  (null, 'Vins'), (null, 'Whisky'), (null, 'Autres spiritueux'), (null, 'Petit-déjeuner'),
  (null, 'Accompagnement'), (null, 'Poissons'), (null, 'Viande'), (null, 'Résistance'),
  (null, 'Jus de fruits naturels'), (null, 'Dessert')
on conflict do nothing;

insert into public.units (tenant_id, name) values
  (null, 'Bouteille'), (null, 'Plat'), (null, 'Conso'), (null, 'Dose'), (null, 'Tasse'), (null, 'Unité')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- PLATFORM_CONFIG — Configuration globale (Super-Admin)
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, value) values
  ('pricing', jsonb_build_object(
    'currency', 'XOF',
    'plans', jsonb_build_array(
      jsonb_build_object('plan', 'BASE', 'months', 1, 'prices', jsonb_build_object('BUVETTE', 50000, 'BAR_RESTAURANT', 75000, 'NIGHTCLUB_LOUNGE', 100000)),
      jsonb_build_object('plan', 'MOYENNE', 'months', 3, 'prices', jsonb_build_object('BUVETTE', 130000, 'BAR_RESTAURANT', 195000, 'NIGHTCLUB_LOUNGE', 260000)),
      jsonb_build_object('plan', 'SEMESTRIELLE', 'months', 6, 'prices', jsonb_build_object('BUVETTE', 240000, 'BAR_RESTAURANT', 360000, 'NIGHTCLUB_LOUNGE', 480000)),
      jsonb_build_object('plan', 'SUPREME', 'months', 12, 'prices', jsonb_build_object('BUVETTE', 400000, 'BAR_RESTAURANT', 600000, 'NIGHTCLUB_LOUNGE', 800000))
    ),
    'coefficients', jsonb_build_object('BUVETTE', 1.0, 'BAR_RESTAURANT', 1.5, 'NIGHTCLUB_LOUNGE', 2.0)
  )),
  ('platform_commission_rate', jsonb_build_object('percent', 1)),
  ('trial', jsonb_build_object('days', 14)),
  ('grace', jsonb_build_object('days', 3)),
  ('tax', jsonb_build_object('vat_percent', 18)),
  ('attendance', jsonb_build_object('geo_radius_meters', 500, 'late_minutes', 10, 'block_minutes', 30, 'geo_leave_minutes', 30)),
  ('affiliate_program', jsonb_build_object(
    'commission_rate_percent', 10,
    'commission_mode', 'RECURRING',
    'validation_mode', 'AUTOMATIC',
    'min_payout', 10000,
    'tracking_ttl_days', 30,
    'security_delay_days', 14,
    'tiers', jsonb_build_array()
  )),
  ('support', jsonb_build_object('email', 'support@debitmanager.app'))
on conflict (key) do nothing;
