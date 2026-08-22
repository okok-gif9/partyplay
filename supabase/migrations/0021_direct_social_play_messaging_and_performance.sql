-- PartyPlay: direct friend play, private friend messages, localized account preferences, and filterable realtime records.
-- All writes to invitations and direct messages flow through SECURITY DEFINER RPCs.

begin;

alter table public.pp_profiles
  add column if not exists preferred_locale text not null default 'en'
  check (preferred_locale in ('fa', 'en'));

alter table public.pp_activity_events drop constraint if exists pp_activity_events_kind_check;
alter table public.pp_activity_events add constraint pp_activity_events_kind_check check (
  kind in ('friend_request', 'friend_accepted', 'group_added', 'room_invite', 'game_started', 'your_turn', 'game_finished', 'achievement', 'report_update', 'security', 'direct_message')
);

create table if not exists public.pp_game_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.pp_rooms(id) on delete cascade,
  sender_id uuid not null references public.pp_profiles(id) on delete cascade,
  recipient_id uuid not null references public.pp_profiles(id) on delete cascade,
  game_type text not null,
  starts_on_accept boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create unique index if not exists pp_game_invites_one_pending_recipient
  on public.pp_game_invites(room_id, recipient_id) where status = 'pending';
create index if not exists pp_game_invites_recipient_status_idx
  on public.pp_game_invites(recipient_id, status, created_at desc);
create index if not exists pp_game_invites_sender_status_idx
  on public.pp_game_invites(sender_id, status, created_at desc);

create trigger pp_game_invites_updated_at
before update on public.pp_game_invites
for each row execute procedure public.partyplay_set_updated_at();

alter table public.pp_game_invites enable row level security;
create policy "pp_game_invites_visible_to_participants" on public.pp_game_invites
for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
alter table public.pp_game_invites replica identity full;
alter publication supabase_realtime add table public.pp_game_invites;

create table if not exists public.pp_friend_threads (
  id uuid primary key default gen_random_uuid(),
  participant_low uuid not null references public.pp_profiles(id) on delete cascade,
  participant_high uuid not null references public.pp_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_low, participant_high),
  check (participant_low < participant_high)
);

create table if not exists public.pp_friend_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.pp_friend_threads(id) on delete cascade,
  sender_id uuid not null references public.pp_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 800),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists pp_friend_threads_updated_idx on public.pp_friend_threads(updated_at desc);
create index if not exists pp_friend_messages_thread_created_idx on public.pp_friend_messages(thread_id, created_at desc);

create trigger pp_friend_threads_updated_at
before update on public.pp_friend_threads
for each row execute procedure public.partyplay_set_updated_at();

alter table public.pp_friend_threads enable row level security;
alter table public.pp_friend_messages enable row level security;
alter table public.pp_friend_threads replica identity full;
alter table public.pp_friend_messages replica identity full;
alter publication supabase_realtime add table public.pp_friend_threads;
alter publication supabase_realtime add table public.pp_friend_messages;

