-- Contact fields used by the printable public QR poster.
alter table public.companies add column if not exists phone text;
alter table public.companies add column if not exists address text;

comment on column public.companies.phone is 'Public contact phone shown on QR posters and public ordering pages.';
comment on column public.companies.address is 'Public establishment address shown on QR posters and public ordering pages.';
