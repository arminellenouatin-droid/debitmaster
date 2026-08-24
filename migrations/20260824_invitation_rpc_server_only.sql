-- DebitManager: invitation acceptance is callable only by the server service role.
-- The API authenticates the user first and passes the verified user id and email to this RPC.
begin;

create or replace function public.accept_employee_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
returns table (employee_id uuid, tenant_id uuid, role_position text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.employee_invitations%rowtype;
  v_employee_id uuid;
  v_existing_tenant uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into v_invitation
  from public.employee_invitations
  where token_hash = lower(trim(p_token_hash))
    and status = 'PENDING'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'INVITATION_INVALID_OR_EXPIRED';
  end if;

  if v_email = '' or v_email <> lower(v_invitation.email) then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  select tenant_id into v_existing_tenant
  from public.profiles
  where id = p_user_id;

  if v_existing_tenant is not null and v_existing_tenant <> v_invitation.tenant_id then
    raise exception 'ACCOUNT_ALREADY_LINKED';
  end if;

  insert into public.profiles (id, tenant_id, first_name, last_name, email, user_type, role, status)
  values (p_user_id, v_invitation.tenant_id, v_invitation.first_name, v_invitation.last_name, lower(v_invitation.email), 'TENANT_STAFF', v_invitation.position, 'ACTIVE')
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    user_type = 'TENANT_STAFF',
    role = excluded.role,
    status = 'ACTIVE',
    updated_at = now();

  select id into v_employee_id
  from public.employees
  where tenant_id = v_invitation.tenant_id and user_id = p_user_id and deleted_at is null
  limit 1;

  if v_employee_id is null then
    insert into public.employees (tenant_id, user_id, first_name, last_name, position, status)
    values (v_invitation.tenant_id, p_user_id, v_invitation.first_name, v_invitation.last_name, v_invitation.position, 'ACTIVE')
    returning id into v_employee_id;
  else
    update public.employees
    set first_name = v_invitation.first_name,
        last_name = v_invitation.last_name,
        position = v_invitation.position,
        status = 'ACTIVE',
        updated_at = now()
    where id = v_employee_id;
  end if;

  update public.employee_invitations
  set status = 'ACCEPTED', accepted_at = now(), accepted_user_id = p_user_id, employee_id = v_employee_id
  where id = v_invitation.id;

  return query select v_employee_id, v_invitation.tenant_id, v_invitation.position;
end;
$$;

revoke all on function public.accept_employee_invitation(text) from public;
revoke all on function public.accept_employee_invitation(text) from anon;
revoke all on function public.accept_employee_invitation(text) from authenticated;
revoke all on function public.accept_employee_invitation(text, uuid, text) from public;
revoke all on function public.accept_employee_invitation(text, uuid, text) from anon;
revoke all on function public.accept_employee_invitation(text, uuid, text) from authenticated;
grant execute on function public.accept_employee_invitation(text, uuid, text) to service_role;

commit;