create or replace function public.partyplay_are_friends(p_first_id uuid, p_second_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_first_id is not null and p_second_id is not null and exists (
    select 1 from public.pp_friendships
    where user_a = least(p_first_id, p_second_id)
      and user_b = greatest(p_first_id, p_second_id)
  );
$$;

create policy "pp_friend_threads_visible_to_active_friends" on public.pp_friend_threads
for select to authenticated using (
  auth.uid() in (participant_low, participant_high)
  and public.partyplay_are_friends(participant_low, participant_high)
  and not public.partyplay_is_blocked_relation(participant_low, participant_high)
);

create policy "pp_friend_messages_visible_to_active_friends" on public.pp_friend_messages
for select to authenticated using (exists (
  select 1 from public.pp_friend_threads thread
  where thread.id = pp_friend_messages.thread_id
    and auth.uid() in (thread.participant_low, thread.participant_high)
    and public.partyplay_are_friends(thread.participant_low, thread.participant_high)
    and not public.partyplay_is_blocked_relation(thread.participant_low, thread.participant_high)
));

create or replace function public.partyplay_update_preferred_locale(p_locale text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_locale text := lower(btrim(coalesce(p_locale, 'en')));
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if v_locale not in ('fa', 'en') then perform public.partyplay_social_error('INVALID_LOCALE'); end if;
  update public.pp_profiles set preferred_locale = v_locale where id = auth.uid();
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  return jsonb_build_object('locale', v_locale);
end;
$$;

create or replace function public.partyplay_direct_start_tic_tac_toe(p_room_id uuid)
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
  select * into v_room from public.pp_rooms where id = p_room_id for update;
  if not found then perform public.partyplay_game_error('ROOM_NOT_FOUND'); end if;
  if v_room.game_type <> 'tic_tac_toe' then perform public.partyplay_game_error('INVALID_GAME'); end if;
  if v_room.status <> 'lobby' then perform public.partyplay_game_error('ROOM_NOT_JOINABLE'); end if;

  select array_agg(user_id order by seat_no, joined_at) into v_players
  from public.pp_room_members where room_id = v_room.id and role in ('host', 'player');
  if coalesce(array_length(v_players, 1), 0) <> 2 then perform public.partyplay_game_error('NEED_TWO_PLAYERS'); end if;

  v_state := jsonb_build_object(
    'board', jsonb_build_array(null, null, null, null, null, null, null, null, null),
    'marks', jsonb_build_object('X', v_players[1], 'O', v_players[2])
  );
  insert into public.pp_game_sessions (room_id, game_type, status, state, turn_user_id, version)
  values (v_room.id, 'tic_tac_toe', 'running', v_state, v_players[1], 0)
  on conflict (room_id) do update set game_type = excluded.game_type, status = 'running', state = excluded.state,
    turn_user_id = excluded.turn_user_id, winner_id = null, version = 0, finished_at = null
  returning * into v_session;

  update public.pp_rooms set status = 'playing', started_at = coalesce(started_at, now()), finished_at = null where id = v_room.id;
  insert into public.pp_game_events (session_id, actor_id, sequence_no, event_type, payload)
  values (v_session.id, v_room.host_id, 0, 'started', jsonb_build_object('game', 'tic_tac_toe', 'source', 'friend_invite'))
  on conflict (session_id, sequence_no) do nothing;
  return public.partyplay_session_payload(v_session);
end;
$$;

create or replace function public.partyplay_create_friend_game_invite(
  p_friend_id uuid,
  p_game_type text default 'tic_tac_toe',
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_friend public.pp_profiles;
  v_room public.pp_rooms;
  v_invite public.pp_game_invites;
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 60), '');
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if p_game_type <> 'tic_tac_toe' then perform public.partyplay_social_error('INVALID_DIRECT_GAME'); end if;
  select * into v_friend from public.pp_profiles where id = p_friend_id;
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  if not public.partyplay_are_friends(auth.uid(), p_friend_id) then perform public.partyplay_social_error('NOT_FRIENDS'); end if;
  if public.partyplay_is_blocked_relation(auth.uid(), p_friend_id) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  if v_name is null then v_name := 'بازی دوستانه'; end if;

  insert into public.pp_rooms (host_id, name, game_type, capacity)
  values (auth.uid(), v_name, 'tic_tac_toe', 2)
  returning * into v_room;
  insert into public.pp_room_members (room_id, user_id, seat_no, role, ready)
  values (v_room.id, auth.uid(), 1, 'host', true);
  insert into public.pp_game_invites (room_id, sender_id, recipient_id, game_type, starts_on_accept)
  values (v_room.id, auth.uid(), p_friend_id, 'tic_tac_toe', true)
  returning * into v_invite;

  perform public.partyplay_activity_add(
    p_friend_id, auth.uid(), 'room_invite', 'دعوت بازی از دوستت',
    'دوستت تو را به یک بازی دونفره دعوت کرده است.',
    jsonb_build_object('invite_id', v_invite.id, 'room_id', v_room.id, 'game_type', 'tic_tac_toe', 'starts_on_accept', true)
  );
  return jsonb_build_object('invite_id', v_invite.id, 'room_id', v_room.id, 'status', v_invite.status, 'expires_at', v_invite.expires_at);
end;
$$;

create or replace function public.partyplay_create_friends_room(
  p_game_type text,
  p_name text,
  p_friend_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.pp_rooms;
  v_friend_id uuid;
  v_capacity smallint;
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 60), '');
  v_invite public.pp_game_invites;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if p_friend_ids is null or cardinality(p_friend_ids) < 2 or cardinality(p_friend_ids) > 11 then
    perform public.partyplay_social_error('INVALID_FRIEND_SELECTION');
  end if;
  if (select count(distinct item) from unnest(p_friend_ids) item) <> cardinality(p_friend_ids)
     or auth.uid() = any(p_friend_ids) then perform public.partyplay_social_error('INVALID_FRIEND_SELECTION'); end if;
  v_capacity := cardinality(p_friend_ids) + 1;
  if not public.partyplay_game_capacity_is_valid(p_game_type, v_capacity) then perform public.partyplay_game_error('INVALID_CAPACITY'); end if;
  if v_name is null then v_name := 'اتاق دوستان'; end if;

  foreach v_friend_id in array p_friend_ids loop
    if not public.partyplay_are_friends(auth.uid(), v_friend_id) then perform public.partyplay_social_error('NOT_FRIENDS'); end if;
    if public.partyplay_is_blocked_relation(auth.uid(), v_friend_id) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  end loop;

  insert into public.pp_rooms (host_id, name, game_type, capacity)
  values (auth.uid(), v_name, p_game_type, v_capacity)
  returning * into v_room;
  insert into public.pp_room_members (room_id, user_id, seat_no, role, ready)
  values (v_room.id, auth.uid(), 1, 'host', true);

  foreach v_friend_id in array p_friend_ids loop
    insert into public.pp_game_invites (room_id, sender_id, recipient_id, game_type, starts_on_accept)
    values (v_room.id, auth.uid(), v_friend_id, p_game_type, false)
    returning * into v_invite;
    perform public.partyplay_activity_add(
      v_friend_id, auth.uid(), 'room_invite', 'دعوت به اتاق دوستان',
      'دوستت تو را به یک اتاق بازی دعوت کرده است.',
      jsonb_build_object('invite_id', v_invite.id, 'room_id', v_room.id, 'game_type', p_game_type, 'starts_on_accept', false)
    );
  end loop;
  return jsonb_build_object('room_id', v_room.id, 'invite_code', v_room.invite_code, 'capacity', v_room.capacity, 'status', v_room.status);
