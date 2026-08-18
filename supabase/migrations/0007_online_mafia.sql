-- PartyPlay online Mafia: server-authoritative roles, day/night phases, voting and private mafia channel.

create table if not exists public.pp_mafia_players (
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  user_id uuid not null references public.pp_profiles(id) on delete cascade,
  role text not null check (role in ('godfather', 'mafia', 'doctor', 'detective', 'citizen')),
  faction text not null check (faction in ('mafia', 'city')),
  is_alive boolean not null default true,
  role_acknowledged boolean not null default false,
  doctor_self_save_used boolean not null default false,
  godfather_checks integer not null default 0 check (godfather_checks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.pp_mafia_votes (
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  day_no integer not null check (day_no >= 2),
  voter_id uuid not null references public.pp_profiles(id) on delete cascade,
  choice text not null check (choice in ('player', 'nobody')),
  target_user_id uuid references public.pp_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, day_no, voter_id),
  check ((choice = 'nobody' and target_user_id is null) or (choice = 'player' and target_user_id is not null))
);

create table if not exists public.pp_mafia_night_actions (
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  day_no integer not null check (day_no >= 1),
  actor_id uuid not null references public.pp_profiles(id) on delete cascade,
  action_type text not null check (action_type in ('mafia_target', 'doctor_save', 'detective_check')),
  target_user_id uuid references public.pp_profiles(id) on delete cascade,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, day_no, actor_id, action_type)
);

create table if not exists public.pp_mafia_team_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  day_no integer not null check (day_no >= 1),
  sender_id uuid not null references public.pp_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now(),
  unique (session_id, day_no, sender_id)
);

create table if not exists public.pp_mafia_speaker_reactions (
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  day_no integer not null check (day_no >= 1),
  speaker_id uuid not null references public.pp_profiles(id) on delete cascade,
  reactor_id uuid not null references public.pp_profiles(id) on delete cascade,
  reaction text not null check (reaction in ('up', 'down', 'challenge')),
  created_at timestamptz not null default now(),
  primary key (session_id, day_no, speaker_id, reactor_id, reaction),
  check (speaker_id <> reactor_id)
);

create index if not exists pp_mafia_players_session_alive_idx on public.pp_mafia_players(session_id, is_alive);
create index if not exists pp_mafia_votes_session_day_idx on public.pp_mafia_votes(session_id, day_no);
create index if not exists pp_mafia_actions_session_day_idx on public.pp_mafia_night_actions(session_id, day_no);
create index if not exists pp_mafia_messages_session_day_idx on public.pp_mafia_team_messages(session_id, day_no, created_at);

create trigger pp_mafia_players_updated_at before update on public.pp_mafia_players
for each row execute procedure public.partyplay_set_updated_at();
create trigger pp_mafia_votes_updated_at before update on public.pp_mafia_votes
for each row execute procedure public.partyplay_set_updated_at();
create trigger pp_mafia_night_actions_updated_at before update on public.pp_mafia_night_actions
for each row execute procedure public.partyplay_set_updated_at();

alter table public.pp_mafia_players enable row level security;
alter table public.pp_mafia_votes enable row level security;
alter table public.pp_mafia_night_actions enable row level security;
alter table public.pp_mafia_team_messages enable row level security;
alter table public.pp_mafia_speaker_reactions enable row level security;

-- A player can see their own card. Mafia teammates can see each other for the whole game;
-- no browser receives a city player's role through this table.
create policy "pp_mafia_players_private_roles" on public.pp_mafia_players
for select to authenticated using (
  user_id = auth.uid() or (
    faction = 'mafia' and exists (
      select 1 from public.pp_mafia_players own
      where own.session_id = pp_mafia_players.session_id
        and own.user_id = auth.uid()
        and own.faction = 'mafia'
    )
  )
);

create policy "pp_mafia_team_messages_private" on public.pp_mafia_team_messages
for select to authenticated using (exists (
  select 1 from public.pp_mafia_players actor
  where actor.session_id = pp_mafia_team_messages.session_id
    and actor.user_id = auth.uid()
    and actor.faction = 'mafia'
    and actor.is_alive
));

create policy "pp_mafia_reactions_visible_to_room" on public.pp_mafia_speaker_reactions
for select to authenticated using (exists (
  select 1 from public.pp_game_sessions session
  join public.pp_room_members member on member.room_id = session.room_id
  where session.id = pp_mafia_speaker_reactions.session_id and member.user_id = auth.uid()
));

