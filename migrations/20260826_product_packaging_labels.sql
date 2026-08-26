-- DebitManager Power: formats et étiquettes produits, sans perte des données existantes.
begin;
alter table public.products
  add column if not exists packaging_label varchar(80);

comment on column public.products.packaging_label is
  'Format ou étiquette commerciale du produit, par exemple 33 cl, 50 cl, Cannette ou 150 cl.';

create index if not exists products_tenant_packaging_label_idx
  on public.products (tenant_id, packaging_label)
  where deleted_at is null;
commit;
