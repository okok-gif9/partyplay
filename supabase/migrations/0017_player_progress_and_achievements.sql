-- Persistent player journey: server-side achievements and privacy-safe personal statistics.

create table if not exists public.pp_player_achievements (
  user_id uuid not null references public.pp_profiles(id) on delete cascade,
  code text not null check (code in ('first_game', 'first_friend', 'mafia_host', 'mafia_regular')),
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 180),
  icon text not null check (char_length(icon) between 1 and 8),
  accent text not null check (accent in ('cyan', 'gold', 'lime', 'pink')),
  earned_at timestamptz not null default now(),
  primary key (user_id, code)
);

create index if not exists pp_player_achievements_user_earned_idx on public.pp_player_achievements(user_id, earned_at desc);

alter table public.pp_player_achievements enable row level security;
drop policy if exists "pp_player_achievements_visible_to_owner" on public.pp_player_achievements;
create policy "pp_player_achievements_visible_to_owner" on public.pp_player_achievements
for select to authenticated using (user_id = auth.uid());

create or replace function public.partyplay_award_achievement_to(
  p_user_id uuid,
  p_code text,
  p_title text,
  p_description text,
  p_icon text,
  p_accent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer := 0;
begin
  insert into public.pp_player_achievements (user_id, code, title, description, icon, accent)
  values (p_user_id, p_code, p_title, p_description, p_icon, p_accent)
  on conflict (user_id, code) do nothing;
  get diagnostics v_row_count = row_count;

  if v_row_count > 0 and to_regclass('public.pp_activity_events') is not null then
    perform public.partyplay_activity_add(
      p_user_id,
      null,
      'achievement',
      'نشان تازه باز شد: ' || p_title,
      p_description,
      jsonb_build_object('achievement_code', p_code, 'icon', p_icon, 'accent', p_accent)
    );
  end if;
end;
$$;

create or replace function public.partyplay_progress_friendship_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.partyplay_award_achievement_to(new.user_a, 'first_friend', 'دوست اول', 'اولین دوستت به جمع PartyPlay اضافه شد.', '✦', 'lime');
  perform public.partyplay_award_achievement_to(new.user_b, 'first_friend', 'دوست اول', 'اولین دوستت به جمع PartyPlay اضافه شد.', '✦', 'lime');
  return new;
end;
$$;

drop trigger if exists pp_progress_friendship on public.pp_friendships;
create trigger pp_progress_friendship
after insert on public.pp_friendships
for each row execute procedure public.partyplay_progress_friendship_trigger();

create or replace function public.partyplay_progress_room_host_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.game_type = 'mafia' then
    perform public.partyplay_award_achievement_to(new.host_id, 'mafia_host', 'میزبان شهر', 'اولین اتاق مافیای خودت را ساختی.', '◈', 'pink');
  end if;
  return new;
end;
$$;

drop trigger if exists pp_progress_room_host on public.pp_rooms;
create trigger pp_progress_room_host
after insert on public.pp_rooms
for each row execute procedure public.partyplay_progress_room_host_trigger();

create or replace function public.partyplay_progress_game_session_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_mafia_games integer;
begin
  for v_member in
    select user_id from public.pp_room_members
    where room_id = new.room_id and role in ('host', 'player')
  loop
    perform public.partyplay_award_achievement_to(v_member.user_id, 'first_game', 'شروع واقعی', 'اولین بازی گروهی‌ات را شروع کردی.', '★', 'cyan');
    if new.game_type = 'mafia' then
      select count(*) into v_mafia_games
      from public.pp_game_sessions session
      join public.pp_room_members member on member.room_id = session.room_id
      where member.user_id = v_member.user_id and member.role in ('host', 'player') and session.game_type = 'mafia';
      if v_mafia_games >= 3 then
        perform public.partyplay_award_achievement_to(v_member.user_id, 'mafia_regular', 'اهل شهر', 'در سه بازی مافیا حضور داشته‌ای.', '☾', 'pink');
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists pp_progress_game_session on public.pp_game_sessions;
create trigger pp_progress_game_session
after insert on public.pp_game_sessions
for each row execute procedure public.partyplay_progress_game_session_trigger();

create or replace function public.partyplay_player_progress()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with member_sessions as (
    select session.id, session.game_type, session.status, session.created_at, session.finished_at
    from public.pp_game_sessions session
    join public.pp_room_members member on member.room_id = session.room_id
    where member.user_id = auth.uid() and member.role in ('host', 'player')
  ),
  stats as (
    select
      count(*)::integer as games_played,
      count(*) filter (where status = 'finished')::integer as finished_games,
      count(*) filter (where game_type = 'mafia')::integer as mafia_games,
      count(distinct created_at::date) filter (where created_at::date >= current_date - interval '6 days')::integer as week_active_days,
      max(coalesce(finished_at, created_at)) as last_game_at
    from member_sessions
  ),
  achievements as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', code, 'title', title, 'description', description, 'icon', icon, 'accent', accent, 'earned_at', earned_at
    ) order by earned_at desc), '[]'::jsonb) as items
    from public.pp_player_achievements where user_id = auth.uid()
  )
  select jsonb_build_object(
    'games_played', stats.games_played,
    'finished_games', stats.finished_games,
    'mafia_games', stats.mafia_games,
    'hosted_rooms', (select count(*)::integer from public.pp_rooms where host_id = auth.uid()),
    'friends_count', (select count(*)::integer from public.pp_friendships where user_a = auth.uid() or user_b = auth.uid()),
    'groups_count', (select count(*)::integer from public.pp_group_members where user_id = auth.uid()),
    'week_active_days', stats.week_active_days,
    'last_game_at', stats.last_game_at,
    'achievements', achievements.items
  )
  from stats, achievements;
$$;

revoke all on function public.partyplay_award_achievement_to(uuid, text, text, text, text, text) from public;
revoke all on function public.partyplay_player_progress() from public;
grant execute on function public.partyplay_player_progress() to authenticated;

notify pgrst, 'reload schema';
