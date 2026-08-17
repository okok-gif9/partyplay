-- PartyPlay online Truth or Dare: server-authoritative turns, round chat quota and reactions.

alter table public.pp_room_messages
  add column if not exists session_id uuid references public.pp_game_sessions(id) on delete cascade,
  add column if not exists round_no integer check (round_no is null or round_no > 0);

create index if not exists pp_room_messages_session_round_sender_idx
  on public.pp_room_messages(session_id, round_no, sender_id);

create table if not exists public.pp_room_message_reactions (
  message_id bigint not null references public.pp_room_messages(id) on delete cascade,
  user_id uuid not null references public.pp_profiles(id) on delete cascade,
  reaction text not null check (reaction in ('😂', '🔥', '👏', '😮')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

drop trigger if exists pp_room_message_reactions_updated_at on public.pp_room_message_reactions;
create trigger pp_room_message_reactions_updated_at before update on public.pp_room_message_reactions
for each row execute procedure public.partyplay_set_updated_at();

alter table public.pp_room_message_reactions enable row level security;

drop policy if exists "pp_message_reactions_visible_to_room_members" on public.pp_room_message_reactions;
create policy "pp_message_reactions_visible_to_room_members" on public.pp_room_message_reactions
for select to authenticated using (exists (
  select 1
  from public.pp_room_messages message
  join public.pp_room_members membership on membership.room_id = message.room_id
  where message.id = pp_room_message_reactions.message_id and membership.user_id = auth.uid()
));

-- Chat quota must be enforced by the locked RPC transaction, not bypassable by direct inserts.
drop policy if exists "pp_room_messages_send_as_self" on public.pp_room_messages;

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
    'round_no', p_session.round_no,
    'version', p_session.version
  );
$$;

create or replace function public.partyplay_truth_dare_random_cycle(p_room_id uuid)
returns uuid[]
language sql
volatile
security invoker
set search_path = public
as $$
  select array_agg(user_id order by random())
  from public.pp_room_members
  where room_id = p_room_id and role in ('host', 'player');
$$;

create or replace function public.partyplay_start_truth_dare(p_room_id uuid)
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
  v_round_no integer := 1;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  select * into v_room from public.pp_rooms where id = p_room_id for update;
  if not found then
    perform public.partyplay_game_error('ROOM_NOT_FOUND');
  end if;
  if v_room.host_id <> auth.uid() then
    perform public.partyplay_game_error('NOT_HOST');
  end if;
  if v_room.game_type <> 'truth_or_dare' then
    perform public.partyplay_game_error('INVALID_GAME');
  end if;

  v_players := public.partyplay_truth_dare_random_cycle(v_room.id);
  if coalesce(array_length(v_players, 1), 0) < 2 then
    perform public.partyplay_game_error('NEED_TWO_PLAYERS');
  end if;

  select * into v_session from public.pp_game_sessions where room_id = v_room.id for update;
  if found and v_session.status = 'running' then
    return public.partyplay_session_payload(v_session);
  end if;
  if found then
    v_round_no := v_session.round_no + 1;
  end if;

  v_state := jsonb_build_object(
    'phase', 'choosing',
    'cycle_player_ids', to_jsonb(v_players),
    'cycle_index', 0,
    'selected', null,
    'chat_closes_at', null
  );

  if found then
    update public.pp_game_sessions
    set game_type = 'truth_or_dare', status = 'running', round_no = v_round_no,
        state = v_state, turn_user_id = v_players[1], winner_id = null,
        version = 0, finished_at = null
    where id = v_session.id
    returning * into v_session;
  else
    insert into public.pp_game_sessions (room_id, game_type, round_no, status, state, turn_user_id, version)
    values (v_room.id, 'truth_or_dare', v_round_no, 'running', v_state, v_players[1], 0)
    returning * into v_session;
  end if;

  update public.pp_rooms
  set status = 'playing', started_at = now(), finished_at = null
  where id = v_room.id;

  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload)
  values (v_session.id, auth.uid(), v_session.version, 'truth_dare_started', jsonb_build_object('round_no', v_session.round_no))
  on conflict (session_id, sequence_no) do nothing;

  return public.partyplay_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_truth_dare_choose(
  p_session_id uuid,
  p_choice text,
  p_expected_version integer,
  p_command_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_room public.pp_rooms;
  v_state jsonb;
  v_card_index integer;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;
  if p_choice not in ('truth', 'dare') then
    perform public.partyplay_game_error('INVALID_CHOICE');
  end if;

  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then
    perform public.partyplay_game_error('SESSION_NOT_FOUND');
  end if;
  if p_command_id is not null and exists (
    select 1 from public.pp_game_events where session_id = v_session.id and client_command_id = p_command_id
  ) then
    return public.partyplay_session_payload(v_session);
  end if;
  if v_session.game_type <> 'truth_or_dare' or v_session.status <> 'running' then
    perform public.partyplay_game_error('GAME_NOT_ACTIVE');
  end if;
  if v_session.turn_user_id <> auth.uid() then
    perform public.partyplay_game_error('NOT_YOUR_TURN');
  end if;
  if v_session.version <> p_expected_version then
    perform public.partyplay_game_error('CONFLICT');
  end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'choosing' then
    perform public.partyplay_game_error('CHOICE_ALREADY_MADE');
  end if;

  select * into v_room from public.pp_rooms where id = v_session.room_id;
  v_card_index := floor(random() * 40)::integer;
  v_state := jsonb_set(v_session.state, '{phase}', '"revealed"'::jsonb, false);
  v_state := jsonb_set(v_state, '{selected}', jsonb_build_object(
    'player_id', auth.uid(), 'choice', p_choice, 'card_index', v_card_index
  ), false);

  update public.pp_game_sessions
  set state = v_state, version = version + 1
  where id = v_session.id
  returning * into v_session;

  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'truth_dare_choice',
    jsonb_build_object('choice', p_choice, 'card_index', v_card_index, 'round_no', v_session.round_no), p_command_id);

  return public.partyplay_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_truth_dare_next_turn(
  p_session_id uuid,
  p_expected_version integer,
  p_command_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_players uuid[];
  v_cycle_index integer;
  v_state jsonb;
  v_next_user uuid;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then
    perform public.partyplay_game_error('SESSION_NOT_FOUND');
  end if;
  if p_command_id is not null and exists (
    select 1 from public.pp_game_events where session_id = v_session.id and client_command_id = p_command_id
  ) then
    return public.partyplay_session_payload(v_session);
  end if;
  if v_session.game_type <> 'truth_or_dare' or v_session.status <> 'running' then
    perform public.partyplay_game_error('GAME_NOT_ACTIVE');
  end if;
  if v_session.turn_user_id <> auth.uid() then
    perform public.partyplay_game_error('NOT_YOUR_TURN');
  end if;
  if v_session.version <> p_expected_version then
    perform public.partyplay_game_error('CONFLICT');
  end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'revealed' then
    perform public.partyplay_game_error('CARD_NOT_REVEALED');
  end if;

  select array_agg(value::uuid) into v_players
  from jsonb_array_elements_text(v_session.state -> 'cycle_player_ids') as value;
  v_cycle_index := coalesce((v_session.state ->> 'cycle_index')::integer, 0) + 1;
  if v_cycle_index >= coalesce(array_length(v_players, 1), 0) then
    v_players := public.partyplay_truth_dare_random_cycle(v_session.room_id);
    v_cycle_index := 0;
  end if;
  v_next_user := v_players[v_cycle_index + 1];

  v_state := jsonb_set(v_session.state, '{phase}', '"choosing"'::jsonb, false);
  v_state := jsonb_set(v_state, '{cycle_player_ids}', to_jsonb(v_players), false);
  v_state := jsonb_set(v_state, '{cycle_index}', to_jsonb(v_cycle_index), false);
  v_state := jsonb_set(v_state, '{selected}', 'null'::jsonb, false);

  update public.pp_game_sessions
  set state = v_state, turn_user_id = v_next_user, round_no = round_no + 1, version = version + 1
  where id = v_session.id
  returning * into v_session;

  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'truth_dare_next_turn',
    jsonb_build_object('round_no', v_session.round_no, 'turn_user_id', v_next_user), p_command_id);

  return public.partyplay_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_finish_truth_dare(
  p_session_id uuid,
  p_expected_version integer,
  p_command_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_room public.pp_rooms;
  v_state jsonb;
  v_closes_at timestamptz := now() + interval '2 minutes';
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then
    perform public.partyplay_game_error('SESSION_NOT_FOUND');
  end if;
  if p_command_id is not null and exists (
    select 1 from public.pp_game_events where session_id = v_session.id and client_command_id = p_command_id
  ) then
    return public.partyplay_session_payload(v_session);
  end if;
  select * into v_room from public.pp_rooms where id = v_session.room_id;
  if v_room.host_id <> auth.uid() then
    perform public.partyplay_game_error('NOT_HOST');
  end if;
  if v_session.game_type <> 'truth_or_dare' or v_session.status <> 'running' then
    perform public.partyplay_game_error('GAME_NOT_ACTIVE');
  end if;
  if v_session.version <> p_expected_version then
    perform public.partyplay_game_error('CONFLICT');
  end if;

  v_state := jsonb_set(v_session.state, '{phase}', '"finished"'::jsonb, false);
  v_state := jsonb_set(v_state, '{chat_closes_at}', to_jsonb(v_closes_at), false);
  update public.pp_game_sessions
  set state = v_state, status = 'finished', turn_user_id = null, version = version + 1, finished_at = now()
  where id = v_session.id
  returning * into v_session;
  update public.pp_rooms set status = 'finished', finished_at = now() where id = v_room.id;

  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'truth_dare_finished',
    jsonb_build_object('chat_closes_at', v_closes_at), p_command_id);

  return public.partyplay_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_send_truth_dare_message(
  p_session_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_body text := btrim(coalesce(p_body, ''));
  v_message public.pp_room_messages;
  v_chat_closes_at timestamptz;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 600 then
    perform public.partyplay_game_error('INVALID_MESSAGE');
  end if;

  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then
    perform public.partyplay_game_error('SESSION_NOT_FOUND');
  end if;
  if v_session.game_type <> 'truth_or_dare' then
    perform public.partyplay_game_error('INVALID_GAME');
  end if;
  if not exists (
    select 1 from public.pp_room_members
    where room_id = v_session.room_id and user_id = auth.uid() and role in ('host', 'player')
  ) then
    perform public.partyplay_game_error('NOT_A_MEMBER');
  end if;

  if v_session.status = 'running' then
    if exists (
      select 1 from public.pp_room_messages
      where session_id = v_session.id and round_no = v_session.round_no and sender_id = auth.uid()
    ) then
      perform public.partyplay_game_error('CHAT_LIMIT_REACHED');
    end if;
  elsif v_session.status = 'finished' then
    v_chat_closes_at := nullif(v_session.state ->> 'chat_closes_at', '')::timestamptz;
    if v_chat_closes_at is null or now() >= v_chat_closes_at then
      perform public.partyplay_game_error('CHAT_CLOSED');
    end if;
  else
    perform public.partyplay_game_error('CHAT_CLOSED');
  end if;

  insert into public.pp_room_messages (room_id, sender_id, session_id, round_no, body)
  values (v_session.room_id, auth.uid(), v_session.id, v_session.round_no, v_body)
  returning * into v_message;

  return jsonb_build_object('id', v_message.id, 'created_at', v_message.created_at);
end;
$$;

create or replace function public.partyplay_toggle_message_reaction(
  p_message_id bigint,
  p_reaction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.pp_room_messages;
  v_session public.pp_game_sessions;
  v_existing text;
  v_chat_closes_at timestamptz;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;
  if p_reaction not in ('😂', '🔥', '👏', '😮') then
    perform public.partyplay_game_error('INVALID_REACTION');
  end if;

  select * into v_message from public.pp_room_messages where id = p_message_id for update;
  if not found then
    perform public.partyplay_game_error('MESSAGE_NOT_FOUND');
  end if;
  if not exists (
    select 1 from public.pp_room_members where room_id = v_message.room_id and user_id = auth.uid()
  ) then
    perform public.partyplay_game_error('NOT_A_MEMBER');
  end if;
  if v_message.session_id is not null then
    select * into v_session from public.pp_game_sessions where id = v_message.session_id;
    if v_session.game_type = 'truth_or_dare' and v_session.status = 'finished' then
      v_chat_closes_at := nullif(v_session.state ->> 'chat_closes_at', '')::timestamptz;
      if v_chat_closes_at is null or now() >= v_chat_closes_at then
        perform public.partyplay_game_error('CHAT_CLOSED');
      end if;
    end if;
  end if;

  select reaction into v_existing from public.pp_room_message_reactions
  where message_id = v_message.id and user_id = auth.uid();
  if v_existing = p_reaction then
    delete from public.pp_room_message_reactions where message_id = v_message.id and user_id = auth.uid();
  elsif v_existing is not null then
    update public.pp_room_message_reactions
    set reaction = p_reaction
    where message_id = v_message.id and user_id = auth.uid();
  else
    insert into public.pp_room_message_reactions (message_id, user_id, reaction)
    values (v_message.id, auth.uid(), p_reaction);
  end if;

  return jsonb_build_object('message_id', v_message.id);
end;
$$;

alter table public.pp_room_message_reactions replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pp_room_message_reactions'
  ) then
    alter publication supabase_realtime add table public.pp_room_message_reactions;
  end if;
end;
$$;

revoke all on function public.partyplay_start_truth_dare(uuid) from public;
revoke all on function public.partyplay_truth_dare_choose(uuid, text, integer, uuid) from public;
revoke all on function public.partyplay_truth_dare_next_turn(uuid, integer, uuid) from public;
revoke all on function public.partyplay_finish_truth_dare(uuid, integer, uuid) from public;
revoke all on function public.partyplay_send_truth_dare_message(uuid, text) from public;
revoke all on function public.partyplay_toggle_message_reaction(bigint, text) from public;

grant execute on function public.partyplay_start_truth_dare(uuid) to authenticated;
grant execute on function public.partyplay_truth_dare_choose(uuid, text, integer, uuid) to authenticated;
grant execute on function public.partyplay_truth_dare_next_turn(uuid, integer, uuid) to authenticated;
grant execute on function public.partyplay_finish_truth_dare(uuid, integer, uuid) to authenticated;
grant execute on function public.partyplay_send_truth_dare_message(uuid, text) to authenticated;
grant execute on function public.partyplay_toggle_message_reaction(bigint, text) to authenticated;
