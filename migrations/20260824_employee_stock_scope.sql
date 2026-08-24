-- DebitManager: périmètre de stock autorisé par magasinier.
alter table public.employees
  add column if not exists stock_scope text not null default 'BOTH';

alter table public.employees
  drop constraint if exists employees_stock_scope_check;
alter table public.employees
  add constraint employees_stock_scope_check
  check (stock_scope in ('BEVERAGE', 'KITCHEN', 'BOTH'));

create index if not exists employees_tenant_stock_scope_idx
  on public.employees (tenant_id, stock_scope)
  where deleted_at is null and status = 'ACTIVE';
