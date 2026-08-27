-- DebitManager Power: demande de mise à disposition du comptoir avec réservation dès validation superviseur.
begin;

create table if not exists public.counter_replenishment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  counter_store_id uuid not null references public.inventory_stores(id) on delete restrict,
  central_store_id uuid not null references public.inventory_stores(id) on delete restrict,
  requested_by uuid not null references auth.users(id),
  status text not null default 'REQUESTED' check (status in ('REQUESTED','VALIDATED','DELIVERED','CANCELLED')),
  note varchar(240),
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  delivered_by uuid references auth.users(id),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists counter_replenishment_requests_tenant_status_idx on public.counter_replenishment_requests(tenant_id,status,created_at desc);

create table if not exists public.counter_replenishment_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.counter_replenishment_requests(id) on delete cascade,
  tenant_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0),
  unit_cost_snapshot integer not null default 0 check (unit_cost_snapshot >= 0),
  created_at timestamptz not null default now(),
  unique(request_id, product_id)
);
create index if not exists counter_replenishment_items_request_idx on public.counter_replenishment_request_items(request_id);

alter table public.counter_replenishment_requests enable row level security;
alter table public.counter_replenishment_request_items enable row level security;
drop policy if exists counter_replenishment_requests_select on public.counter_replenishment_requests;
create policy counter_replenishment_requests_select on public.counter_replenishment_requests for select to authenticated using (private.has_tenant_permission(tenant_id,'stock.view'));
drop policy if exists counter_replenishment_requests_insert on public.counter_replenishment_requests;
create policy counter_replenishment_requests_insert on public.counter_replenishment_requests for insert to authenticated with check (private.has_tenant_permission(tenant_id,'stock.view') and requested_by = (select auth.uid()));
drop policy if exists counter_replenishment_requests_update on public.counter_replenishment_requests;
create policy counter_replenishment_requests_update on public.counter_replenishment_requests for update to authenticated using (private.has_tenant_permission(tenant_id,'stock.receive')) with check (private.has_tenant_permission(tenant_id,'stock.receive'));
drop policy if exists counter_replenishment_items_select on public.counter_replenishment_request_items;
create policy counter_replenishment_items_select on public.counter_replenishment_request_items for select to authenticated using (private.has_tenant_permission(tenant_id,'stock.view'));
drop policy if exists counter_replenishment_items_insert on public.counter_replenishment_request_items;
create policy counter_replenishment_items_insert on public.counter_replenishment_request_items for insert to authenticated with check (private.has_tenant_permission(tenant_id,'stock.view'));
drop policy if exists counter_replenishment_items_update on public.counter_replenishment_request_items;
create policy counter_replenishment_items_update on public.counter_replenishment_request_items for update to authenticated using (private.has_tenant_permission(tenant_id,'stock.receive')) with check (private.has_tenant_permission(tenant_id,'stock.receive'));
drop policy if exists counter_replenishment_items_delete on public.counter_replenishment_request_items;
create policy counter_replenishment_items_delete on public.counter_replenishment_request_items for delete to authenticated using (private.has_tenant_permission(tenant_id,'stock.receive'));

create or replace function public.validate_counter_replenishment(p_request_id uuid)
returns public.counter_replenishment_requests
language plpgsql security definer set search_path=public,private as $$
declare r public.counter_replenishment_requests; i record; p public.store_inventory; c public.inventory_stores; d public.inventory_stores;
begin
 select * into r from public.counter_replenishment_requests where id=p_request_id for update;
 if r.id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
 if auth.uid() is null or not private.has_tenant_permission(r.tenant_id,'stock.audit') then raise exception 'REQUEST_VALIDATION_FORBIDDEN'; end if;
 if r.status <> 'REQUESTED' then raise exception 'REQUEST_ALREADY_PROCESSED'; end if;
 select * into c from public.inventory_stores where id=r.central_store_id and tenant_id=r.tenant_id and is_active for update;
 select * into d from public.inventory_stores where id=r.counter_store_id and tenant_id=r.tenant_id and is_active for update;
 if c.id is null or d.id is null or c.store_type='COUNTER' or d.store_type<>'COUNTER' then raise exception 'INVALID_REQUEST_STORES'; end if;
 for i in select * from public.counter_replenishment_request_items where request_id=r.id order by id loop
   select * into p from public.store_inventory where store_id=r.central_store_id and product_id=i.product_id and tenant_id=r.tenant_id for update;
   if p.id is null or p.quantity-p.reserved_quantity<i.requested_quantity then raise exception 'INSUFFICIENT_AVAILABLE_STOCK'; end if;
   update public.store_inventory set reserved_quantity=reserved_quantity+i.requested_quantity,updated_at=now() where id=p.id;
 end loop;
 update public.counter_replenishment_requests set status='VALIDATED',validated_by=auth.uid(),validated_at=now(),updated_at=now() where id=r.id returning * into r;
 return r;
end; $$;

grant execute on function public.validate_counter_replenishment(uuid) to authenticated;

create or replace function public.deliver_counter_replenishment(p_request_id uuid)
returns public.counter_replenishment_requests
language plpgsql security definer set search_path=public,private as $$
declare r public.counter_replenishment_requests; i record; p public.store_inventory; cost integer;
begin
 select * into r from public.counter_replenishment_requests where id=p_request_id for update;
 if r.id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
 if auth.uid() is null or not private.has_tenant_permission(r.tenant_id,'stock.accept_counter') then raise exception 'REQUEST_DELIVERY_FORBIDDEN'; end if;
 if r.status <> 'VALIDATED' then raise exception 'REQUEST_NOT_VALIDATED'; end if;
 for i in select * from public.counter_replenishment_request_items where request_id=r.id order by id loop
   select * into p from public.store_inventory where store_id=r.central_store_id and product_id=i.product_id and tenant_id=r.tenant_id for update;
   if p.id is null or p.quantity<i.requested_quantity or p.reserved_quantity<i.requested_quantity then raise exception 'SOURCE_STOCK_CHANGED'; end if;
   update public.store_inventory set quantity=quantity-i.requested_quantity,reserved_quantity=reserved_quantity-i.requested_quantity,updated_at=now() where id=p.id;
   insert into public.store_inventory(tenant_id,store_id,product_id,quantity,reserved_quantity) values(r.tenant_id,r.counter_store_id,i.product_id,i.requested_quantity,0) on conflict(store_id,product_id) do update set quantity=public.store_inventory.quantity+excluded.quantity,updated_at=now();
   insert into public.stock_movements(tenant_id,product_id,movement_type,quantity,reason,responsible_user_id,store_id) values(r.tenant_id,i.product_id,'OUT_TRANSFER',-i.requested_quantity,'Mise à disposition comptoir',auth.uid(),r.central_store_id);
   insert into public.stock_movements(tenant_id,product_id,movement_type,quantity,reason,responsible_user_id,store_id) values(r.tenant_id,i.product_id,'IN_TRANSFER',i.requested_quantity,'Réception magasin comptoir',auth.uid(),r.counter_store_id);
 end loop;
 update public.counter_replenishment_requests set status='DELIVERED',delivered_by=auth.uid(),delivered_at=now(),updated_at=now() where id=r.id returning * into r;
 return r;
end; $$;

grant execute on function public.deliver_counter_replenishment(uuid) to authenticated;
commit;
