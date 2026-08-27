-- DebitManager Power: chambres et tarifs de l’activité Auberge, isolés par établissement.
create table if not exists public.power_lodging_rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  room_number text not null,
  pass_price_xof integer not null default 1000 check (pass_price_xof >= 0),
  pass_duration_minutes integer not null default 60 check (pass_duration_minutes > 0),
  night_price_xof integer not null default 5000 check (night_price_xof >= 0),
  night_duration_nights integer not null default 1 check (night_duration_nights > 0),
  is_active boolean not null default true,
  occupied_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, room_number)
);

create index if not exists power_lodging_rooms_tenant_idx on public.power_lodging_rooms(tenant_id, is_active, room_number);
alter table public.power_lodging_rooms enable row level security;

create policy power_lodging_rooms_select on public.power_lodging_rooms for select to authenticated using (private.has_tenant_permission(tenant_id, 'services.view') or private.has_tenant_permission(tenant_id, 'finance.view'));
create policy power_lodging_rooms_insert on public.power_lodging_rooms for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'services.manage'));
create policy power_lodging_rooms_update on public.power_lodging_rooms for update to authenticated using (private.has_tenant_permission(tenant_id, 'services.manage')) with check (private.has_tenant_permission(tenant_id, 'services.manage'));
create policy power_lodging_rooms_delete on public.power_lodging_rooms for delete to authenticated using (private.has_tenant_permission(tenant_id, 'services.manage'));

insert into public.power_lodging_rooms (tenant_id, room_number, pass_price_xof, pass_duration_minutes, night_price_xof, night_duration_nights)
select c.id, v.room_number, v.pass_price_xof, 60, v.night_price_xof, 1
from public.companies c
cross join (values
  ('1', 1000, 5000), ('2', 1000, 5000), ('3', 2000, 6000), ('4', 1000, 5000)
) as v(room_number, pass_price_xof, night_price_xof)
where c.activity_type = 'POWER'
on conflict (tenant_id, room_number) do nothing;
