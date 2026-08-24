-- Verrou transactionnel par établissement pour éviter une double réservation concurrente.
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
  v_ends_at timestamptz := now() + interval '4 hours';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text));
  if not exists (select 1 from public.companies c where c.id = p_tenant_id and c.owner_user_id = v_user and c.deleted_at is null) then raise exception 'OWNER_REQUIRED'; end if;
  if p_fee_rate < 0 or p_fee_rate > 100 then raise exception 'INVALID_FEE_RATE'; end if;
  select coalesce(sum(p.amount), 0)::integer into v_gross from public.payments p where p.tenant_id = p_tenant_id and p.status = 'PAID' and p.payment_method = 'MOBILE_MONEY' and p.settlement_id is null;
  if v_gross <= 0 then raise exception 'NO_AVAILABLE_FUNDS'; end if;
  v_fee := round(v_gross * p_fee_rate / 100.0)::integer;
  v_net := v_gross - v_fee;
  insert into public.establishment_settlements (tenant_id, requested_by, gross_amount, saas_fee_amount, net_amount, status, verification_ends_at) values (p_tenant_id, v_user, v_gross, v_fee, v_net, 'VERIFYING', v_ends_at) returning id into v_settlement_id;
  update public.payments p set settlement_id = v_settlement_id, updated_at = now() where p.tenant_id = p_tenant_id and p.status = 'PAID' and p.payment_method = 'MOBILE_MONEY' and p.settlement_id is null;
  return jsonb_build_object('id', v_settlement_id, 'gross_amount', v_gross, 'saas_fee_amount', v_fee, 'net_amount', v_net, 'status', 'VERIFYING', 'verification_ends_at', v_ends_at);
end;
$$;
