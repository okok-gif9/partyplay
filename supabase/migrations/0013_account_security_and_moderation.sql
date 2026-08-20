-- Account security, recovery-window deletion, moderation, and deterministic daily purge.
-- Browser clients receive only authenticated RPC access; no service-role credential is used.

create table if not exists public.pp_account_deletion_requests (
  user_id uuid primary key references public.pp_profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null,
  requested_by uuid references public.pp_profiles(id) on delete set null,
  reason text,
  check (purge_after > requested_at),
  check (reason is null or char_length(reason) between 8 and 280)
);

create table if not exists public.pp_account_moderation (
  user_id uuid primary key references public.pp_profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'restricted', 'suspended')),
  restricted_until timestamptz,
  reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.pp_profiles(id) on delete set null,
  check ((status = 'restricted' and (restricted_until is null or restricted_until > updated_at))
    or (status in ('active', 'suspended') and restricted_until is null)),
  check (reason is null or char_length(reason) between 8 and 280)
);

create table if not exists public.pp_account_action_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  target_user_id uuid not null,
  action text not null check (char_length(action) between 3 and 64),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (reason is null or char_length(reason) between 8 and 280)
);

create index if not exists pp_account_deletion_requests_purge_idx
  on public.pp_account_deletion_requests(purge_after);
create index if not exists pp_account_moderation_status_idx
  on public.pp_account_moderation(status, restricted_until);
create index if not exists pp_account_action_events_target_created_idx
  on public.pp_account_action_events(target_user_id, created_at desc);

alter table public.pp_account_deletion_requests enable row level security;
alter table public.pp_account_moderation enable row level security;
alter table public.pp_account_action_events enable row level security;

