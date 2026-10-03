-- ==============================================================================
-- MIGRATION: Refonte complète du système d'abonnement DebitMaster (PRD v1.1)
-- Fichier: 20261003_refonte_abonnements_prd_v1_1.sql
-- Description:
--   1. Création des tables `plans_activite`, `parametres_globaux_abonnement`,
--      `historique_prix_plans`, `abonnements_etablissement`.
--   2. Colonnes complémentaires sur `companies` (`has_special_option`, `subscription_billing_period`).
--   3. Chargement initial des tarifs de référence pour les 6 activités (Section 2).
--   4. Migration de l'établissement test BAR SANTE PLUS vers Bar et restaurant (Option spéciale).
--   5. Sécurité RLS et contrôles d'accès conformes à AGENTS.md.
-- ==============================================================================

begin;

-- 1. Table des paramètres globaux de l'abonnement
create table if not exists public.parametres_globaux_abonnement (
  id integer primary key default 1 check (id = 1),
  duree_essai_jours integer not null default 30 check (duree_essai_jours >= 1),
  coefficient_option_speciale_defaut numeric(4,2) not null default 1.50 check (coefficient_option_speciale_defaut > 0),
  taux_reduction_annuelle_defaut numeric(4,2) not null default 0.75 check (taux_reduction_annuelle_defaut > 0 and taux_reduction_annuelle_defaut < 1),
  date_maj timestamptz not null default now(),
  maj_par uuid null
);

-- Insertion de la ligne unique de paramétrage
insert into public.parametres_globaux_abonnement (id, duree_essai_jours, coefficient_option_speciale_defaut, taux_reduction_annuelle_defaut, date_maj)
values (1, 30, 1.50, 0.75, now())
on conflict (id) do update set
  duree_essai_jours = excluded.duree_essai_jours,
  coefficient_option_speciale_defaut = excluded.coefficient_option_speciale_defaut,
  taux_reduction_annuelle_defaut = excluded.taux_reduction_annuelle_defaut,
  date_maj = now();

-- 2. Table des plans par activité
create table if not exists public.plans_activite (
  activite text primary key,
  nom_affiche text not null,
  prix_mensuel_normal integer not null check (prix_mensuel_normal > 0),
  coefficient_special numeric(4,2) not null default 1.50 check (coefficient_special > 0),
  prix_mensuel_special integer not null check (prix_mensuel_special > 0),
  taux_reduction_annuelle numeric(4,2) not null default 0.75 check (taux_reduction_annuelle > 0 and taux_reduction_annuelle < 1),
  prix_annuel_normal integer not null check (prix_annuel_normal > 0),
  prix_annuel_special integer not null check (prix_annuel_special > 0),
  prix_annuel_normal_override integer null check (prix_annuel_normal_override is null or prix_annuel_normal_override > 0),
  prix_annuel_special_override integer null check (prix_annuel_special_override is null or prix_annuel_special_override > 0),
  statut_disponibilite boolean not null default true,
  description_courte text not null default '',
  description_option_speciale text not null default '',
  fonctionnalites_normales jsonb not null default '[]'::jsonb,
  fonctionnalites_speciales jsonb not null default '[]'::jsonb,
  date_maj timestamptz not null default now(),
  maj_par uuid null
);

-- 3. Table de l'historique des modifications tarifaires (audit log)
create table if not exists public.historique_prix_plans (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null,
  champ_modifie text not null,
  ancien_prix text not null,
  nouveau_prix text not null,
  auteur text null,
  date timestamptz not null default now()
);

-- Index pour requêtes rapides de l'audit log
create index if not exists idx_historique_prix_plans_plan_id on public.historique_prix_plans(plan_id);
create index if not exists idx_historique_prix_plans_date on public.historique_prix_plans(date desc);

