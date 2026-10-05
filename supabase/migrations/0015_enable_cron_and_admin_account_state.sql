-- Ensures the daily deletion purge is reproducible and exposes only account-state metadata to administrators.

create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'partyplay-purge-due-accounts') then
    perform cron.schedule(
      'partyplay-purge-due-accounts',
      '17 3 * * *',
      'select public.partyplay_purge_due_accounts()'
    );
  end if;
end;
$$;

create or replace function public.partyplay_admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.pp_profiles;
  v_email text;
  v_account_state jsonb;
begin
  perform public.partyplay_require_admin();
  select * into v_profile from public.pp_profiles where id = p_user_id;
  if not found then
    perform public.partyplay_admin_error('USER_NOT_FOUND');
  end if;

  select email into v_email from auth.users where id = p_user_id;
  v_account_state := public.partyplay_account_access_state(p_user_id);

  return jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'username', v_profile.username,
    'avatar_seed', v_profile.avatar_seed,
    'presence', v_profile.presence,
    'created_at', v_profile.created_at,
    'email', v_email,
    'room_count', (select count(*)::integer from public.pp_room_members where user_id = v_profile.id),
    'completed_games', (
      select count(*)::integer
      from public.pp_room_members membership
      join public.pp_game_sessions session on session.room_id = membership.room_id
      where membership.user_id = v_profile.id and session.status = 'finished'
    ),
    'last_activity_at', (
      select max(created_at) from public.pp_game_events where actor_id = v_profile.id
    ),
    'account_state', coalesce(v_account_state ->> 'state', 'active'),
    'restricted_until', v_account_state -> 'restricted_until',
    'purge_after', v_account_state -> 'purge_after',
    'moderation_reason', v_account_state -> 'reason'
  );
end;
$$;

notify pgrst, 'reload schema';
