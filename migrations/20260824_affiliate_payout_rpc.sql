-- DebitManager: demande de paiement affilié atomique et vérifiée par la base.
begin;
create or replace function public.create_affiliate_payout_request(
  p_amount integer,
  p_payment_method text,
  p_payment_account_ref text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_available integer;
  v_reserved integer;
  v_request_id uuid;
begin
  if auth.uid() is null or p_amount < 20000 or p_payment_method not in ('MOBILE_MONEY', 'BANK_TRANSFER') or length(trim(coalesce(p_payment_account_ref, ''))) < 6 then
    raise exception 'INVALID_PAYOUT_REQUEST';
  end if;

  select a.id into v_affiliate_id
  from public.platform_affiliates a
  where a.user_id = auth.uid() and a.status = 'ACTIVE'
  for update;
  if v_affiliate_id is null then raise exception 'AFFILIATE_NOT_FOUND'; end if;

  select coalesce(sum(c.commission_amount), 0)::integer into v_available
  from public.affiliate_commissions c
  where c.affiliate_id = v_affiliate_id and c.status in ('APPROVED', 'PAID');

  select coalesce(sum(p.amount), 0)::integer into v_reserved
  from public.affiliate_payout_requests p
  where p.affiliate_id = v_affiliate_id and p.status in ('PENDING', 'APPROVED', 'PAID');

  if p_amount > greatest(v_available - v_reserved, 0) then raise exception 'INSUFFICIENT_AVAILABLE_COMMISSION'; end if;

  insert into public.affiliate_payout_requests (affiliate_id, amount, payment_method, payment_account_ref)
  values (v_affiliate_id, p_amount, p_payment_method, trim(p_payment_account_ref))
  returning id into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.create_affiliate_payout_request(integer, text, text) from public;
grant execute on function public.create_affiliate_payout_request(integer, text, text) to authenticated;
commit;