-- 4. Table des abonnements souscrits par établissement
create table if not exists public.abonnements_etablissement (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  activite text not null,
  duree text not null check (duree in ('MONTHLY', 'ANNUAL')),
  niveau text not null check (niveau in ('NORMAL', 'SPECIAL')),
  prix_applique_au_moment_de_la_souscription integer not null check (prix_applique_au_moment_de_la_souscription >= 0),
  date_debut timestamptz not null default now(),
  date_fin timestamptz not null,
  statut text not null default 'ACTIVE' check (statut in ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_abonnements_etablissement_tenant on public.abonnements_etablissement(tenant_id);
create index if not exists idx_abonnements_etablissement_statut on public.abonnements_etablissement(statut);

-- 5. Colonnes complémentaires sur `companies`
alter table public.companies add column if not exists has_special_option boolean not null default false;
alter table public.companies add column if not exists subscription_billing_period text null;

-- Mise à jour de la contrainte activity_type_check si nécessaire pour inclure les 6 activités
alter table public.companies drop constraint if exists companies_activity_type_check;
alter table public.companies add constraint companies_activity_type_check check (
  activity_type in (
    'BUVETTE',
    'BAR_RESTAURANT',
    'NIGHTCLUB_LOUNGE',
    'HOTEL_AUBERGE',
    'BOUTIQUE_COMMERCE',
    'ATELIER_COUTURE',
    'POWER'
  )
);

-- Mise à jour de la contrainte billing_period_check si nécessaire
alter table public.companies drop constraint if exists companies_subscription_billing_period_check;
alter table public.companies add constraint companies_subscription_billing_period_check check (
  subscription_billing_period is null or subscription_billing_period in ('MONTHLY', 'ANNUAL')
);

-- 6. Chargement des 6 activités et de leurs tarifs de référence (PRD Section 2)
insert into public.plans_activite (
  activite,
  nom_affiche,
  prix_mensuel_normal,
  coefficient_special,
  prix_mensuel_special,
  taux_reduction_annuelle,
  prix_annuel_normal,
  prix_annuel_special,
  prix_annuel_normal_override,
  prix_annuel_special_override,
  statut_disponibilite,
  description_courte,
  description_option_speciale,
  fonctionnalites_normales,
  fonctionnalites_speciales
)
values
(
  'BUVETTE',
  'Buvette',
  30000,
  1.50,
  45000,
  0.75,
  270000,
  405000,
  null,
  null,
  true,
  'Pour petits bars, maquis et vente de boissons uniquement.',
  'Option spéciale Buvette : fonctionnalités de gestion avancées.',
  '["Vente tactile mobile-first ultra-rapide", "Gestion stricte des stocks de boissons & casiers", "Traçabilité anti-coulage en temps réel", "Encaissement MTN MoMo & espèces sécurisé", "Gestion d’équipe, serveurs et clôtures de caisse"]'::jsonb,
  '["Fonctionnalités avancées de gestion à définir"]'::jsonb
),
(
  'BAR_RESTAURANT',
  'Bar et restaurant',
  50000,
  1.50,
  75000,
  0.75,
  450000,
  675000,
  null,
  null,
  true,
  'Pour bars, maquis et restaurants avec salle, bar et cuisine.',
  'Option spéciale Bar et restaurant : inclut l’ensemble des modules avancés (repas & cuisine KDS, gym & fitness, lavage auto/moto, auberge & chambres, tickets Wi-Fi, mode paiement marchand dédié).',
  '["Vente de boissons & gestion des stocks", "Prise de commande mobile serveuses", "Écran KDS cuisine en temps réel", "Gestion des repas & ingrédients", "Plan de salle & gestion des tables", "Encaissements MTN MoMo & espèces"]'::jsonb,
  '["Module Repas et Cuisine KDS avancée", "Module Lavage Auto & Moto", "Module Gym, Fitness & Abonnements", "Module Auberge & Gestion des chambres (passe / nuitée)", "Générateur et gestion des tickets Wi-Fi", "Mode de paiement MTN MoMo Personnel / marchand dédié"]'::jsonb
),
(
  'NIGHTCLUB_LOUNGE',
  'Lounge et night-club',
  75000,
  1.50,
  112500,
  0.75,
  675000,
  1012500,
  null,
  null,
  true,
  'Pour clubs, discothèques, rooftops et lounges à forte cadence festive.',
  'Option spéciale Lounge et night-club : gestion VIP exclusive et espaces réservés.',
  '["Commandes ultra-rapides au verre et à la bouteille", "Gestion VIP et espaces réservés", "Contrôle strict des entrées et du vestiaire", "Réconciliation caisse & stocks en temps réel", "Alertes anti-coulage nocturne"]'::jsonb,
  '["Gestion VIP premium et réservations exclusives (à définir)"]'::jsonb
),
(
  'HOTEL_AUBERGE',
  'Hôtel et auberge',
  80000,
  1.50,
  120000,
  0.75,
  720000,
  1080000,
  null,
  null,
  true,
  'Pour hôtels, auberges, résidences et complexes d’hébergement.',
  'Option spéciale Hôtel et auberge : prestations hôtelières et bien-être étendues.',
  '["Gestion des chambres (nuitées, demi-journées, passes)", "Planning des arrivées et départs", "Facturation hébergement & bar/restaurant liée", "Gouvernance et entretien ménager des chambres", "Registre des fiches de police / clients"]'::jsonb,
  '["Services hôteliers étendus & multi-bâtiments (à définir)"]'::jsonb
),
(
  'BOUTIQUE_COMMERCE',
  'Boutique et commerce',
  50000,
  1.50,
  75000,
  0.75,
  450000,
  675000,
  null,
  null,
  true,
  'Pour négoce, commerce de détail, demi-gros et boutiques.',
  'Option spéciale Boutique et commerce : multi-dépôts étendus et interconnexions B2B.',
  '["Multi-magasins et inventaire physique", "Codes-barres et conditionnements multiples", "Devis, bons de commande et proformas", "Factures conformes et bons de livraison", "Sessions de caisse & clôture Z", "Comptabilité SYSCOHADA intégrée"]'::jsonb,
  '["Extensions multi-dépôts & interconnexions B2B (à définir)"]'::jsonb
),
(
  'ATELIER_COUTURE',
  'Atelier de couture',
  100000,
  1.50,
  150000,
  0.75,
  900000,
  1350000,
  null,
  null,
  true,
  'Pour maisons de couture, confection sur mesure et ateliers de production.',
  'Option spéciale Atelier de couture : confection haute gamme et réseau d’ateliers exclusifs.',
  '["Prêt-à-porter et confection sur-mesure", "Fiches de mesures morphologiques complètes", "Workflow d’atelier (Coupe, Couture, Broderie, QC)", "Paie des ouvriers à la tâche avec majorations", "Multi-sites ateliers et boutiques", "Stocks de fournitures & tissus avec métrages"]'::jsonb,
  '["Haute confection, lignes sur-mesure exclusives & réseau international (à définir)"]'::jsonb
)
on conflict (activite) do update set
  nom_affiche = excluded.nom_affiche,
  prix_mensuel_normal = excluded.prix_mensuel_normal,
  coefficient_special = excluded.coefficient_special,
  prix_mensuel_special = excluded.prix_mensuel_special,
  taux_reduction_annuelle = excluded.taux_reduction_annuelle,
  prix_annuel_normal = excluded.prix_annuel_normal,
  prix_annuel_special = excluded.prix_annuel_special,
  statut_disponibilite = excluded.statut_disponibilite,
  description_courte = excluded.description_courte,
  description_option_speciale = excluded.description_option_speciale,
  fonctionnalites_normales = excluded.fonctionnalites_normales,
  fonctionnalites_speciales = excluded.fonctionnalites_speciales,
  date_maj = now();

-- 7. Migration de l'établissement test BAR SANTE PLUS (PRD Section 7)
-- Identifiant vérifié : f6afa300-7e9e-4891-b7f6-27ab69fc42d7
update public.companies
set
  activity_type = 'BAR_RESTAURANT',
  subscription_plan = 'BAR_RESTAURANT',
  has_special_option = true,
  subscription_billing_period = 'ANNUAL',
  subscription_expires_at = '2099-12-31 23:59:59+00',
  status = 'ACTIVE',
  updated_at = now()
where id = 'f6afa300-7e9e-4891-b7f6-27ab69fc42d7';

-- Enregistrement de l'abonnement actif dans `abonnements_etablissement`
insert into public.abonnements_etablissement (
  tenant_id,
  activite,
  duree,
  niveau,
  prix_applique_au_moment_de_la_souscription,
  date_debut,
  date_fin,
  statut
)
values (
  'f6afa300-7e9e-4891-b7f6-27ab69fc42d7',
  'BAR_RESTAURANT',
  'ANNUAL',
  'SPECIAL',
  675000,
  now(),
  '2099-12-31 23:59:59+00',
  'ACTIVE'
);

-- 8. Sécurité et Row Level Security (RLS) obligatoire selon AGENTS.md
alter table public.plans_activite enable row level security;
alter table public.parametres_globaux_abonnement enable row level security;
alter table public.historique_prix_plans enable row level security;
alter table public.abonnements_etablissement enable row level security;

-- Révoquer les droits par défaut
revoke all on public.plans_activite from anon, authenticated;
revoke all on public.parametres_globaux_abonnement from anon, authenticated;
revoke all on public.historique_prix_plans from anon, authenticated;
revoke all on public.abonnements_etablissement from anon, authenticated;

-- Politique lecture publique pour le catalogue et les paramètres d'abonnement
grant select on public.plans_activite to anon, authenticated;
drop policy if exists "plans_activite_select_public" on public.plans_activite;
create policy "plans_activite_select_public"
  on public.plans_activite
  for select
  using (true);

grant select on public.parametres_globaux_abonnement to anon, authenticated;
drop policy if exists "parametres_globaux_abonnement_select_public" on public.parametres_globaux_abonnement;
create policy "parametres_globaux_abonnement_select_public"
  on public.parametres_globaux_abonnement
  for select
  using (true);

-- Politique abonnements_etablissement : lecture uniquement pour le propriétaire de l'établissement
grant select on public.abonnements_etablissement to authenticated;
drop policy if exists "abonnements_etablissement_owner_select" on public.abonnements_etablissement;
create policy "abonnements_etablissement_owner_select"
  on public.abonnements_etablissement
  for select
  using (
    tenant_id in (
      select id from public.companies
      where owner_user_id = (select auth.uid())
        and deleted_at is null
    )
  );

-- Historique des prix : accessible uniquement via service role (aucun grant direct client)

commit;