end;
$$;

create or replace function public.partyplay_accept_game_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.pp_game_invites;
  v_room public.pp_rooms;
  v_member_count integer;
  v_session jsonb := null;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_invite from public.pp_game_invites
  where id = p_invite_id and recipient_id = auth.uid() for update;
  if not found then perform public.partyplay_social_error('INVITE_NOT_ACTIONABLE'); end if;
  if v_invite.status <> 'pending' then perform public.partyplay_social_error('INVITE_NOT_ACTIONABLE'); end if;
  if v_invite.expires_at <= now() then
    update public.pp_game_invites set status = 'expired', responded_at = now() where id = v_invite.id;
    perform public.partyplay_social_error('INVITE_EXPIRED');
  end if;
  if not public.partyplay_are_friends(v_invite.sender_id, auth.uid()) then perform public.partyplay_social_error('NOT_FRIENDS'); end if;
  if public.partyplay_is_blocked_relation(v_invite.sender_id, auth.uid()) then perform public.partyplay_social_error('USER_BLOCKED'); end if;

  select * into v_room from public.pp_rooms where id = v_invite.room_id for update;
  if not found or v_room.status <> 'lobby' then perform public.partyplay_game_error('ROOM_NOT_JOINABLE'); end if;
  select count(*) into v_member_count from public.pp_room_members where room_id = v_room.id and role in ('host', 'player');
  if v_member_count >= v_room.capacity then perform public.partyplay_game_error('ROOM_FULL'); end if;
  insert into public.pp_room_members (room_id, user_id, seat_no, role, ready)
  values (v_room.id, auth.uid(), v_member_count + 1, 'player', true)
  on conflict (room_id, user_id) do nothing;
  update public.pp_game_invites set status = 'accepted', responded_at = now() where id = v_invite.id;

  if v_invite.starts_on_accept then
    v_session := public.partyplay_direct_start_tic_tac_toe(v_room.id);
    perform public.partyplay_activity_add(v_invite.sender_id, auth.uid(), 'game_started', 'بازی شروع شد', 'دوستت دعوت بازی را پذیرفت و بازی شروع شد.', jsonb_build_object('room_id', v_room.id, 'invite_id', v_invite.id));
    perform public.partyplay_activity_add(auth.uid(), v_invite.sender_id, 'game_started', 'بازی شروع شد', 'دعوت را پذیرفتی؛ بازی آماده است.', jsonb_build_object('room_id', v_room.id, 'invite_id', v_invite.id));
  else
    perform public.partyplay_activity_add(v_invite.sender_id, auth.uid(), 'room_invite', 'دوستت وارد اتاق شد', 'یک بازیکن دعوت اتاق را پذیرفت.', jsonb_build_object('room_id', v_room.id, 'invite_id', v_invite.id, 'accepted', true));
  end if;

  return jsonb_build_object('room_id', v_room.id, 'status', case when v_invite.starts_on_accept then 'playing' else 'lobby' end, 'session', v_session);
end;
$$;

