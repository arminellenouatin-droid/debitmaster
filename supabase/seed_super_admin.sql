-- ============================================================================
-- DebitManager — Création du premier Super-Admin
-- À exécuter dans le SQL Editor Supabase APRÈS les 3 migrations.
-- 1. Remplacer l'email ci-dessous.
-- 2. Exécuter.
-- 3. Sur la page de connexion, utiliser « Mot de passe oublié » (ou magic link).
-- ============================================================================

do $$
declare
  v_user_id uuid;
begin
  -- Créer l'utilisateur auth (mot de passe aléatoire provisoire, à réinitialiser)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@debitmanager.app',  -- ← REMPLACER PAR VOTRE EMAIL
    crypt('ChangeMe-12345', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Super","last_name":"Admin"}',
    now(), now()
  )
  on conflict (email) do nothing
  returning id into v_user_id;

  if v_user_id is null then
    select id into v_user_id from auth.users where email = 'admin@debitmanager.app';
  end if;

  -- Profil Super-Admin (hors tenant)
  insert into public.profiles (id, email, first_name, last_name, user_type, status, two_factor_enabled)
  values (v_user_id, 'admin@debitmanager.app', 'Super', 'Admin', 'SUPER_ADMIN', 'ACTIVE', true)
  on conflict (id) do update set user_type = 'SUPER_ADMIN', status = 'ACTIVE', two_factor_enabled = true;

  raise notice 'Super-Admin prêt : %', v_user_id;
end $$;
