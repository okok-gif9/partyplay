-- PartyPlay core schema
-- This migration is designed for a fresh Supabase project and keeps PartyPlay data
-- isolated in clearly prefixed tables in the public schema.

create extension if not exists pgcrypto;

create or replace function public.partyplay_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
$$;

create table if not exists public.pp_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_seed text not null default 'spark',
  presence text not null default 'offline' check (presence in ('online', 'away', 'busy', 'offline')),
  theme_preference text not null default 'system' check (theme_preference in ('system', 'light', 'dark')),
  allow_friend_requests boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.pp_profiles(id) on delete cascade,
  addressee_id uuid not null references public.pp_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists public.pp_friendships (
  user_a uuid not null references public.pp_profiles(id) on delete cascade,
  user_b uuid not null references public.pp_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.pp_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.pp_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  description text not null default '' check (char_length(description) <= 180),
  avatar_seed text not null default 'squad',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pp_group_members (
  group_id uuid not null references public.pp_groups(id) on delete cascade,
  user_id uuid not null references public.pp_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.pp_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.pp_profiles(id) on delete cascade,
  group_id uuid references public.pp_groups(id) on delete set null,
  invite_code text not null unique default public.partyplay_invite_code(),
  name text not null check (char_length(name) between 2 and 60),
  game_type text not null check (game_type in ('mafia', 'tic_tac_toe', 'truth_or_dare', 'snakes_ladders')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  password_hash text,
  capacity smallint not null check (capacity between 2 and 12),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.pp_room_members (
  room_id uuid not null references public.pp_rooms(id) on delete cascade,
  user_id uuid not null references public.pp_profiles(id) on delete cascade,
  seat_no smallint,
  role text not null default 'player' check (role in ('host', 'player', 'spectator', 'bot')),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat_no)
);

create table if not exists public.pp_game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.pp_rooms(id) on delete cascade,
  game_type text not null check (game_type in ('mafia', 'tic_tac_toe', 'truth_or_dare', 'snakes_ladders')),
  round_no integer not null default 1 check (round_no > 0),
  status text not null default 'waiting' check (status in ('waiting', 'running', 'finished', 'abandoned')),
  state jsonb not null default '{}'::jsonb,
  turn_user_id uuid references public.pp_profiles(id) on delete set null,
  winner_id uuid references public.pp_profiles(id) on delete set null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.pp_game_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.pp_game_sessions(id) on delete cascade,
  actor_id uuid references public.pp_profiles(id) on delete set null,
  sequence_no integer not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_no)
);

create table if not exists public.pp_room_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.pp_rooms(id) on delete cascade,
  sender_id uuid not null references public.pp_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);

create index if not exists pp_friend_requests_addressee_idx on public.pp_friend_requests(addressee_id, status);
create index if not exists pp_friendships_user_a_idx on public.pp_friendships(user_a);
create index if not exists pp_friendships_user_b_idx on public.pp_friendships(user_b);
create index if not exists pp_group_members_user_idx on public.pp_group_members(user_id);
create index if not exists pp_rooms_host_status_idx on public.pp_rooms(host_id, status);
create index if not exists pp_rooms_invite_code_idx on public.pp_rooms(invite_code);
create index if not exists pp_room_members_user_idx on public.pp_room_members(user_id);
create index if not exists pp_game_events_session_sequence_idx on public.pp_game_events(session_id, sequence_no);
create index if not exists pp_room_messages_room_created_idx on public.pp_room_messages(room_id, created_at desc);

create or replace function public.partyplay_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pp_profiles_updated_at before update on public.pp_profiles
for each row execute procedure public.partyplay_set_updated_at();
create trigger pp_groups_updated_at before update on public.pp_groups
for each row execute procedure public.partyplay_set_updated_at();
create trigger pp_rooms_updated_at before update on public.pp_rooms
for each row execute procedure public.partyplay_set_updated_at();
create trigger pp_game_sessions_updated_at before update on public.pp_game_sessions
for each row execute procedure public.partyplay_set_updated_at();

create or replace function public.partyplay_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_username text;
begin
  generated_username := lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, 'player'), '@', 1)))
    || '_' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.pp_profiles (id, username, display_name)
  values (
    new.id,
    left(generated_username, 24),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'بازیکن جدید')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger pp_auth_user_created
