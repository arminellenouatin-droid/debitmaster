-- DebitManager: allocation atomique des paiements Mobile Money à un reversement établissement.
alter table public.payments
  add column if not exists settlement_id uuid references public.establishment_settlements(id) on delete set null;
create index if not exists payments_tenant_settlement_idx on public.payments (tenant_id, settlement_id, payment_method, status);

create or replace function public.request_establishment_settlement(p_tenant_id uuid, p_fee_rate numeric default 10.00)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := (select auth.uid());
  v_gross integer;
  v_fee integer;
  v_net integer;
  v_settlement_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = v_user and c.deleted_at is null) then raise exception 'OWNER_REQUIRED'; end if;
  if p_fee_rate < 0 or p_fee_rate > 100 then raise exception 'INVALID_FEE_RATE'; end if;
  select coalesce(sum(p.amount), 0)::integer into v_gross
  from public.payments p
  where p.tenant_id = p_tenant_id
    and p.status = 'PAID'
    and p.payment_method = 'MOBILE_MONEY'
    and p.settlement_id is null;
  if v_gross <= 0 then raise exception 'NO_AVAILABLE_FUNDS'; end if;
  v_fee := round(v_gross * p_fee_rate / 100.0)::integer;
  v_net := v_gross - v_fee;
  insert into public.establishment_settlements (tenant_id, requested_by, gross_amount, saas_fee_amount, net_amount, status, verification_ends_at)
  values (p_tenant_id, v_user, v_gross, v_fee, v_net, 'VERIFYING', now() + interval '4 hours')
  returning id into v_settlement_id;
  update public.payments p set settlement_id = v_settlement_id, updated_at = now()
  where p.tenant_id = p_tenant_id and p.status = 'PAID' and p.payment_method = 'MOBILE_MONEY' and p.settlement_id is null;
  return jsonb_build_object('id', v_settlement_id, 'gross_amount', v_gross, 'saas_fee_amount', v_fee, 'net_amount', v_net, 'status', 'VERIFYING', 'verification_ends_at', now() + interval '4 hours');
end;
$$;
revoke execute on function public.request_establishment_settlement(uuid, numeric) from public;
grant execute on function public.request_establishment_settlement(uuid, numeric) to authenticated;
