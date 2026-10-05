-- ==============================================================================
-- MIGRATION: Facture Normalisée DGI Bénin (e-MECeF) - SYGMEF
-- Fichier: migrations/20261005_benin_normalized_invoicing.sql
-- Description:
--   1. Ajout des colonnes de facturation normalisée DGI sur la table `companies` :
--      - is_normalized_invoice_enabled (boolean, défaut false)
--      - dgi_nim (varchar(60), défaut 'SF00000001')
--      - dgi_api_token (text, jeton optionnel pour requêtes directes SFE)
--      - dgi_env (varchar(20), défaut 'sandbox' : sandbox | production)
--   2. Colonne ifu sur `customers` si non existante pour les factures adressées aux entreprises
--   3. Index et contraintes d'intégrité conformes aux règles de sécurité AGENTS.md
-- ==============================================================================

begin;

-- 1. Colonnes sur la table companies
alter table public.companies add column if not exists is_normalized_invoice_enabled boolean default false;
alter table public.companies add column if not exists dgi_nim varchar(60) default 'SF00000001';
alter table public.companies add column if not exists dgi_api_token text;
alter table public.companies add column if not exists dgi_env varchar(20) default 'sandbox';

-- 2. Colonne IFU client sur la table customers (pour les acheteurs personnes morales)
alter table public.customers add column if not exists ifu varchar(60);

-- 3. Index de performance sur les établissements avec facturation normalisée activée
create index if not exists companies_normalized_invoice_idx on public.companies(id) where is_normalized_invoice_enabled = true;

commit;

-- Note : L'application gère aussi une sauvegarde automatique et chiffrée des paramètres
-- via tenant_momo_credentials (clé DGI_BENIN_CONFIG), assurant un fonctionnement immédiat
-- même avant l'exécution manuelle de ce script.