after insert on auth.users
for each row execute procedure public.partyplay_create_profile();

alter table public.pp_profiles enable row level security;
alter table public.pp_friend_requests enable row level security;
alter table public.pp_friendships enable row level security;
alter table public.pp_groups enable row level security;
alter table public.pp_group_members enable row level security;
alter table public.pp_rooms enable row level security;
alter table public.pp_room_members enable row level security;
alter table public.pp_game_sessions enable row level security;
alter table public.pp_game_events enable row level security;
alter table public.pp_room_messages enable row level security;

create policy "pp_profiles_are_discoverable" on public.pp_profiles
for select to authenticated using (true);
create policy "pp_profiles_update_self" on public.pp_profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "pp_friend_requests_visible_to_participants" on public.pp_friend_requests
for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "pp_friend_requests_create_self" on public.pp_friend_requests
for insert to authenticated with check (requester_id = auth.uid());
create policy "pp_friend_requests_update_participants" on public.pp_friend_requests
for update to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid()) with check (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "pp_friendships_visible_to_participants" on public.pp_friendships
for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());

create policy "pp_groups_visible_to_members" on public.pp_groups
for select to authenticated using (owner_id = auth.uid() or exists (
  select 1 from public.pp_group_members membership
  where membership.group_id = id and membership.user_id = auth.uid()
));
create policy "pp_groups_create_self" on public.pp_groups
for insert to authenticated with check (owner_id = auth.uid());
create policy "pp_groups_update_owner" on public.pp_groups
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "pp_group_members_visible_to_members" on public.pp_group_members
for select to authenticated using (user_id = auth.uid() or exists (
  select 1 from public.pp_group_members current_membership
  where current_membership.group_id = group_id and current_membership.user_id = auth.uid()
));

create policy "pp_rooms_visible_to_members_or_public" on public.pp_rooms
for select to authenticated using (
  visibility = 'public' or host_id = auth.uid() or exists (
    select 1 from public.pp_room_members membership
    where membership.room_id = id and membership.user_id = auth.uid()
  )
);
create policy "pp_rooms_create_self" on public.pp_rooms
for insert to authenticated with check (host_id = auth.uid());
create policy "pp_rooms_update_host" on public.pp_rooms
for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy "pp_room_members_visible_to_room_members" on public.pp_room_members
for select to authenticated using (user_id = auth.uid() or exists (
  select 1 from public.pp_room_members current_membership
  where current_membership.room_id = room_id and current_membership.user_id = auth.uid()
));

create policy "pp_game_sessions_visible_to_room_members" on public.pp_game_sessions
for select to authenticated using (exists (
  select 1 from public.pp_room_members membership
  where membership.room_id = room_id and membership.user_id = auth.uid()
));
create policy "pp_game_events_visible_to_room_members" on public.pp_game_events
for select to authenticated using (exists (
  select 1
  from public.pp_game_sessions session
  join public.pp_room_members membership on membership.room_id = session.room_id
  where session.id = session_id and membership.user_id = auth.uid()
));
create policy "pp_room_messages_visible_to_room_members" on public.pp_room_messages
for select to authenticated using (exists (
  select 1 from public.pp_room_members membership
  where membership.room_id = room_id and membership.user_id = auth.uid()
));
create policy "pp_room_messages_send_as_self" on public.pp_room_messages
for insert to authenticated with check (sender_id = auth.uid() and exists (
  select 1 from public.pp_room_members membership
  where membership.room_id = room_id and membership.user_id = auth.uid()
));

alter table public.pp_rooms replica identity full;
alter table public.pp_room_members replica identity full;
alter table public.pp_game_sessions replica identity full;
alter table public.pp_game_events replica identity full;
alter table public.pp_room_messages replica identity full;

alter publication supabase_realtime add table public.pp_rooms;
alter publication supabase_realtime add table public.pp_room_members;
alter publication supabase_realtime add table public.pp_game_sessions;
alter publication supabase_realtime add table public.pp_game_events;
alter publication supabase_realtime add table public.pp_room_messages;
