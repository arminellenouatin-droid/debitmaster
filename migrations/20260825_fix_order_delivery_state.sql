-- DebitManager: RECEIVED signifie remis à la Serveuse, pas livré au client.
-- Une commande ne passe DELIVERED qu’après livraison réelle de tous ses articles.

create or replace function public.refresh_order_status_from_items(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, private
as $$
declare
  order_row public.orders;
  item_count integer;
  received_count integer;
  delivered_count integer;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then raise exception 'ORDER_NOT_FOUND'; end if;

  select count(*),
         count(*) filter (where preparation_status in ('RECEIVED', 'DELIVERED')),
         count(*) filter (where preparation_status = 'DELIVERED')
  into item_count, received_count, delivered_count
  from public.order_items where order_id = p_order_id;

  if item_count > 0 and delivered_count = item_count and order_row.status in ('HANDED_OFF', 'DELIVERED') then
    update public.orders set status = 'DELIVERED', delivered_at = coalesce(delivered_at, now()), updated_at = now()
    where id = p_order_id returning * into order_row;
  elsif item_count > 0 and received_count > 0 and order_row.status in ('PENDING', 'IN_PREPARATION', 'READY') then
    update public.orders set status = 'HANDED_OFF', received_at = coalesce(received_at, now()), updated_at = now()
    where id = p_order_id returning * into order_row;
  end if;
  return order_row;
end;
$$;

grant execute on function public.refresh_order_status_from_items(uuid) to authenticated;
