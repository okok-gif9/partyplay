-- PartyPlay online tic-tac-toe: authoritative room and game commands.
-- Browser clients may call only these authenticated RPCs; each command validates
-- membership, turn order and session version within the database transaction.

alter table public.pp_game_events
  add column if not exists client_command_id uuid;

create unique index if not exists pp_game_events_session_command_idx
  on public.pp_game_events (session_id, client_command_id)
  where client_command_id is not null;

create or replace function public.partyplay_game_error(p_message text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception using errcode = 'P0001', message = p_message;
end;
$$;

create or replace function public.partyplay_room_payload(p_room public.pp_rooms)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_room.id,
    'invite_code', p_room.invite_code,
    'name', p_room.name,
    'game_type', p_room.game_type,
    'status', p_room.status,
    'capacity', p_room.capacity,
    'host_id', p_room.host_id
  );
$$;

create or replace function public.partyplay_session_payload(p_session public.pp_game_sessions)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_session.id,
    'room_id', p_session.room_id,
    'status', p_session.status,
    'state', p_session.state,
    'turn_user_id', p_session.turn_user_id,
    'winner_id', p_session.winner_id,
    'version', p_session.version
  );
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

  if p_game_type not in ('mafia', 'tic_tac_toe', 'truth_or_dare', 'snakes_ladders') then
    perform public.partyplay_game_error('INVALID_GAME');
  end if;

  if p_game_type = 'tic_tac_toe' then
    p_capacity := 2;
  elsif p_capacity < 2 or p_capacity > 12 then
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