create or replace function public.partyplay_decline_game_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_invite public.pp_game_invites;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_invite from public.pp_game_invites where id = p_invite_id and recipient_id = auth.uid() and status = 'pending' for update;
  if not found then perform public.partyplay_social_error('INVITE_NOT_ACTIONABLE'); end if;
  update public.pp_game_invites set status = 'declined', responded_at = now() where id = v_invite.id;
  perform public.partyplay_activity_add(v_invite.sender_id, auth.uid(), 'room_invite', 'دعوت بازی رد شد', 'دوستت دعوت بازی را نپذیرفت.', jsonb_build_object('room_id', v_invite.room_id, 'invite_id', v_invite.id, 'declined', true));
  return jsonb_build_object('id', v_invite.id, 'status', 'declined');
end;
$$;

create or replace function public.partyplay_list_game_invites(p_limit integer default 30)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', invite.id, 'room_id', invite.room_id, 'game_type', invite.game_type,
    'starts_on_accept', invite.starts_on_accept, 'status', invite.status,
    'expires_at', invite.expires_at, 'created_at', invite.created_at,
    'sender', jsonb_build_object('id', sender.id, 'username', sender.username, 'display_name', sender.display_name, 'avatar_seed', sender.avatar_seed)
  ) order by invite.created_at desc), '[]'::jsonb)
  from (
    select * from public.pp_game_invites
    where recipient_id = auth.uid() and status = 'pending' and expires_at > now()
    order by created_at desc limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) invite
  join public.pp_profiles sender on sender.id = invite.sender_id;
$$;

create or replace function public.partyplay_open_friend_thread(p_friend_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_thread public.pp_friend_threads;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if not public.partyplay_are_friends(auth.uid(), p_friend_id) then perform public.partyplay_social_error('NOT_FRIENDS'); end if;
  if public.partyplay_is_blocked_relation(auth.uid(), p_friend_id) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  insert into public.pp_friend_threads (participant_low, participant_high)
  values (least(auth.uid(), p_friend_id), greatest(auth.uid(), p_friend_id))
  on conflict (participant_low, participant_high) do update set updated_at = public.pp_friend_threads.updated_at
  returning * into v_thread;
  return jsonb_build_object('id', v_thread.id, 'friend_id', p_friend_id, 'created_at', v_thread.created_at);
end;
$$;

create or replace function public.partyplay_list_friend_messages(
  p_thread_id uuid,
  p_before timestamptz default null,
  p_limit integer default 30
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', message.id, 'thread_id', message.thread_id, 'sender_id', message.sender_id,
    'body', message.body, 'created_at', message.created_at, 'read_at', message.read_at
  ) order by message.created_at asc), '[]'::jsonb)
  from (
    select message.* from public.pp_friend_messages message
    join public.pp_friend_threads thread on thread.id = message.thread_id
    where message.thread_id = p_thread_id
      and auth.uid() in (thread.participant_low, thread.participant_high)
      and public.partyplay_are_friends(thread.participant_low, thread.participant_high)
      and not public.partyplay_is_blocked_relation(thread.participant_low, thread.participant_high)
      and (p_before is null or message.created_at < p_before)
    order by message.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) message;
$$;

