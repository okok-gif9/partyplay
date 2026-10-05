-- PartyPlay admin console: server-authorized insights and controlled test-room creation.
-- No admin secret or privileged database key is exposed to the browser.

create table if not exists public.pp_admins (
  user_id uuid primary key references public.pp_profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.pp_profiles(id) on delete set null
);

create table if not exists public.pp_admin_audit_events (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.pp_profiles(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 3 and 64),
  target_room_id uuid references public.pp_rooms(id) on delete set null,
  target_user_id uuid references public.pp_profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pp_admin_audit_events_admin_created_idx
  on public.pp_admin_audit_events(admin_id, created_at desc);
create index if not exists pp_admin_audit_events_room_created_idx
  on public.pp_admin_audit_events(target_room_id, created_at desc);

alter table public.pp_admins enable row level security;
alter table public.pp_admin_audit_events enable row level security;

create or replace function public.partyplay_admin_error(p_code text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.partyplay_game_error(p_code);
end;
$$;

create or replace function public.partyplay_is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
    and exists (select 1 from public.pp_admins where user_id = p_user_id);
$$;

create or replace function public.partyplay_require_admin()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if v_admin_id is null then
    perform public.partyplay_admin_error('NOT_AUTHENTICATED');
  end if;
  if not public.partyplay_is_admin(v_admin_id) then
    perform public.partyplay_admin_error('NOT_ADMIN');
  end if;
  return v_admin_id;
end;
$$;

create or replace function public.partyplay_admin_session()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_profile public.pp_profiles;
begin
  v_admin_id := public.partyplay_require_admin();
  select * into v_profile from public.pp_profiles where id = v_admin_id;

  return jsonb_build_object(
    'is_admin', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'username', v_profile.username,
      'avatar_seed', v_profile.avatar_seed
    )
  );
end;
$$;

create or replace function public.partyplay_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_total_users integer;
  v_active_users integer;
  v_open_rooms integer;
  v_live_rooms integer;
  v_completed_games integer;
  v_activity jsonb;
  v_top_games jsonb;
  v_recent_rooms jsonb;
begin
  v_admin_id := public.partyplay_require_admin();

  select count(*) into v_total_users from public.pp_profiles;
  select count(distinct actor_id) into v_active_users
  from public.pp_game_events
  where actor_id is not null and created_at >= now() - interval '7 days';
  select count(*) into v_open_rooms from public.pp_rooms where status = 'lobby';
  select count(*) into v_live_rooms from public.pp_rooms where status = 'playing';
  select count(*) into v_completed_games from public.pp_game_sessions where status = 'finished';

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(day::date, 'YYYY-MM-DD'),
    'registrations', (
      select count(*) from public.pp_profiles profile
      where profile.created_at >= day and profile.created_at < day + interval '1 day'
    ),
    'active_users', (
      select count(distinct event.actor_id) from public.pp_game_events event
      where event.actor_id is not null and event.created_at >= day and event.created_at < day + interval '1 day'
    )
  ) order by day), '[]'::jsonb)
  into v_activity
  from generate_series(
    date_trunc('day', now()) - interval '6 days',
    date_trunc('day', now()),
    interval '1 day'
  ) as day;

  select coalesce(jsonb_agg(jsonb_build_object(
    'game_type', game_type,
    'completed_games', completed_games,
    'sessions', sessions
  ) order by completed_games desc, sessions desc, game_type), '[]'::jsonb)
  into v_top_games
  from (
    select game_type,
      count(*) filter (where status = 'finished')::integer as completed_games,
      count(*)::integer as sessions
    from public.pp_game_sessions
    group by game_type
    order by completed_games desc, sessions desc, game_type
    limit 6
  ) ranked_games;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'game_type', game_type,
    'status', status,
    'capacity', capacity,
    'invite_code', invite_code,
    'host_display_name', host_display_name,
    'created_at', created_at,
    'is_admin_test', is_admin_test
  ) order by created_at desc), '[]'::jsonb)
  into v_recent_rooms
  from (
    select room.id, room.name, room.game_type, room.status, room.capacity, room.invite_code,
      profile.display_name as host_display_name, room.created_at,
      coalesce((room.settings ->> 'admin_test')::boolean, false) as is_admin_test
    from public.pp_rooms room
    join public.pp_profiles profile on profile.id = room.host_id
    order by room.created_at desc
    limit 8
  ) latest_rooms;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'total_users', coalesce(v_total_users, 0),
      'active_users_7d', coalesce(v_active_users, 0),
      'open_rooms', coalesce(v_open_rooms, 0),
      'live_rooms', coalesce(v_live_rooms, 0),
      'completed_games', coalesce(v_completed_games, 0)
    ),
    'activity', v_activity,
    'top_games', v_top_games,
    'recent_rooms', v_recent_rooms
  );
end;
$$;

create or replace function public.partyplay_admin_users(
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 50));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total integer;
  v_items jsonb;
