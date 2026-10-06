begin;

create table if not exists public.meal_accompaniment_images (
  tenant_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (name in ('Riz', 'Pâte', 'Frites', 'Attiéké', 'Salade composée', 'Alloco')),
  image_path text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, name),
  constraint meal_accompaniment_image_tenant_path_check
    check (image_path like tenant_id::text || '/%')
);

alter table public.meal_accompaniment_images enable row level security;
revoke all on public.meal_accompaniment_images from anon, authenticated;
grant select, insert, update, delete on public.meal_accompaniment_images to service_role;

commit;