create or replace function public.partyplay_send_friend_message(p_thread_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.pp_friend_threads;
  v_message public.pp_friend_messages;
  v_recipient uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if char_length(v_body) < 1 or char_length(v_body) > 800 then perform public.partyplay_social_error('INVALID_MESSAGE'); end if;
  select * into v_thread from public.pp_friend_threads where id = p_thread_id for update;
  if not found or auth.uid() not in (v_thread.participant_low, v_thread.participant_high) then perform public.partyplay_social_error('THREAD_NOT_FOUND'); end if;
  if not public.partyplay_are_friends(v_thread.participant_low, v_thread.participant_high) then perform public.partyplay_social_error('NOT_FRIENDS'); end if;
  if public.partyplay_is_blocked_relation(v_thread.participant_low, v_thread.participant_high) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  v_recipient := case when auth.uid() = v_thread.participant_low then v_thread.participant_high else v_thread.participant_low end;
  insert into public.pp_friend_messages (thread_id, sender_id, body) values (v_thread.id, auth.uid(), v_body) returning * into v_message;
  update public.pp_friend_threads set updated_at = now() where id = v_thread.id;
  perform public.partyplay_activity_add(v_recipient, auth.uid(), 'direct_message', 'پیام تازه از دوستت', left(v_body, 140), jsonb_build_object('thread_id', v_thread.id, 'message_id', v_message.id));
  return jsonb_build_object('id', v_message.id, 'thread_id', v_message.thread_id, 'sender_id', v_message.sender_id, 'body', v_message.body, 'created_at', v_message.created_at);
end;
$$;

create or replace function public.partyplay_mark_friend_thread_read(p_thread_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if not exists (
    select 1 from public.pp_friend_threads thread
    where thread.id = p_thread_id and auth.uid() in (thread.participant_low, thread.participant_high)
      and public.partyplay_are_friends(thread.participant_low, thread.participant_high)
      and not public.partyplay_is_blocked_relation(thread.participant_low, thread.participant_high)
  ) then perform public.partyplay_social_error('THREAD_NOT_FOUND'); end if;
  update public.pp_friend_messages set read_at = now()
  where thread_id = p_thread_id and sender_id <> auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.partyplay_remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  delete from public.pp_friendships where user_a = least(auth.uid(), p_friend_id) and user_b = greatest(auth.uid(), p_friend_id);
  update public.pp_game_invites set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((sender_id = auth.uid() and recipient_id = p_friend_id) or (sender_id = p_friend_id and recipient_id = auth.uid()));
end;
$$;

create or replace function public.partyplay_block_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_target public.pp_profiles;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if p_target_user_id = auth.uid() then perform public.partyplay_social_error('CANNOT_BLOCK_SELF'); end if;
  select * into v_target from public.pp_profiles where id = p_target_user_id;
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  insert into public.pp_user_blocks (blocker_id, blocked_id) values (auth.uid(), p_target_user_id) on conflict do nothing;
  delete from public.pp_friendships where user_a = least(auth.uid(), p_target_user_id) and user_b = greatest(auth.uid(), p_target_user_id);
  delete from public.pp_friend_requests where status = 'pending' and ((requester_id = auth.uid() and addressee_id = p_target_user_id) or (requester_id = p_target_user_id and addressee_id = auth.uid()));
  update public.pp_game_invites set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((sender_id = auth.uid() and recipient_id = p_target_user_id) or (sender_id = p_target_user_id and recipient_id = auth.uid()));
  return jsonb_build_object('id', v_target.id, 'username', v_target.username, 'display_name', v_target.display_name, 'avatar_seed', v_target.avatar_seed, 'presence', v_target.presence, 'membership_tier', case when public.partyplay_is_premium(v_target.id) then 'premium' else 'standard' end, 'is_verified', public.partyplay_is_premium(v_target.id), 'site_role', case when public.partyplay_is_admin(v_target.id) then 'site_admin' else 'member' end);
end;
$$;

revoke all on function public.partyplay_are_friends(uuid, uuid) from public;
revoke all on function public.partyplay_update_preferred_locale(text) from public;
revoke all on function public.partyplay_direct_start_tic_tac_toe(uuid) from public;
revoke all on function public.partyplay_create_friend_game_invite(uuid, text, text) from public;
revoke all on function public.partyplay_create_friends_room(text, text, uuid[]) from public;
revoke all on function public.partyplay_accept_game_invite(uuid) from public;
revoke all on function public.partyplay_decline_game_invite(uuid) from public;
revoke all on function public.partyplay_list_game_invites(integer) from public;
revoke all on function public.partyplay_open_friend_thread(uuid) from public;
revoke all on function public.partyplay_list_friend_messages(uuid, timestamptz, integer) from public;
revoke all on function public.partyplay_send_friend_message(uuid, text) from public;
revoke all on function public.partyplay_mark_friend_thread_read(uuid) from public;
revoke all on function public.partyplay_remove_friend(uuid) from public;
revoke all on function public.partyplay_block_user(uuid) from public;

grant execute on function public.partyplay_update_preferred_locale(text) to authenticated;
grant execute on function public.partyplay_create_friend_game_invite(uuid, text, text) to authenticated;
grant execute on function public.partyplay_create_friends_room(text, text, uuid[]) to authenticated;
grant execute on function public.partyplay_accept_game_invite(uuid) to authenticated;
grant execute on function public.partyplay_decline_game_invite(uuid) to authenticated;
grant execute on function public.partyplay_list_game_invites(integer) to authenticated;
grant execute on function public.partyplay_open_friend_thread(uuid) to authenticated;
grant execute on function public.partyplay_list_friend_messages(uuid, timestamptz, integer) to authenticated;
grant execute on function public.partyplay_send_friend_message(uuid, text) to authenticated;
grant execute on function public.partyplay_mark_friend_thread_read(uuid) to authenticated;
grant execute on function public.partyplay_remove_friend(uuid) to authenticated;
grant execute on function public.partyplay_block_user(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