create or replace function public.partyplay_mafia_error(p_code text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.partyplay_game_error(p_code);
end;
$$;

create or replace function public.partyplay_mafia_session_payload(p_session public.pp_game_sessions)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select public.partyplay_session_payload(p_session);
$$;

create or replace function public.partyplay_mafia_winner(p_session_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mafia_count integer;
  v_citizen_count integer;
begin
  select count(*) filter (where is_alive and faction = 'mafia'),
         count(*) filter (where is_alive and role = 'citizen')
  into v_mafia_count, v_citizen_count
  from public.pp_mafia_players where session_id = p_session_id;

  if coalesce(v_mafia_count, 0) = 0 then return 'city'; end if;
  if coalesce(v_citizen_count, 0) = 0 then return 'mafia'; end if;
  return null;
end;
$$;

create or replace function public.partyplay_mafia_alive_cycle(p_session_id uuid)
returns uuid[]
language sql
volatile
security definer
set search_path = public
as $$
  select array_agg(user_id order by random())
  from public.pp_mafia_players
  where session_id = p_session_id and is_alive;
$$;

create or replace function public.partyplay_start_mafia(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.pp_rooms;
  v_session public.pp_game_sessions;
  v_players uuid[];
  v_roles text[];
  v_state jsonb;
  v_round integer := 1;
  v_player_count integer;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_room from public.pp_rooms where id = p_room_id for update;
  if not found then perform public.partyplay_mafia_error('ROOM_NOT_FOUND'); end if;
  if v_room.host_id <> auth.uid() then perform public.partyplay_mafia_error('NOT_HOST'); end if;
  if v_room.game_type <> 'mafia' then perform public.partyplay_mafia_error('INVALID_GAME'); end if;
  if v_room.capacity not in (5, 7, 9) then perform public.partyplay_mafia_error('NEED_EXACT_CAPACITY'); end if;

  select array_agg(user_id order by random()), count(*) into v_players, v_player_count
  from public.pp_room_members where room_id = v_room.id and role in ('host', 'player');
  if v_player_count <> v_room.capacity then perform public.partyplay_mafia_error('NEED_EXACT_CAPACITY'); end if;

  v_roles := case v_player_count
    when 5 then array['godfather', 'mafia', 'doctor', 'detective', 'citizen']
    when 7 then array['godfather', 'mafia', 'mafia', 'doctor', 'detective', 'citizen', 'citizen']
    when 9 then array['godfather', 'mafia', 'mafia', 'mafia', 'doctor', 'detective', 'citizen', 'citizen', 'citizen']
  end;

  select * into v_session from public.pp_game_sessions where room_id = v_room.id for update;
  if found and v_session.status = 'running' then return public.partyplay_mafia_session_payload(v_session); end if;
  if found then
    v_round := v_session.round_no + 1;
    delete from public.pp_mafia_players where session_id = v_session.id;
  end if;

  if found then
    update public.pp_game_sessions
    set game_type = 'mafia', status = 'running', round_no = v_round, turn_user_id = null,
        winner_id = null, version = 0, finished_at = null,
        state = jsonb_build_object('phase', 'role_reveal', 'day_no', 0, 'alive_player_ids', to_jsonb(v_players),
          'speaker_order', '[]'::jsonb, 'speaker_index', 0, 'speaker_user_id', null,
          'speaker_mode', null, 'speaker_deadline_at', null, 'voting_deadline_at', null,
          'narration', 'کارت نقش خودت را باز کن و برای ورود به بازی آماده شو.', 'winner_faction', null)
    where id = v_session.id returning * into v_session;
  else
    insert into public.pp_game_sessions (room_id, game_type, round_no, status, state, version)
    values (v_room.id, 'mafia', v_round, 'running',
      jsonb_build_object('phase', 'role_reveal', 'day_no', 0, 'alive_player_ids', to_jsonb(v_players),
        'speaker_order', '[]'::jsonb, 'speaker_index', 0, 'speaker_user_id', null,
        'speaker_mode', null, 'speaker_deadline_at', null, 'voting_deadline_at', null,
        'narration', 'کارت نقش خودت را باز کن و برای ورود به بازی آماده شو.', 'winner_faction', null), 0)
    returning * into v_session;
  end if;

  insert into public.pp_mafia_players (session_id, user_id, role, faction)
  select v_session.id, v_players[position], v_roles[position],
    case when v_roles[position] in ('godfather', 'mafia') then 'mafia' else 'city' end
  from generate_subscripts(v_roles, 1) as position;

  update public.pp_rooms set status = 'playing', started_at = now(), finished_at = null where id = v_room.id;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_started', jsonb_build_object('capacity', v_player_count))
  on conflict (session_id, sequence_no) do nothing;
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_mafia_ack_role(p_session_id uuid, p_expected_version integer, p_command_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pp_game_sessions;
  v_state jsonb;
  v_speakers uuid[];
  v_all_ready boolean;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if v_session.game_type <> 'mafia' or v_session.status <> 'running' then perform public.partyplay_mafia_error('GAME_NOT_ACTIVE'); end if;
  if v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'role_reveal' then perform public.partyplay_mafia_error('ROLE_NOT_READY'); end if;
  if not exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid()) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;

  update public.pp_mafia_players set role_acknowledged = true where session_id = v_session.id and user_id = auth.uid();
  select bool_and(role_acknowledged) into v_all_ready from public.pp_mafia_players where session_id = v_session.id;
  if v_all_ready then
    v_speakers := public.partyplay_mafia_alive_cycle(v_session.id);
    v_state := jsonb_build_object('phase', 'day_speaking', 'day_no', 1, 'alive_player_ids', v_session.state -> 'alive_player_ids',
      'speaker_order', to_jsonb(v_speakers), 'speaker_index', 0, 'speaker_user_id', v_speakers[1], 'speaker_mode', null,
      'speaker_deadline_at', to_jsonb(now() + interval '3 minutes'), 'voting_deadline_at', null,
      'narration', 'روز اول است؛ معارفه آغاز شد. رأی‌گیری امروز نداریم.', 'winner_faction', null);
    update public.pp_game_sessions set state = v_state, turn_user_id = v_speakers[1], version = version + 1
    where id = v_session.id returning * into v_session;
  else
    update public.pp_game_sessions set version = version + 1 where id = v_session.id returning * into v_session;
  end if;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_role_acknowledged', '{}'::jsonb, p_command_id);
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_mafia_set_speaking(p_session_id uuid, p_mode text, p_expected_version integer, p_command_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_state jsonb;
begin
  if p_mode not in ('talking', 'passed') then perform public.partyplay_mafia_error('INVALID_CHOICE'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'day_speaking' then perform public.partyplay_mafia_error('NOT_SPEAKER'); end if;
  if v_session.turn_user_id <> auth.uid() then perform public.partyplay_mafia_error('NOT_SPEAKER'); end if;
  if now() >= nullif(v_session.state ->> 'speaker_deadline_at', '')::timestamptz then perform public.partyplay_mafia_error('SPEAKER_WINDOW_CLOSED'); end if;
  v_state := jsonb_set(v_session.state, '{speaker_mode}', to_jsonb(p_mode), false);
  update public.pp_game_sessions set state = v_state, version = version + 1 where id = v_session.id returning * into v_session;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_speaker_mode', jsonb_build_object('mode', p_mode), p_command_id);
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_mafia_send_day_message(p_session_id uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_body text := btrim(coalesce(p_body, '')); v_message public.pp_room_messages;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 600 then perform public.partyplay_mafia_error('INVALID_MESSAGE'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'day_speaking' or v_session.turn_user_id <> auth.uid() or coalesce(v_session.state ->> 'speaker_mode', '') <> 'talking' then perform public.partyplay_mafia_error('NOT_SPEAKER'); end if;
  if now() >= nullif(v_session.state ->> 'speaker_deadline_at', '')::timestamptz then perform public.partyplay_mafia_error('SPEAKER_WINDOW_CLOSED'); end if;
  if not exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid() and is_alive) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  insert into public.pp_room_messages (room_id, sender_id, session_id, round_no, body) values (v_session.room_id, auth.uid(), v_session.id, (v_session.state ->> 'day_no')::integer, v_body) returning * into v_message;
  return jsonb_build_object('id', v_message.id, 'created_at', v_message.created_at);
end;
$$;

create or replace function public.partyplay_mafia_react(p_session_id uuid, p_reaction text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_speaker uuid;
begin
  if p_reaction not in ('up', 'down', 'challenge') then perform public.partyplay_mafia_error('INVALID_REACTION'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'day_speaking' then perform public.partyplay_mafia_error('NOT_SPEAKER'); end if;
  if not exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid() and is_alive) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  v_speaker := v_session.turn_user_id;
  if v_speaker is null or v_speaker = auth.uid() then perform public.partyplay_mafia_error('NOT_SPEAKER'); end if;
  insert into public.pp_mafia_speaker_reactions (session_id, day_no, speaker_id, reactor_id, reaction)
  values (v_session.id, (v_session.state ->> 'day_no')::integer, v_speaker, auth.uid(), p_reaction)
  on conflict do nothing;
  return jsonb_build_object('speaker_id', v_speaker);
end;
$$;

create or replace function public.partyplay_mafia_next_speaker(p_session_id uuid, p_expected_version integer, p_command_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_state jsonb; v_speakers uuid[]; v_index integer; v_day integer; v_next uuid; v_all_done boolean;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if not exists (select 1 from public.pp_room_members where room_id = v_session.room_id and user_id = auth.uid()) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  if v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'day_speaking' then perform public.partyplay_mafia_error('NOT_SPEAKER'); end if;
  if auth.uid() <> v_session.turn_user_id and now() < nullif(v_session.state ->> 'speaker_deadline_at', '')::timestamptz then perform public.partyplay_mafia_error('NOT_SPEAKER'); end if;
  select array_agg(value::uuid) into v_speakers from jsonb_array_elements_text(v_session.state -> 'speaker_order') as value;
  v_day := (v_session.state ->> 'day_no')::integer;
  v_index := coalesce((v_session.state ->> 'speaker_index')::integer, 0) + 1;
  v_all_done := v_index >= coalesce(array_length(v_speakers, 1), 0);
  if v_all_done and v_day = 1 then
    v_state := jsonb_set(v_session.state, '{phase}', '"night_intro"'::jsonb, false);
    v_state := jsonb_set(v_state, '{speaker_user_id}', 'null'::jsonb, false);
    v_state := jsonb_set(v_state, '{speaker_deadline_at}', 'null'::jsonb, false);
    v_state := jsonb_set(v_state, '{narration}', '"شب اول فرا رسید؛ شهر به خواب می‌رود."'::jsonb, false);
    update public.pp_game_sessions set state = v_state, turn_user_id = null, version = version + 1 where id = v_session.id returning * into v_session;
  elsif v_all_done then
    v_state := jsonb_set(v_session.state, '{phase}', '"voting"'::jsonb, false);
    v_state := jsonb_set(v_state, '{speaker_user_id}', 'null'::jsonb, false);
    v_state := jsonb_set(v_state, '{voting_deadline_at}', to_jsonb(now() + interval '60 seconds'), false);
    v_state := jsonb_set(v_state, '{narration}', '"وقت رأی‌گیری مخفی است."'::jsonb, false);
    update public.pp_game_sessions set state = v_state, turn_user_id = null, version = version + 1 where id = v_session.id returning * into v_session;
  else
    v_next := v_speakers[v_index + 1];
    v_state := jsonb_set(v_session.state, '{speaker_index}', to_jsonb(v_index), false);
    v_state := jsonb_set(v_state, '{speaker_user_id}', to_jsonb(v_next), false);
    v_state := jsonb_set(v_state, '{speaker_mode}', 'null'::jsonb, false);
    v_state := jsonb_set(v_state, '{speaker_deadline_at}', to_jsonb(now() + interval '3 minutes'), false);
    update public.pp_game_sessions set state = v_state, turn_user_id = v_next, version = version + 1 where id = v_session.id returning * into v_session;
  end if;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_speaker_advanced', jsonb_build_object('day_no', v_day), p_command_id);
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_mafia_vote(p_session_id uuid, p_choice text, p_target_user_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_day integer;
begin
  if p_choice not in ('player', 'nobody') then perform public.partyplay_mafia_error('INVALID_CHOICE'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'voting' then perform public.partyplay_mafia_error('VOTING_NOT_OPEN'); end if;
  if now() >= nullif(v_session.state ->> 'voting_deadline_at', '')::timestamptz then perform public.partyplay_mafia_error('VOTING_NOT_OPEN'); end if;
  if not exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid() and is_alive) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  if p_choice = 'player' and p_target_user_id = auth.uid() then perform public.partyplay_mafia_error('SELF_VOTE'); end if;
  if p_choice = 'player' and not exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = p_target_user_id and is_alive) then perform public.partyplay_mafia_error('INVALID_CHOICE'); end if;
  v_day := (v_session.state ->> 'day_no')::integer;
  insert into public.pp_mafia_votes (session_id, day_no, voter_id, choice, target_user_id)
  values (v_session.id, v_day, auth.uid(), p_choice, case when p_choice = 'player' then p_target_user_id else null end)
  on conflict (session_id, day_no, voter_id) do update set choice = excluded.choice, target_user_id = excluded.target_user_id, updated_at = now();
  return jsonb_build_object('day_no', v_day);
end;
$$;

create or replace function public.partyplay_mafia_open_night(p_session_id uuid, p_expected_version integer, p_command_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_state jsonb;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if not exists (select 1 from public.pp_room_members where room_id = v_session.room_id and user_id = auth.uid()) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  if v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'night_intro' then perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
  v_state := jsonb_set(v_session.state, '{phase}', '"mafia_action"'::jsonb, false);
  v_state := jsonb_set(v_state, '{narration}', '"مافیا بیدار می‌شود…"'::jsonb, false);
  update public.pp_game_sessions set state = v_state, version = version + 1 where id = v_session.id returning * into v_session;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_night_opened', '{}'::jsonb, p_command_id);
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_mafia_send_team_message(p_session_id uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_body text := btrim(coalesce(p_body, '')); v_day integer; v_message public.pp_mafia_team_messages;
begin
  if char_length(v_body) < 1 or char_length(v_body) > 140 then perform public.partyplay_mafia_error('INVALID_MESSAGE'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'mafia_action' then perform public.partyplay_mafia_error('PRIVATE_CHANNEL_FORBIDDEN'); end if;
  if not exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid() and faction = 'mafia' and is_alive) then perform public.partyplay_mafia_error('PRIVATE_CHANNEL_FORBIDDEN'); end if;
  v_day := greatest(1, (v_session.state ->> 'day_no')::integer);
  insert into public.pp_mafia_team_messages (session_id, day_no, sender_id, body) values (v_session.id, v_day, auth.uid(), v_body) returning * into v_message;
  return jsonb_build_object('id', v_message.id, 'created_at', v_message.created_at);
end;
$$;

create or replace function public.partyplay_mafia_submit_night_action(p_session_id uuid, p_target_user_id uuid default null, p_expected_version integer default null, p_command_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_role text; v_phase text; v_action text; v_day integer; v_result text; v_target_role text;
begin
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if p_expected_version is not null and v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;
  v_phase := coalesce(v_session.state ->> 'phase', '');
  select role into v_role from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid() and is_alive;
  if v_role is null then perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
  if (v_phase = 'mafia_action' and v_role in ('godfather', 'mafia')) then v_action := 'mafia_target';
  elsif (v_phase = 'doctor_action' and v_role = 'doctor') then v_action := 'doctor_save';
  elsif (v_phase = 'detective_action' and v_role = 'detective') then v_action := 'detective_check';
  else perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
  if p_target_user_id is not null and not exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = p_target_user_id and is_alive) then perform public.partyplay_mafia_error('INVALID_CHOICE'); end if;
  if v_action = 'mafia_target' and p_target_user_id is not null and exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = p_target_user_id and faction = 'mafia') then perform public.partyplay_mafia_error('INVALID_CHOICE'); end if;
  if v_action = 'detective_check' and p_target_user_id = auth.uid() then perform public.partyplay_mafia_error('INVALID_CHOICE'); end if;
  if v_action = 'doctor_save' and p_target_user_id = auth.uid() then
    if exists (select 1 from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid() and doctor_self_save_used) then perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
    update public.pp_mafia_players set doctor_self_save_used = true where session_id = v_session.id and user_id = auth.uid();
  end if;
  v_day := greatest(1, (v_session.state ->> 'day_no')::integer);
  if v_action = 'detective_check' and p_target_user_id is not null then
    select role into v_target_role from public.pp_mafia_players where session_id = v_session.id and user_id = p_target_user_id;
    if v_target_role = 'godfather' then
      update public.pp_mafia_players set godfather_checks = godfather_checks + 1 where session_id = v_session.id and user_id = auth.uid() returning case when godfather_checks = 1 then 'citizen' else 'godfather' end into v_result;
    elsif v_target_role in ('mafia') then v_result := 'mafia'; else v_result := 'citizen'; end if;
  end if;
  insert into public.pp_mafia_night_actions (session_id, day_no, actor_id, action_type, target_user_id, result)
  values (v_session.id, v_day, auth.uid(), v_action, p_target_user_id, v_result)
  on conflict (session_id, day_no, actor_id, action_type) do update set target_user_id = excluded.target_user_id, result = excluded.result, updated_at = now();
  update public.pp_game_sessions set version = version + 1 where id = v_session.id returning * into v_session;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_night_action', jsonb_build_object('phase', v_phase), p_command_id);
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

-- Move the night forward only after every living actor in the current role class submitted an action or passed.
create or replace function public.partyplay_mafia_advance_night(p_session_id uuid, p_expected_version integer, p_command_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_phase text; v_day integer; v_missing integer; v_state jsonb; v_target uuid; v_doctor_target uuid; v_winner text; v_alive uuid[]; v_speakers uuid[];
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if not exists (select 1 from public.pp_room_members where room_id = v_session.room_id and user_id = auth.uid()) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  if v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;
  v_phase := coalesce(v_session.state ->> 'phase', ''); v_day := greatest(1, (v_session.state ->> 'day_no')::integer);
  if v_phase = 'mafia_action' then
    select count(*) into v_missing from public.pp_mafia_players player
    where player.session_id = v_session.id and player.is_alive and player.role in ('godfather', 'mafia')
      and not exists (select 1 from public.pp_mafia_night_actions action where action.session_id = v_session.id and action.day_no = v_day and action.actor_id = player.user_id and action.action_type = 'mafia_target');
    if v_missing > 0 then perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
    if exists (select 1 from public.pp_mafia_players where session_id = v_session.id and role = 'doctor' and is_alive) then
      v_state := jsonb_set(v_session.state, '{phase}', '"doctor_action"'::jsonb, false);
      v_state := jsonb_set(v_state, '{narration}', '"دکتر بیدار می‌شود…"'::jsonb, false);
    elsif exists (select 1 from public.pp_mafia_players where session_id = v_session.id and role = 'detective' and is_alive) then
      v_state := jsonb_set(v_session.state, '{phase}', '"detective_action"'::jsonb, false);
      v_state := jsonb_set(v_state, '{narration}', '"کارآگاه بیدار می‌شود…"'::jsonb, false);
    else
      v_state := jsonb_set(v_session.state, '{phase}', '"morning_reveal"'::jsonb, false);
    end if;
    update public.pp_game_sessions set state = v_state, version = version + 1 where id = v_session.id returning * into v_session;
  elsif v_phase = 'doctor_action' then
    if not exists (select 1 from public.pp_mafia_night_actions where session_id = v_session.id and day_no = v_day and action_type = 'doctor_save') then perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
    if exists (select 1 from public.pp_mafia_players where session_id = v_session.id and role = 'detective' and is_alive) then
      v_state := jsonb_set(v_session.state, '{phase}', '"detective_action"'::jsonb, false);
      v_state := jsonb_set(v_state, '{narration}', '"کارآگاه بیدار می‌شود…"'::jsonb, false);
    else v_state := jsonb_set(v_session.state, '{phase}', '"morning_reveal"'::jsonb, false); end if;
    update public.pp_game_sessions set state = v_state, version = version + 1 where id = v_session.id returning * into v_session;
  elsif v_phase in ('detective_action', 'morning_reveal') then
    if v_phase = 'detective_action' and not exists (select 1 from public.pp_mafia_night_actions where session_id = v_session.id and day_no = v_day and action_type = 'detective_check') then perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
    -- Godfather's target wins conflicts. Without a Godfather target, unanimous normal-mafia target is used.
    select target_user_id into v_target from public.pp_mafia_night_actions action join public.pp_mafia_players player on player.session_id = action.session_id and player.user_id = action.actor_id
    where action.session_id = v_session.id and action.day_no = v_day and action.action_type = 'mafia_target' and player.role = 'godfather';
    if v_target is null then
      select action.target_user_id into v_target
      from public.pp_mafia_night_actions action
      where action.session_id = v_session.id and action.day_no = v_day and action.action_type = 'mafia_target' and action.target_user_id is not null
      group by action.target_user_id
      having count(*) = (select count(*) from public.pp_mafia_night_actions all_actions where all_actions.session_id = v_session.id and all_actions.day_no = v_day and all_actions.action_type = 'mafia_target' and all_actions.target_user_id is not null)
      limit 1;
    end if;
    select target_user_id into v_doctor_target from public.pp_mafia_night_actions where session_id = v_session.id and day_no = v_day and action_type = 'doctor_save';
    if v_target is not null and v_target is distinct from v_doctor_target then update public.pp_mafia_players set is_alive = false where session_id = v_session.id and user_id = v_target; end if;
    select array_agg(user_id) into v_alive from public.pp_mafia_players where session_id = v_session.id and is_alive;
    v_winner := public.partyplay_mafia_winner(v_session.id);
    if v_winner is not null then
      v_state := jsonb_set(v_session.state, '{phase}', '"finished"'::jsonb, false);
      v_state := jsonb_set(v_state, '{winner_faction}', to_jsonb(v_winner), false);
      v_state := jsonb_set(v_state, '{alive_player_ids}', to_jsonb(v_alive), false);
      v_state := jsonb_set(v_state, '{narration}', to_jsonb(case when v_winner = 'city' then 'شهر پیروز شد؛ تمام مافیاها شناسایی شدند.' else 'مافیا پیروز شد؛ شهروند ساده‌ای باقی نمانده است.' end), false);
      update public.pp_game_sessions set state = v_state, status = 'finished', winner_id = null, version = version + 1, finished_at = now() where id = v_session.id returning * into v_session;
      update public.pp_rooms set status = 'finished', finished_at = now() where id = v_session.room_id;
    else
      v_speakers := public.partyplay_mafia_alive_cycle(v_session.id);
      v_state := jsonb_build_object('phase', 'day_speaking', 'day_no', v_day + 1, 'alive_player_ids', to_jsonb(v_alive), 'speaker_order', to_jsonb(v_speakers), 'speaker_index', 0, 'speaker_user_id', v_speakers[1], 'speaker_mode', null, 'speaker_deadline_at', to_jsonb(now() + interval '3 minutes'), 'voting_deadline_at', null, 'narration', case when v_target is null then 'صبح شد؛ شهر آرام بود.' when v_target = v_doctor_target then 'صبح شد؛ دکتر امشب کسی را نجات داد.' else 'صبح شد؛ یک بازیکن از شهر خداحافظی کرد.' end, 'winner_faction', null);
      update public.pp_game_sessions set state = v_state, turn_user_id = v_speakers[1], version = version + 1 where id = v_session.id returning * into v_session;
    end if;
  else perform public.partyplay_mafia_error('NIGHT_ACTION_NOT_ALLOWED'); end if;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_night_advanced', jsonb_build_object('phase', v_phase), p_command_id);
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_mafia_resolve_vote(p_session_id uuid, p_expected_version integer, p_command_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session public.pp_game_sessions; v_day integer; v_alive_count integer; v_vote_count integer; v_choice text; v_target uuid; v_tied boolean; v_state jsonb; v_winner text;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id for update;
  if not found then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if not exists (select 1 from public.pp_room_members where room_id = v_session.room_id and user_id = auth.uid()) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  if v_session.version <> p_expected_version then perform public.partyplay_mafia_error('CONFLICT'); end if;
  if coalesce(v_session.state ->> 'phase', '') <> 'voting' then perform public.partyplay_mafia_error('VOTING_NOT_OPEN'); end if;
  v_day := (v_session.state ->> 'day_no')::integer;
  select count(*) into v_alive_count from public.pp_mafia_players where session_id = v_session.id and is_alive;
  select count(*) into v_vote_count from public.pp_mafia_votes where session_id = v_session.id and day_no = v_day;
  if now() < nullif(v_session.state ->> 'voting_deadline_at', '')::timestamptz and v_vote_count < v_alive_count then perform public.partyplay_mafia_error('VOTING_NOT_OPEN'); end if;
  select choice, target_user_id, count(*) into v_choice, v_target, v_vote_count from public.pp_mafia_votes where session_id = v_session.id and day_no = v_day group by choice, target_user_id order by count(*) desc, choice asc limit 1;
  select exists(select 1 from (select count(*) as count from public.pp_mafia_votes where session_id = v_session.id and day_no = v_day group by choice, target_user_id order by count(*) desc limit 2) ranks where count = v_vote_count offset 1) into v_tied;
  if v_choice = 'player' and not coalesce(v_tied, false) then update public.pp_mafia_players set is_alive = false where session_id = v_session.id and user_id = v_target; else v_target := null; end if;
  v_winner := public.partyplay_mafia_winner(v_session.id);
  if v_winner is not null then
    v_state := jsonb_set(v_session.state, '{phase}', '"finished"'::jsonb, false);
    v_state := jsonb_set(v_state, '{winner_faction}', to_jsonb(v_winner), false);
    v_state := jsonb_set(v_state, '{narration}', to_jsonb(case when v_winner = 'city' then 'شهر پیروز شد؛ تمام مافیاها شناسایی شدند.' else 'مافیا پیروز شد؛ شهروند ساده‌ای باقی نمانده است.' end), false);
    update public.pp_game_sessions set state = v_state, status = 'finished', turn_user_id = null, version = version + 1, finished_at = now() where id = v_session.id returning * into v_session;
    update public.pp_rooms set status = 'finished', finished_at = now() where id = v_session.room_id;
  else
    v_state := jsonb_set(v_session.state, '{phase}', '"night_intro"'::jsonb, false);
    v_state := jsonb_set(v_state, '{speaker_user_id}', 'null'::jsonb, false);
    v_state := jsonb_set(v_state, '{narration}', to_jsonb(case when v_target is null then 'رأی شهر به کسی نرسید؛ شب فرا رسید.' else 'رأی شهر ثبت شد؛ نقش او همچنان مخفی است. شب فرا رسید.' end), false);
    update public.pp_game_sessions set state = v_state, turn_user_id = null, version = version + 1 where id = v_session.id returning * into v_session;
  end if;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload, client_command_id)
  values (v_session.id, auth.uid(), v_session.version, 'mafia_vote_resolved', jsonb_build_object('day_no', v_day, 'eliminated', v_target), p_command_id);
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

alter table public.pp_mafia_players replica identity full;
alter table public.pp_mafia_team_messages replica identity full;
alter table public.pp_mafia_speaker_reactions replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pp_mafia_players') then alter publication supabase_realtime add table public.pp_mafia_players; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pp_mafia_team_messages') then alter publication supabase_realtime add table public.pp_mafia_team_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pp_mafia_speaker_reactions') then alter publication supabase_realtime add table public.pp_mafia_speaker_reactions; end if;
end $$;

revoke all on function public.partyplay_start_mafia(uuid) from public;
revoke all on function public.partyplay_mafia_ack_role(uuid, integer, uuid) from public;
revoke all on function public.partyplay_mafia_set_speaking(uuid, text, integer, uuid) from public;
revoke all on function public.partyplay_mafia_send_day_message(uuid, text) from public;
revoke all on function public.partyplay_mafia_react(uuid, text) from public;
revoke all on function public.partyplay_mafia_next_speaker(uuid, integer, uuid) from public;
revoke all on function public.partyplay_mafia_vote(uuid, text, uuid) from public;
revoke all on function public.partyplay_mafia_resolve_vote(uuid, integer, uuid) from public;
revoke all on function public.partyplay_mafia_open_night(uuid, integer, uuid) from public;
revoke all on function public.partyplay_mafia_send_team_message(uuid, text) from public;
revoke all on function public.partyplay_mafia_submit_night_action(uuid, uuid, integer, uuid) from public;
revoke all on function public.partyplay_mafia_advance_night(uuid, integer, uuid) from public;

grant execute on function public.partyplay_start_mafia(uuid) to authenticated;
grant execute on function public.partyplay_mafia_ack_role(uuid, integer, uuid) to authenticated;
grant execute on function public.partyplay_mafia_set_speaking(uuid, text, integer, uuid) to authenticated;
grant execute on function public.partyplay_mafia_send_day_message(uuid, text) to authenticated;
grant execute on function public.partyplay_mafia_react(uuid, text) to authenticated;
grant execute on function public.partyplay_mafia_next_speaker(uuid, integer, uuid) to authenticated;
grant execute on function public.partyplay_mafia_vote(uuid, text, uuid) to authenticated;
grant execute on function public.partyplay_mafia_resolve_vote(uuid, integer, uuid) to authenticated;
grant execute on function public.partyplay_mafia_open_night(uuid, integer, uuid) to authenticated;
grant execute on function public.partyplay_mafia_send_team_message(uuid, text) to authenticated;
grant execute on function public.partyplay_mafia_submit_night_action(uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.partyplay_mafia_advance_night(uuid, integer, uuid) to authenticated;

-- Private view is deliberately RPC-only: it never exposes city roles or hidden votes.
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
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_session from public.pp_game_sessions where id = p_session_id;
  if not found or v_session.game_type <> 'mafia' then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  if not exists (select 1 from public.pp_room_members where room_id = v_session.room_id and user_id = auth.uid()) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  select * into v_self from public.pp_mafia_players where session_id = v_session.id and user_id = auth.uid();
  if not found then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  v_day := greatest(1, coalesce((v_session.state ->> 'day_no')::integer, 1));
  return jsonb_build_object(
    'self', jsonb_build_object('role', v_self.role, 'faction', v_self.faction, 'is_alive', v_self.is_alive, 'role_acknowledged', v_self.role_acknowledged, 'doctor_self_save_used', v_self.doctor_self_save_used),
    'teammates', case when v_self.faction = 'mafia' then coalesce((select jsonb_agg(jsonb_build_object('user_id', player.user_id, 'display_name', profile.display_name, 'role', player.role, 'is_alive', player.is_alive) order by profile.display_name)
      from public.pp_mafia_players player join public.pp_profiles profile on profile.id = player.user_id
      where player.session_id = v_session.id and player.faction = 'mafia'), '[]'::jsonb) else '[]'::jsonb end,
    'detective_result', case when v_self.role = 'detective' then (select result from public.pp_mafia_night_actions where session_id = v_session.id and day_no = v_day and actor_id = auth.uid() and action_type = 'detective_check') else null end
  );
end;
$$;

drop policy if exists "pp_mafia_team_messages_private" on public.pp_mafia_team_messages;
create policy "pp_mafia_team_messages_private" on public.pp_mafia_team_messages
for select to authenticated using (exists (
  select 1 from public.pp_mafia_players actor
  where actor.session_id = pp_mafia_team_messages.session_id
    and actor.user_id = auth.uid()
    and actor.faction = 'mafia'
));

revoke all on function public.partyplay_load_mafia_private_view(uuid) from public;
grant execute on function public.partyplay_load_mafia_private_view(uuid) to authenticated;

-- Avoid a self-referential RLS subquery: resolve the viewer's mafia membership in a definer helper.
create or replace function public.partyplay_is_mafia_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pp_mafia_players
    where session_id = p_session_id and user_id = auth.uid() and faction = 'mafia'
  );
$$;

revoke all on function public.partyplay_is_mafia_member(uuid) from public;
grant execute on function public.partyplay_is_mafia_member(uuid) to authenticated;

drop policy if exists "pp_mafia_players_private_roles" on public.pp_mafia_players;
create policy "pp_mafia_players_private_roles" on public.pp_mafia_players
for select to authenticated using (
  user_id = auth.uid() or (faction = 'mafia' and public.partyplay_is_mafia_member(session_id))
);
