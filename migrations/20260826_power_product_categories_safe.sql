-- DebitManager Power: ajoute uniquement les catégories absentes, sans collision avec les catégories existantes.
begin;
do $$
declare
  company_row record;
  beverages_id uuid;
  meals_id uuid;
  category_name text;
begin
  for company_row in select id from public.companies where activity_type = 'POWER' and deleted_at is null loop
    select id into beverages_id from public.categories where tenant_id = company_row.id and lower(name) = lower('Boissons') and deleted_at is null limit 1;
    if beverages_id is null then
      insert into public.categories (tenant_id, name) select company_row.id, 'Boissons' where not exists (select 1 from public.categories where tenant_id = company_row.id and lower(name) = lower('Boissons') and deleted_at is null) returning id into beverages_id;
    end if;
    select id into meals_id from public.categories where tenant_id = company_row.id and lower(name) = lower('Repas') and deleted_at is null limit 1;
    if meals_id is null then
      insert into public.categories (tenant_id, name) select company_row.id, 'Repas' where not exists (select 1 from public.categories where tenant_id = company_row.id and lower(name) = lower('Repas') and deleted_at is null) returning id into meals_id;
    end if;
    if beverages_id is not null then
      foreach category_name in array array['Bières','Sucreries','Eaux','Énergie','Liqueurs'] loop
        if not exists (select 1 from public.categories where tenant_id = company_row.id and lower(name) = lower(category_name) and deleted_at is null) then
          insert into public.categories (tenant_id, parent_id, name) values (company_row.id, beverages_id, category_name);
        end if;
      end loop;
    end if;
    if meals_id is not null then
      foreach category_name in array array['Accompagnements','Plats','Petit déjeuner','Desserts'] loop
        if not exists (select 1 from public.categories where tenant_id = company_row.id and lower(name) = lower(category_name) and deleted_at is null) then
          insert into public.categories (tenant_id, parent_id, name) values (company_row.id, meals_id, category_name);
        end if;
      end loop;
    end if;
  end loop;
end $$;
commit;