begin
  perform public.partyplay_require_admin();
  if char_length(v_query) > 48 then
    perform public.partyplay_admin_error('INVALID_QUERY');
  end if;

  select count(*) into v_total
  from public.pp_profiles profile
  where v_query = ''
    or lower(profile.username) like '%' || v_query || '%'
    or lower(profile.display_name) like '%' || v_query || '%';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'display_name', display_name,
    'username', username,
    'avatar_seed', avatar_seed,
    'presence', presence,
    'created_at', created_at,
    'room_count', room_count,
    'completed_games', completed_games
  ) order by created_at desc, username), '[]'::jsonb)
  into v_items
  from (
    select profile.id, profile.display_name, profile.username, profile.avatar_seed, profile.presence, profile.created_at,
      (select count(*)::integer from public.pp_room_members membership where membership.user_id = profile.id) as room_count,
      (
        select count(*)::integer
        from public.pp_room_members membership
        join public.pp_game_sessions session on session.room_id = membership.room_id
        where membership.user_id = profile.id and session.status = 'finished'
      ) as completed_games
    from public.pp_profiles profile
    where v_query = ''
      or lower(profile.username) like '%' || v_query || '%'
      or lower(profile.display_name) like '%' || v_query || '%'
    order by profile.created_at desc, profile.username
    limit v_limit offset v_offset
  ) filtered_profiles;

  return jsonb_build_object(
    'items', v_items,
    'total', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
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
begin
  perform public.partyplay_require_admin();
  select * into v_profile from public.pp_profiles where id = p_user_id;
  if not found then
    perform public.partyplay_admin_error('USER_NOT_FOUND');
  end if;

  select email into v_email from auth.users where id = p_user_id;

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
    )
  );
end;
$$;

create or replace function public.partyplay_admin_create_test_room(
  p_game_type text,
  p_name text default null,
  p_capacity smallint default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_room public.pp_rooms;
  v_name text := btrim(coalesce(p_name, ''));
begin
  v_admin_id := public.partyplay_require_admin();

  if not public.partyplay_game_capacity_is_valid(p_game_type, p_capacity) then
    perform public.partyplay_admin_error('INVALID_CAPACITY');
  end if;

  if char_length(v_name) < 2 then
    v_name := 'اتاق تست ' || p_game_type;
  end if;

  insert into public.pp_rooms (host_id, name, game_type, capacity, settings)
  values (
    v_admin_id,
    left(v_name, 60),
    p_game_type,
    p_capacity,
    jsonb_build_object(
      'admin_test', true,
      'created_by_admin_id', v_admin_id,
      'created_at', now()
    )
  )
  returning * into v_room;

  insert into public.pp_room_members (room_id, user_id, seat_no, role, ready)
  values (v_room.id, v_admin_id, 1, 'host', true);

  insert into public.pp_admin_audit_events (admin_id, event_type, target_room_id, payload)
  values (
    v_admin_id,
    'test_room_created',
    v_room.id,
    jsonb_build_object('game_type', p_game_type, 'capacity', p_capacity)
  );

  return jsonb_build_object(
    'id', v_room.id,
    'invite_code', v_room.invite_code,
    'name', v_room.name,
    'game_type', v_room.game_type,
    'status', v_room.status,
    'capacity', v_room.capacity
  );
end;
$$;

create or replace function public.partyplay_admin_list_test_rooms()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
begin
  v_admin_id := public.partyplay_require_admin();

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'invite_code', invite_code,
      'name', name,
      'game_type', game_type,
      'status', status,
      'capacity', capacity,
      'member_count', member_count,
      'created_at', created_at
    ) order by created_at desc), '[]'::jsonb)
    from (
      select room.id, room.invite_code, room.name, room.game_type, room.status, room.capacity, room.created_at,
        (select count(*)::integer from public.pp_room_members membership where membership.room_id = room.id) as member_count
      from public.pp_rooms room
      where room.host_id = v_admin_id
        and coalesce(room.settings ->> 'admin_test', 'false') = 'true'
        and room.settings ->> 'created_by_admin_id' = v_admin_id::text
      order by room.created_at desc
      limit 40
    ) own_test_rooms
  );
end;
$$;

create or replace function public.partyplay_admin_cancel_test_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_room public.pp_rooms;
begin
  v_admin_id := public.partyplay_require_admin();

  select * into v_room from public.pp_rooms where id = p_room_id for update;
  if not found then
    perform public.partyplay_admin_error('ROOM_NOT_FOUND');
  end if;
  if v_room.host_id <> v_admin_id
    or coalesce(v_room.settings ->> 'admin_test', 'false') <> 'true'
    or v_room.settings ->> 'created_by_admin_id' <> v_admin_id::text then
    perform public.partyplay_admin_error('NOT_ADMIN');
  end if;
  if v_room.status <> 'lobby' then
    perform public.partyplay_admin_error('ROOM_NOT_CANCELLABLE');
  end if;

  update public.pp_rooms
  set status = 'cancelled', finished_at = now()
  where id = v_room.id;

  insert into public.pp_admin_audit_events (admin_id, event_type, target_room_id)
  values (v_admin_id, 'test_room_cancelled', v_room.id);

  return jsonb_build_object('id', v_room.id, 'status', 'cancelled');
end;
$$;

revoke all on table public.pp_admins from public;
revoke all on table public.pp_admin_audit_events from public;

revoke all on function public.partyplay_is_admin(uuid) from public;
revoke all on function public.partyplay_admin_session() from public;
revoke all on function public.partyplay_admin_dashboard() from public;
revoke all on function public.partyplay_admin_users(text, integer, integer) from public;
revoke all on function public.partyplay_admin_user_detail(uuid) from public;
revoke all on function public.partyplay_admin_create_test_room(text, text, smallint) from public;
revoke all on function public.partyplay_admin_list_test_rooms() from public;
revoke all on function public.partyplay_admin_cancel_test_room(uuid) from public;

grant execute on function public.partyplay_is_admin(uuid) to authenticated;
grant execute on function public.partyplay_admin_session() to authenticated;
grant execute on function public.partyplay_admin_dashboard() to authenticated;
grant execute on function public.partyplay_admin_users(text, integer, integer) to authenticated;
grant execute on function public.partyplay_admin_user_detail(uuid) to authenticated;
grant execute on function public.partyplay_admin_create_test_room(text, text, smallint) to authenticated;
grant execute on function public.partyplay_admin_list_test_rooms() to authenticated;
grant execute on function public.partyplay_admin_cancel_test_room(uuid) to authenticated;

notify pgrst, 'reload schema';
