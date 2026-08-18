-- PartyPlay full game engine core.
-- Extends the existing authoritative room/session model for the complete game ports.
-- Public state lives in pp_game_sessions; hands, secret words and role views live per player.

alter table public.pp_rooms drop constraint if exists pp_rooms_game_type_check;
alter table public.pp_rooms add constraint pp_rooms_game_type_check check (
  game_type in (
    'mafia', 'tic_tac_toe', 'truth_or_dare', 'snakes_ladders',
    'spyfall', 'uno', 'pictionary', 'connect_four', 'backgammon',
    'ludo', 'codenames', 'hokm'
  )
);

alter table public.pp_game_sessions drop constraint if exists pp_game_sessions_game_type_check;
alter table public.pp_game_sessions add constraint pp_game_sessions_game_type_check check (
  game_type in (
    'mafia', 'tic_tac_toe', 'truth_or_dare', 'snakes_ladders',
    'spyfall', 'uno', 'pictionary', 'connect_four', 'backgammon',
    'ludo', 'codenames', 'hokm'
  )
);

create table if not exists public.pp_game_private_state (
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  user_id uuid not null references public.pp_profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.pp_game_command_log (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  actor_id uuid not null references public.pp_profiles(id) on delete cascade,
  command_id uuid not null,
  command_type text not null check (char_length(command_type) between 1 and 48),
  created_at timestamptz not null default now(),
  unique (session_id, command_id)
);

create index if not exists pp_game_private_state_user_idx on public.pp_game_private_state(user_id, session_id);
create index if not exists pp_game_command_log_session_idx on public.pp_game_command_log(session_id, created_at);

alter table public.pp_game_private_state enable row level security;
alter table public.pp_game_command_log enable row level security;

create policy "pp_game_private_state_visible_to_owner" on public.pp_game_private_state
for select to authenticated using (user_id = auth.uid());
create policy "pp_game_commands_visible_to_actor" on public.pp_game_command_log
for select to authenticated using (actor_id = auth.uid());

alter table public.pp_game_private_state replica identity full;
alter table public.pp_game_command_log replica identity full;
alter publication supabase_realtime add table public.pp_game_private_state;
alter publication supabase_realtime add table public.pp_game_command_log;

create or replace function public.partyplay_game_capacity_is_valid(p_game_type text, p_capacity smallint)
returns boolean
language sql
immutable
as $$
  select case p_game_type
    when 'tic_tac_toe' then p_capacity = 2
    when 'connect_four' then p_capacity = 2
    when 'backgammon' then p_capacity = 2
    when 'uno' then p_capacity between 2 and 4
    when 'ludo' then p_capacity between 2 and 4
    when 'hokm' then p_capacity = 4
    when 'pictionary' then p_capacity between 3 and 8
    when 'spyfall' then p_capacity between 3 and 8
    when 'codenames' then p_capacity between 4 and 10
    when 'snakes_ladders' then p_capacity between 2 and 8
    when 'truth_or_dare' then p_capacity between 2 and 8
    when 'mafia' then p_capacity in (5, 7, 9)
    else false
  end;
$$;

create or replace function public.partyplay_create_room(
  p_game_type text,
  p_name text default 'دورهمی تازه',
  p_capacity smallint default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.pp_rooms;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  if not public.partyplay_game_capacity_is_valid(p_game_type, p_capacity) then
    perform public.partyplay_game_error('INVALID_CAPACITY');
  end if;

  if char_length(v_name) < 2 then
    v_name := 'دورهمی تازه';
  end if;

  insert into public.pp_rooms (host_id, name, game_type, capacity)
  values (auth.uid(), left(v_name, 60), p_game_type, p_capacity)
  returning * into v_room;

  insert into public.pp_room_members (room_id, user_id, seat_no, role, ready)
  values (v_room.id, auth.uid(), 1, 'host', true);

  return public.partyplay_room_payload(v_room);
end;
$$;

create or replace function public.partyplay_start_full_game(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.pp_rooms;
  v_session public.pp_game_sessions;
  v_players uuid[];
  v_state jsonb;
  v_player uuid;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  select * into v_room from public.pp_rooms where id = p_room_id for update;
  if not found then perform public.partyplay_game_error('ROOM_NOT_FOUND'); end if;
  if v_room.host_id <> auth.uid() then perform public.partyplay_game_error('NOT_HOST'); end if;
  if v_room.game_type not in ('spyfall','uno','pictionary','connect_four','backgammon','ludo','codenames','hokm','snakes_ladders') then
    perform public.partyplay_game_error('INVALID_GAME');
  end if;

  select array_agg(user_id order by seat_no, joined_at) into v_players
  from public.pp_room_members where room_id = v_room.id and role in ('host','player');
  if coalesce(array_length(v_players, 1), 0) <> v_room.capacity then
    perform public.partyplay_game_error('NEED_EXACT_CAPACITY');
  end if;

  v_state := jsonb_build_object(
    'game', v_room.game_type,
    'phase', 'setup',
    'player_ids', to_jsonb(v_players),
    'turn_index', 0,
    'round_no', 1,
    'narration', 'بازی شروع شد؛ در حال آماده‌سازی دور اول.'
  );

  insert into public.pp_game_sessions (room_id, game_type, status, state, turn_user_id, version)
  values (v_room.id, v_room.game_type, 'running', v_state, v_players[1], 0)
  on conflict (room_id) do update set
    game_type = excluded.game_type, status = 'running', state = excluded.state,
    turn_user_id = excluded.turn_user_id, winner_id = null, version = 0, finished_at = null
  returning * into v_session;

  delete from public.pp_game_private_state where session_id = v_session.id;
  foreach v_player in array v_players loop
    insert into public.pp_game_private_state (session_id, user_id, state)
    values (v_session.id, v_player, jsonb_build_object('ready', true));
  end loop;

  update public.pp_rooms set status = 'playing', started_at = coalesce(started_at, now()) where id = v_room.id;
  insert into public.pp_game_events(session_id, actor_id, sequence_no, event_type, payload)
  values(v_session.id, auth.uid(), 0, 'started', jsonb_build_object('game', v_room.game_type))
  on conflict(session_id, sequence_no) do nothing;

  return public.partyplay_session_payload(v_session);
end;
$$;

revoke all on function public.partyplay_create_room(text, text, smallint) from public;
revoke all on function public.partyplay_start_full_game(uuid) from public;
grant execute on function public.partyplay_create_room(text, text, smallint) to authenticated;
grant execute on function public.partyplay_start_full_game(uuid) to authenticated;

create or replace function public.partyplay_apply_full_game_state(
  p_session_id uuid,
  p_state jsonb,
  p_turn_user_id uuid,
  p_status text,
  p_expected_version integer,
  p_command_id uuid,
  p_event_type text default 'game_command'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_room public.pp_rooms;
  v_next public.pp_game_sessions;
begin
  if auth.uid() is null then perform public.partyplay_game_error('NOT_AUTHENTICATED'); end if;
  if jsonb_typeof(p_state) <> 'object' or p_status not in ('running', 'finished') then perform public.partyplay_game_error('INVALID_MOVE'); end if;

  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_game_error('SESSION_NOT_FOUND'); end if;
  if v_session.game_type not in ('spyfall','uno','pictionary','connect_four','backgammon','ludo','codenames','hokm','snakes_ladders') or v_session.status <> 'running' then
    perform public.partyplay_game_error('GAME_NOT_ACTIVE');
  end if;
  if not exists (select 1 from public.pp_room_members where room_id = v_session.room_id and user_id = auth.uid() and role in ('host','player')) then
    perform public.partyplay_game_error('NOT_A_MEMBER');
  end if;
  if v_session.turn_user_id is not null and v_session.turn_user_id <> auth.uid() then perform public.partyplay_game_error('NOT_YOUR_TURN'); end if;
  if v_session.version <> p_expected_version then perform public.partyplay_game_error('CONFLICT'); end if;
  if p_command_id is not null and exists(select 1 from public.pp_game_command_log where session_id = v_session.id and command_id = p_command_id) then
    return public.partyplay_session_payload(v_session);
  end if;
  if p_turn_user_id is not null and not exists(select 1 from public.pp_room_members where room_id = v_session.room_id and user_id = p_turn_user_id and role in ('host','player')) then
    perform public.partyplay_game_error('INVALID_MOVE');
  end if;

  update public.pp_game_sessions set state = p_state, turn_user_id = p_turn_user_id, status = p_status,
    version = version + 1, finished_at = case when p_status = 'finished' then now() else null end
  where id = v_session.id returning * into v_next;
  insert into public.pp_game_command_log(session_id, actor_id, command_id, command_type)
  values(v_session.id, auth.uid(), p_command_id, left(coalesce(p_event_type, 'game_command'), 48));
  insert into public.pp_game_events(session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values(v_next.id, auth.uid(), v_next.version, left(coalesce(p_event_type, 'game_command'), 48), jsonb_build_object('game', v_next.game_type), p_command_id);
  if p_status = 'finished' then update public.pp_rooms set status = 'finished', finished_at = now() where id = v_next.room_id; end if;
  return public.partyplay_session_payload(v_next);
end;
$$;

revoke all on function public.partyplay_apply_full_game_state(uuid, jsonb, uuid, text, integer, uuid, text) from public;
grant execute on function public.partyplay_apply_full_game_state(uuid, jsonb, uuid, text, integer, uuid, text) to authenticated;

create or replace function public.partyplay_load_private_game_state(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_state jsonb;
begin
  if auth.uid() is null then perform public.partyplay_game_error('NOT_AUTHENTICATED'); end if;
  if not exists (
    select 1 from public.pp_game_sessions session
    join public.pp_room_members member on member.room_id = session.room_id
    where session.id = p_session_id and member.user_id = auth.uid()
  ) then perform public.partyplay_game_error('NOT_A_MEMBER'); end if;
  select state into v_state from public.pp_game_private_state where session_id = p_session_id and user_id = auth.uid();
  return coalesce(v_state, '{}'::jsonb);
end;
$$;

create or replace function public.partyplay_save_private_game_state(
  p_session_id uuid,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_state jsonb;
begin
  if auth.uid() is null then perform public.partyplay_game_error('NOT_AUTHENTICATED'); end if;
  if jsonb_typeof(p_state) <> 'object' then perform public.partyplay_game_error('INVALID_MOVE'); end if;
  if not exists (
    select 1 from public.pp_game_sessions session
    join public.pp_room_members member on member.room_id = session.room_id
    where session.id = p_session_id and member.user_id = auth.uid() and session.status = 'running'
  ) then perform public.partyplay_game_error('NOT_A_MEMBER'); end if;
  insert into public.pp_game_private_state(session_id, user_id, state)
  values(p_session_id, auth.uid(), p_state)
  on conflict(session_id, user_id) do update set state = excluded.state, updated_at = now()
  returning state into v_state;
  return v_state;
end;
$$;

revoke all on function public.partyplay_load_private_game_state(uuid) from public;
revoke all on function public.partyplay_save_private_game_state(uuid, jsonb) from public;
grant execute on function public.partyplay_load_private_game_state(uuid) to authenticated;
grant execute on function public.partyplay_save_private_game_state(uuid, jsonb) to authenticated;
