-- PartyPlay Mafia professional upgrade: correct Godfather investigation logic
-- and reveal every role to room members only after the game finishes.

create or replace function public.partyplay_mafia_submit_night_action(
  p_session_id uuid,
  p_target_user_id uuid default null,
  p_expected_version integer default null,
  p_command_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_role text;
  v_phase text;
  v_action text;
  v_day integer;
  v_result text;
  v_target_role text;
  v_godfather_checks integer;
begin
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if p_expected_version is not null and v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;

  v_phase := coalesce(v_session.state ->> 'phase', '');
  select role into v_role
  from public.pp_mafia_players
  where session_id = v_session.id and user_id = auth.uid() and is_alive;
  if v_role is null then perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;

  if v_phase = 'mafia_action' and v_role in ('godfather', 'mafia') then
    v_action := 'mafia_target';
  elsif v_phase = 'doctor_action' and v_role = 'doctor' then
    v_action := 'doctor_save';
  elsif v_phase = 'detective_action' and v_role = 'detective' then
    v_action := 'detective_check';
  else
    perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED');
  end if;

  if p_target_user_id is not null and not exists (
    select 1 from public.pp_mafia_players
    where session_id = v_session.id and user_id = p_target_user_id and is_alive
  ) then
    perform public.partyplay_mafia_error('INVALID_CHOICE');
  end if;

  if v_action = 'mafia_target' and p_target_user_id is not null and exists (
    select 1 from public.pp_mafia_players
    where session_id = v_session.id and user_id = p_target_user_id and faction = 'mafia'
  ) then
    perform public.partyplay_mafia_error('INVALID_CHOICE');
  end if;

  if v_action = 'detective_check' and p_target_user_id = auth.uid() then
    perform public.partyplay_mafia_error('INVALID_CHOICE');
  end if;

  if v_action = 'doctor_save' and p_target_user_id = auth.uid() then
    if exists (
      select 1 from public.pp_mafia_players
      where session_id = v_session.id and user_id = auth.uid() and doctor_self_save_used
    ) then
      perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED');
    end if;
    update public.pp_mafia_players
    set doctor_self_save_used = true
    where session_id = v_session.id and user_id = auth.uid();
  end if;

  v_day := greatest(1, (v_session.state ->> 'day_no')::integer);

  if v_action = 'detective_check' and p_target_user_id is not null then
    select role into v_target_role
    from public.pp_mafia_players
    where session_id = v_session.id and user_id = p_target_user_id;

    if v_target_role = 'godfather' then
      -- The first investigation of this specific Godfather looks like a citizen.
      -- The counter belongs to the investigated Godfather, not to the detective.
      update public.pp_mafia_players
      set godfather_checks = godfather_checks + 1
      where session_id = v_session.id and user_id = p_target_user_id
      returning godfather_checks into v_godfather_checks;

      v_result := case when v_godfather_checks = 1 then 'citizen' else 'godfather' end;
    elsif v_target_role = 'mafia' then
      v_result := 'mafia';
    else
      v_result := 'citizen';
    end if;
  end if;

  insert into public.pp_mafia_night_actions (
    session_id, day_no, actor_id, action_type, target_user_id, result
  ) values (
    v_session.id, v_day, auth.uid(), v_action, p_target_user_id, v_result
  )
  on conflict (session_id, day_no, actor_id, action_type)
  do update set
    target_user_id = excluded.target_user_id,
    result = excluded.result,
    updated_at = now();

  update public.pp_game_sessions
  set version = version + 1
  where id = v_session.id
  returning * into v_session;

  insert into public.pp_game_events (
    session_id, actor_id, sequence_no, event_type, payload, client_command_id
  ) values (
    v_session.id,
    auth.uid(),
    v_session.version,
    'mafia_night_action',
    jsonb_build_object('phase', v_phase),
    p_command_id
  );

  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_load_mafia_private_view(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_self public.pp_mafia_players;
  v_day integer;
  v_revealed_roles jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;

  select * into v_session from public.pp_game_sessions where id = p_session_id;
  if not found or v_session.game_type <> 'mafia' then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if not exists (
    select 1 from public.pp_room_members
    where room_id = v_session.room_id and user_id = auth.uid()
  ) then
    perform public.partyplay_mafia_error('NOT_A_MEMBER');
  end if;

  select * into v_self
  from public.pp_mafia_players
  where session_id = v_session.id and user_id = auth.uid();
  if not found then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;

  v_day := greatest(1, coalesce((v_session.state ->> 'day_no')::integer, 1));

  if coalesce(v_session.state ->> 'phase', '') = 'finished' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', player.user_id,
        'display_name', profile.display_name,
        'role', player.role,
        'faction', player.faction,
        'is_alive', player.is_alive
      ) order by case when player.faction = 'mafia' then 0 else 1 end, profile.display_name
    ), '[]'::jsonb)
    into v_revealed_roles
    from public.pp_mafia_players player
    join public.pp_profiles profile on profile.id = player.user_id
    where player.session_id = v_session.id;
  end if;

  return jsonb_build_object(
    'self', jsonb_build_object(
      'role', v_self.role,
      'faction', v_self.faction,
      'is_alive', v_self.is_alive,
      'role_acknowledged', v_self.role_acknowledged,
      'doctor_self_save_used', v_self.doctor_self_save_used
    ),
    'teammates', case when v_self.faction = 'mafia' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', player.user_id,
        'display_name', profile.display_name,
        'role', player.role,
        'is_alive', player.is_alive
      ) order by profile.display_name)
      from public.pp_mafia_players player
      join public.pp_profiles profile on profile.id = player.user_id
      where player.session_id = v_session.id and player.faction = 'mafia'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'detective_result', case when v_self.role = 'detective' then (
      select result
      from public.pp_mafia_night_actions
      where session_id = v_session.id
        and day_no = v_day
        and actor_id = auth.uid()
        and action_type = 'detective_check'
    ) else null end,
    'revealed_roles', v_revealed_roles
  );
end;
$$;

revoke all on function public.partyplay_mafia_submit_night_action(uuid, uuid, integer, uuid) from public;
grant execute on function public.partyplay_mafia_submit_night_action(uuid, uuid, integer, uuid) to authenticated;
revoke all on function public.partyplay_load_mafia_private_view(uuid) from public;
grant execute on function public.partyplay_load_mafia_private_view(uuid) to authenticated;
