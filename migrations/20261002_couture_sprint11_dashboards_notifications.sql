-- DebitMaster: Sprint 11 pour l'activité « Atelier de couture ».
-- Notifications métier et centre d'alertes par profil.
begin;

create table if not exists public.couture_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_role text,
  site_id uuid references public.couture_sites(id) on delete set null,
  category text not null check (category in ('PURCHASE_APPROVAL', 'LOW_STOCK', 'PRODUCTION_ALERT', 'ATTENDANCE_INCIDENT', 'PAYROLL_READY', 'QC_REJECTED', 'GENERAL')),
  severity text not null default 'INFO' check (severity in ('INFO', 'WARNING', 'URGENT')),
  title text not null check (char_length(trim(title)) between 2 and 160),
  message text not null check (char_length(trim(message)) between 2 and 600),
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create index if not exists couture_notifications_recipient_idx
  on public.couture_notifications (tenant_id, recipient_user_id, is_read, created_at desc);

create index if not exists couture_notifications_role_idx
  on public.couture_notifications (tenant_id, recipient_role, is_read, created_at desc);

alter table public.couture_notifications enable row level security;

revoke all on public.couture_notifications from anon, authenticated;
grant select on public.couture_notifications to authenticated;
grant select, insert, update, delete on public.couture_notifications to service_role;

drop policy if exists couture_notifications_select on public.couture_notifications;
create policy couture_notifications_select on public.couture_notifications
  for select to authenticated
  using (private.couture_is_tenant_member(tenant_id));

commit;