create or replace function public.partyplay_join_room(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.pp_rooms;
  v_member_count integer;
  v_existing boolean;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  select * into v_room
  from public.pp_rooms
  where invite_code = upper(btrim(coalesce(p_invite_code, '')))
  for update;

  if not found then
    perform public.partyplay_game_error('ROOM_NOT_FOUND');
  end if;

  select exists(
    select 1 from public.pp_room_members
    where room_id = v_room.id and user_id = auth.uid()
  ) into v_existing;

  if v_existing then
    return public.partyplay_room_payload(v_room);
  end if;

  if v_room.status <> 'lobby' then
    perform public.partyplay_game_error('ROOM_NOT_JOINABLE');
  end if;

  select count(*) into v_member_count
  from public.pp_room_members
  where room_id = v_room.id and role in ('host', 'player');

  if v_member_count >= v_room.capacity then
    perform public.partyplay_game_error('ROOM_FULL');
  end if;

  insert into public.pp_room_members (room_id, user_id, seat_no, role, ready)
  values (v_room.id, auth.uid(), v_member_count + 1, 'player', true);

  return public.partyplay_room_payload(v_room);
end;
$$;

create or replace function public.partyplay_ttt_result(p_board jsonb)
returns text
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  v_line integer[];
  v_a text;
  v_b text;
  v_c text;
begin
  foreach v_line slice 1 in array array[
    array[0, 1, 2], array[3, 4, 5], array[6, 7, 8],
    array[0, 3, 6], array[1, 4, 7], array[2, 5, 8],
    array[0, 4, 8], array[2, 4, 6]
  ] loop
    v_a := p_board ->> v_line[1];
    v_b := p_board ->> v_line[2];
    v_c := p_board ->> v_line[3];
    if v_a is not null and v_a = v_b and v_b = v_c then
      return v_a;
    end if;
  end loop;

  if (p_board ->> 0) is not null and (p_board ->> 1) is not null and (p_board ->> 2) is not null
     and (p_board ->> 3) is not null and (p_board ->> 4) is not null and (p_board ->> 5) is not null
     and (p_board ->> 6) is not null and (p_board ->> 7) is not null and (p_board ->> 8) is not null then
    return 'draw';
  end if;

  return null;
end;
$$;

create or replace function public.partyplay_start_tic_tac_toe(p_room_id uuid)
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
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  select * into v_room
  from public.pp_rooms
  where id = p_room_id
  for update;

  if not found then
    perform public.partyplay_game_error('ROOM_NOT_FOUND');
  end if;

  if v_room.host_id <> auth.uid() then
    perform public.partyplay_game_error('NOT_HOST');
  end if;

  if v_room.game_type <> 'tic_tac_toe' then
    perform public.partyplay_game_error('INVALID_GAME');
  end if;

  select array_agg(user_id order by seat_no, joined_at)
  into v_players
  from public.pp_room_members
  where room_id = v_room.id and role in ('host', 'player');

  if coalesce(array_length(v_players, 1), 0) <> 2 then
    perform public.partyplay_game_error('NEED_TWO_PLAYERS');
  end if;

  select * into v_session
  from public.pp_game_sessions
  where room_id = v_room.id
  for update;

  if found and v_session.status in ('waiting', 'running') then
    return public.partyplay_session_payload(v_session);
  end if;

  v_state := jsonb_build_object(
    'board', jsonb_build_array(null, null, null, null, null, null, null, null, null),
    'marks', jsonb_build_object('X', v_players[1], 'O', v_players[2])
  );

  if found then
    update public.pp_game_sessions
    set game_type = 'tic_tac_toe',
        status = 'running',
        state = v_state,
        turn_user_id = v_players[1],
        winner_id = null,
        version = 0,
        finished_at = null
    where id = v_session.id
    returning * into v_session;
  else
    insert into public.pp_game_sessions (room_id, game_type, status, state, turn_user_id, version)
    values (v_room.id, 'tic_tac_toe', 'running', v_state, v_players[1], 0)
    returning * into v_session;
  end if;

  update public.pp_rooms
  set status = 'playing', started_at = coalesce(started_at, now())
  where id = v_room.id;

  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload)
  values (v_session.id, auth.uid(), 0, 'started', jsonb_build_object('game', 'tic_tac_toe'))
  on conflict (session_id, sequence_no) do nothing;

  return public.partyplay_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_tic_tac_toe_move(
  p_session_id uuid,
  p_cell smallint,
  p_expected_version integer,
  p_command_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_room public.pp_rooms;
  v_board jsonb;
  v_state jsonb;
  v_mark text;
  v_result text;
  v_next_user uuid;
  v_winner uuid;
  v_new_status text := 'running';
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  if p_cell is null or p_cell < 0 or p_cell > 8 then
    perform public.partyplay_game_error('INVALID_MOVE');
  end if;

  select * into v_session
  from public.pp_game_sessions
  where id = p_session_id
  for update;

  if not found then
    perform public.partyplay_game_error('SESSION_NOT_FOUND');
  end if;

  if p_command_id is not null and exists (
    select 1 from public.pp_game_events
    where session_id = v_session.id and client_command_id = p_command_id
  ) then
    return public.partyplay_session_payload(v_session);
  end if;

  if v_session.game_type <> 'tic_tac_toe' or v_session.status <> 'running' then
    perform public.partyplay_game_error('GAME_NOT_ACTIVE');
  end if;

  select * into v_room from public.pp_rooms where id = v_session.room_id;
  if not exists (
    select 1 from public.pp_room_members
    where room_id = v_room.id and user_id = auth.uid() and role in ('host', 'player')
  ) then
    perform public.partyplay_game_error('NOT_A_MEMBER');
  end if;

  if v_session.turn_user_id <> auth.uid() then
    perform public.partyplay_game_error('NOT_YOUR_TURN');
  end if;

  if v_session.version <> p_expected_version then
    perform public.partyplay_game_error('CONFLICT');
  end if;

  v_state := v_session.state;
  v_board := v_state -> 'board';
  if (v_board ->> p_cell) is not null then
    perform public.partyplay_game_error('CELL_OCCUPIED');
  end if;

  if v_state -> 'marks' ->> 'X' = auth.uid()::text then
    v_mark := 'X';
    v_next_user := (v_state -> 'marks' ->> 'O')::uuid;
  elsif v_state -> 'marks' ->> 'O' = auth.uid()::text then
    v_mark := 'O';
    v_next_user := (v_state -> 'marks' ->> 'X')::uuid;
  else
    perform public.partyplay_game_error('NOT_A_MEMBER');
  end if;

  v_board := jsonb_set(v_board, array[p_cell::text], to_jsonb(v_mark), false);
  v_state := jsonb_set(v_state, '{board}', v_board, false);
  v_result := public.partyplay_ttt_result(v_board);

  if v_result = 'X' then
    v_winner := (v_state -> 'marks' ->> 'X')::uuid;
    v_new_status := 'finished';
    v_next_user := null;
  elsif v_result = 'O' then
    v_winner := (v_state -> 'marks' ->> 'O')::uuid;
    v_new_status := 'finished';
    v_next_user := null;
  elsif v_result = 'draw' then
    v_new_status := 'finished';
    v_next_user := null;
  end if;

  update public.pp_game_sessions
  set state = v_state,
      turn_user_id = v_next_user,
      winner_id = v_winner,
      status = v_new_status,
      version = version + 1,
      finished_at = case when v_new_status = 'finished' then now() else null end
  where id = v_session.id
  returning * into v_session;

  insert into public.pp_game_events (
    session_id, actor_id, sequence_no, event_type, payload, client_command_id
  ) values (
    v_session.id,
    auth.uid(),
    v_session.version,
    'move',
    jsonb_build_object('cell', p_cell, 'mark', v_mark, 'result', v_result),
    p_command_id
  );

  if v_new_status = 'finished' then
    update public.pp_rooms set status = 'finished', finished_at = now() where id = v_room.id;
  end if;

  return public.partyplay_session_payload(v_session);
end;
$$;

revoke all on function public.partyplay_create_room(text, text, smallint) from public;
revoke all on function public.partyplay_join_room(text) from public;
revoke all on function public.partyplay_start_tic_tac_toe(uuid) from public;
revoke all on function public.partyplay_tic_tac_toe_move(uuid, smallint, integer, uuid) from public;

grant execute on function public.partyplay_create_room(text, text, smallint) to authenticated;
grant execute on function public.partyplay_join_room(text) to authenticated;
grant execute on function public.partyplay_start_tic_tac_toe(uuid) to authenticated;
grant execute on function public.partyplay_tic_tac_toe_move(uuid, smallint, integer, uuid) to authenticated;