create or replace function public.partyplay_account_error(p_code text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.partyplay_game_error(p_code);
end;
$$;

create or replace function public.partyplay_account_access_state(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moderation public.pp_account_moderation;
  v_deletion public.pp_account_deletion_requests;
  v_state text := 'active';
begin
  select * into v_deletion from public.pp_account_deletion_requests where user_id = p_user_id;
  if found then
    return jsonb_build_object(
      'state', 'pending_deletion',
      'purge_after', v_deletion.purge_after,
      'reason', null
    );
  end if;

  select * into v_moderation from public.pp_account_moderation where user_id = p_user_id;
  if found then
    if v_moderation.status = 'restricted' and v_moderation.restricted_until is not null and v_moderation.restricted_until <= now() then
      update public.pp_account_moderation
      set status = 'active', restricted_until = null, reason = null, updated_at = now(), updated_by = null
      where user_id = p_user_id;
    elsif v_moderation.status in ('restricted', 'suspended') then
      v_state := v_moderation.status;
    end if;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'restricted_until', case when v_state = 'restricted' then v_moderation.restricted_until else null end,
    'reason', case when v_state in ('restricted', 'suspended') then v_moderation.reason else null end
  );
end;
$$;

create or replace function public.partyplay_account_security_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_state jsonb;
begin
  if v_user_id is null then
    perform public.partyplay_account_error('NOT_AUTHENTICATED');
  end if;
  v_state := public.partyplay_account_access_state(v_user_id);
  return v_state || jsonb_build_object('can_set_password', true, 'google_configured', false);
end;
$$;

create or replace function public.partyplay_restore_account_after_sign_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_count integer := 0;
begin
  if v_user_id is null then
    perform public.partyplay_account_error('NOT_AUTHENTICATED');
  end if;

  delete from public.pp_account_deletion_requests where user_id = v_user_id;
  get diagnostics v_deleted_count = row_count;
  if v_deleted_count > 0 then
    insert into public.pp_account_action_events (actor_id, target_user_id, action, metadata)
    values (v_user_id, v_user_id, 'deletion_recovered', jsonb_build_object('method', 'verified_sign_in'));
  end if;

  return public.partyplay_account_access_state(v_user_id);
end;
$$;

create or replace function public.partyplay_request_account_deletion(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_purge_after timestamptz := now() + interval '30 days';
begin
  if v_user_id is null then
    perform public.partyplay_account_error('NOT_AUTHENTICATED');
  end if;
  if btrim(coalesce(p_confirmation, '')) <> 'DELETE' then
    perform public.partyplay_account_error('DELETE_CONFIRMATION_REQUIRED');
  end if;

  insert into public.pp_account_deletion_requests (user_id, requested_at, purge_after, requested_by, reason)
  values (v_user_id, now(), v_purge_after, v_user_id, null)
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        purge_after = excluded.purge_after,
        requested_by = excluded.requested_by,
        reason = null;

  insert into public.pp_account_action_events (actor_id, target_user_id, action, metadata)
  values (v_user_id, v_user_id, 'deletion_requested', jsonb_build_object('purge_after', v_purge_after));

  return jsonb_build_object('state', 'pending_deletion', 'purge_after', v_purge_after);
end;
$$;

create or replace function public.partyplay_require_product_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_state text;
begin
  if v_user_id is null then
    perform public.partyplay_account_error('NOT_AUTHENTICATED');
  end if;
  v_state := public.partyplay_account_access_state(v_user_id) ->> 'state';
  if v_state = 'restricted' then
    perform public.partyplay_account_error('ACCOUNT_RESTRICTED');
  end if;
  if v_state = 'suspended' then
    perform public.partyplay_account_error('ACCOUNT_SUSPENDED');
  end if;
  if v_state = 'pending_deletion' then
    perform public.partyplay_account_error('ACCOUNT_PENDING_DELETION');
  end if;
end;
$$;

create or replace function public.partyplay_admin_moderate_account(
  p_user_id uuid,
  p_action text,
  p_reason text,
  p_duration_hours integer default null,
  p_confirm_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_profile public.pp_profiles;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := left(btrim(coalesce(p_reason, '')), 280);
  v_expiry timestamptz;
begin
  v_admin_id := public.partyplay_require_admin();
  select * into v_profile from public.pp_profiles where id = p_user_id for update;
  if not found then
    perform public.partyplay_admin_error('USER_NOT_FOUND');
  end if;
  if p_user_id = v_admin_id then
    perform public.partyplay_admin_error('CANNOT_MODERATE_SELF');
  end if;
  if char_length(v_reason) < 8 then
    perform public.partyplay_admin_error('MODERATION_REASON_REQUIRED');
  end if;

  if v_action = 'restrict' then
    if p_duration_hours is not null and p_duration_hours not in (24, 168, 720) then
      perform public.partyplay_admin_error('INVALID_RESTRICTION_DURATION');
    end if;
    v_expiry := case when p_duration_hours is null then null else now() + make_interval(hours => p_duration_hours) end;
    insert into public.pp_account_moderation (user_id, status, restricted_until, reason, updated_at, updated_by)
    values (p_user_id, 'restricted', v_expiry, v_reason, now(), v_admin_id)
    on conflict (user_id) do update set
      status = excluded.status,
      restricted_until = excluded.restricted_until,
      reason = excluded.reason,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
    insert into public.pp_account_action_events (actor_id, target_user_id, action, reason, metadata)
    values (v_admin_id, p_user_id, 'restricted', v_reason, jsonb_build_object('restricted_until', v_expiry));
    return public.partyplay_account_access_state(p_user_id);
  end if;

  if v_action = 'suspend' then
    insert into public.pp_account_moderation (user_id, status, restricted_until, reason, updated_at, updated_by)
    values (p_user_id, 'suspended', null, v_reason, now(), v_admin_id)
    on conflict (user_id) do update set
      status = excluded.status,
      restricted_until = null,
      reason = excluded.reason,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
    insert into public.pp_account_action_events (actor_id, target_user_id, action, reason)
    values (v_admin_id, p_user_id, 'suspended', v_reason);
    return public.partyplay_account_access_state(p_user_id);
  end if;

  if v_action = 'restore' then
    delete from public.pp_account_moderation where user_id = p_user_id;
    delete from public.pp_account_deletion_requests where user_id = p_user_id;
    insert into public.pp_account_action_events (actor_id, target_user_id, action, reason)
    values (v_admin_id, p_user_id, 'restored', v_reason);
    return public.partyplay_account_access_state(p_user_id);
  end if;

  if v_action = 'schedule_delete' then
    if lower(btrim(coalesce(p_confirm_username, ''))) <> lower(v_profile.username) then
      perform public.partyplay_admin_error('DELETE_CONFIRMATION_REQUIRED');
    end if;
    insert into public.pp_account_deletion_requests (user_id, requested_at, purge_after, requested_by, reason)
    values (p_user_id, now(), now() + interval '30 days', v_admin_id, v_reason)
    on conflict (user_id) do update set
      requested_at = excluded.requested_at,
      purge_after = excluded.purge_after,
      requested_by = excluded.requested_by,
      reason = excluded.reason;
    insert into public.pp_account_action_events (actor_id, target_user_id, action, reason, metadata)
    values (v_admin_id, p_user_id, 'deletion_scheduled', v_reason, jsonb_build_object('purge_after', now() + interval '30 days'));
    return public.partyplay_account_access_state(p_user_id);
  end if;

  if v_action = 'purge_now' then
    if lower(btrim(coalesce(p_confirm_username, ''))) <> lower(v_profile.username) then
      perform public.partyplay_admin_error('DELETE_CONFIRMATION_REQUIRED');
    end if;
    insert into public.pp_account_action_events (actor_id, target_user_id, action, reason, metadata)
    values (v_admin_id, p_user_id, 'purged_by_admin', v_reason, jsonb_build_object('username', v_profile.username));
    delete from auth.users where id = p_user_id;
    return jsonb_build_object('state', 'purged', 'user_id', p_user_id);
  end if;

  perform public.partyplay_admin_error('INVALID_MODERATION_ACTION');
  return '{}'::jsonb;
end;
$$;

create or replace function public.partyplay_purge_due_accounts()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request record;
  v_username text;
  v_purged integer := 0;
begin
  for v_request in
    select user_id, purge_after, reason
    from public.pp_account_deletion_requests
    where purge_after <= now()
    order by purge_after
    for update skip locked
  loop
    select username into v_username from public.pp_profiles where id = v_request.user_id;
    insert into public.pp_account_action_events (actor_id, target_user_id, action, reason, metadata)
    values (null, v_request.user_id, 'purged_after_recovery_window', v_request.reason, jsonb_build_object('username', v_username, 'purge_after', v_request.purge_after));
    delete from auth.users where id = v_request.user_id;
    v_purged := v_purged + 1;
  end loop;
  return v_purged;
end;
$$;

-- pg_cron is available on the production database. Dynamic SQL keeps this migration
-- portable for local PostgreSQL validation where the extension may not be installed.
do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute 'select jobid from cron.job where jobname = $1 limit 1'
      into v_job_id using 'partyplay-purge-due-accounts';
    if v_job_id is not null then
      execute 'select cron.unschedule($1)' using v_job_id;
    end if;
    execute format(
      'select cron.schedule(%L, %L, %L)',
      'partyplay-purge-due-accounts',
      '17 3 * * *',
      'select public.partyplay_purge_due_accounts()'
    );
  else
    raise notice 'pg_cron is not installed; configure a daily call to partyplay_purge_due_accounts() in production.';
  end if;
end;
$$;

revoke all on table public.pp_account_deletion_requests from public;
revoke all on table public.pp_account_moderation from public;
revoke all on table public.pp_account_action_events from public;

revoke all on function public.partyplay_account_access_state(uuid) from public;
revoke all on function public.partyplay_account_security_state() from public;
revoke all on function public.partyplay_restore_account_after_sign_in() from public;
revoke all on function public.partyplay_request_account_deletion(text) from public;
revoke all on function public.partyplay_require_product_access() from public;
revoke all on function public.partyplay_admin_moderate_account(uuid, text, text, integer, text) from public;
revoke all on function public.partyplay_purge_due_accounts() from public;

grant execute on function public.partyplay_account_security_state() to authenticated;
grant execute on function public.partyplay_restore_account_after_sign_in() to authenticated;
grant execute on function public.partyplay_request_account_deletion(text) to authenticated;
grant execute on function public.partyplay_require_product_access() to authenticated;
grant execute on function public.partyplay_admin_moderate_account(uuid, text, text, integer, text) to authenticated;

notify pgrst, 'reload schema';
