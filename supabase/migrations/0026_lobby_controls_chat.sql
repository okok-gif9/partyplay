begin;

create table if not exists public.pp_lobby_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.pp_rooms(id) on delete cascade,
  sender_id uuid not null references public.pp_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists pp_lobby_messages_room_created_idx
  on public.pp_lobby_messages(room_id, created_at desc);
alter table public.pp_lobby_messages enable row level security;
alter table public.pp_lobby_messages replica identity full;
drop policy if exists "pp_lobby_messages_visible_to_members" on public.pp_lobby_messages;
create policy "pp_lobby_messages_visible_to_members" on public.pp_lobby_messages
  for select to authenticated using (
    exists (select 1 from public.pp_room_members member
      where member.room_id = pp_lobby_messages.room_id and member.user_id = auth.uid()
        and member.role in ('host', 'player'))
  );

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pp_lobby_messages') then
    alter publication supabase_realtime add table public.pp_lobby_messages;
  end if;
end;
$$;

create or replace function public.partyplay_lobby_list_messages(p_room_id uuid, p_limit integer default 60)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.pp_room_members
    where room_id = p_room_id and user_id = auth.uid() and role in ('host', 'player')
  ) then perform public.partyplay_social_error('NOT_A_MEMBER'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', message.id, 'room_id', message.room_id, 'sender_id', message.sender_id,
      'body', message.body, 'created_at', message.created_at,
      'sender_name', profile.display_name, 'sender_avatar', profile.avatar_seed
    ) order by message.created_at asc)
    from (
      select * from public.pp_lobby_messages
      where room_id = p_room_id order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 60), 100))
    ) message
    join public.pp_profiles profile on profile.id = message.sender_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.partyplay_lobby_send_message(p_room_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_message public.pp_lobby_messages;
  v_room public.pp_rooms;
  v_profile public.pp_profiles;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then perform public.partyplay_social_error('INVALID_MESSAGE'); end if;
  select * into v_room from public.pp_rooms where id = p_room_id;
  if not found or v_room.status <> 'lobby' then perform public.partyplay_game_error('ROOM_NOT_JOINABLE'); end if;
  if not exists (select 1 from public.pp_room_members where room_id=p_room_id and user_id=auth.uid() and role in ('host','player')) then
    perform public.partyplay_social_error('NOT_A_MEMBER');
  end if;
  insert into public.pp_lobby_messages(room_id, sender_id, body) values (p_room_id, auth.uid(), v_body) returning * into v_message;
  select * into v_profile from public.pp_profiles where id=auth.uid();
  return jsonb_build_object('id', v_message.id, 'room_id', v_message.room_id, 'sender_id', v_message.sender_id,
    'body', v_message.body, 'created_at', v_message.created_at,
    'sender_name', v_profile.display_name, 'sender_avatar', v_profile.avatar_seed);
end;
$$;

create or replace function public.partyplay_lobby_set_ready(p_room_id uuid, p_ready boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_room public.pp_rooms;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_room from public.pp_rooms where id=p_room_id;
  if not found or v_room.status <> 'lobby' then perform public.partyplay_game_error('ROOM_NOT_JOINABLE'); end if;
  update public.pp_room_members set ready=coalesce(p_ready, false)
    where room_id=p_room_id and user_id=auth.uid() and role in ('host','player');
  if not found then perform public.partyplay_social_error('NOT_A_MEMBER'); end if;
  return coalesce(p_ready, false);
end;
$$;

create or replace function public.partyplay_lobby_kick_member(p_room_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_room public.pp_rooms;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_room from public.pp_rooms where id=p_room_id for update;
  if not found or v_room.status <> 'lobby' then perform public.partyplay_game_error('ROOM_NOT_JOINABLE'); end if;
  if v_room.host_id <> auth.uid() then perform public.partyplay_social_error('NOT_HOST'); end if;
  if p_user_id = v_room.host_id then perform public.partyplay_social_error('CANNOT_KICK_HOST'); end if;
  delete from public.pp_room_members where room_id=p_room_id and user_id=p_user_id and role in ('host','player');
  if not found then perform public.partyplay_social_error('NOT_A_MEMBER'); end if;
  update public.pp_game_invites set status='cancelled', responded_at=now()
    where room_id=p_room_id and recipient_id=p_user_id and status='pending';
  return true;
end;
$$;

create or replace function public.partyplay_invite_friend_to_room(p_room_id uuid, p_friend_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_room public.pp_rooms;
  v_invite public.pp_game_invites;
  v_count integer;
  v_created boolean := false;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_room from public.pp_rooms where id=p_room_id for update;
  if not found or v_room.status <> 'lobby' then perform public.partyplay_game_error('ROOM_NOT_JOINABLE'); end if;
  if v_room.host_id <> auth.uid() then perform public.partyplay_social_error('NOT_HOST'); end if;
  if p_friend_id = auth.uid() or not public.partyplay_are_friends(auth.uid(), p_friend_id) then perform public.partyplay_social_error('NOT_FRIENDS'); end if;
  if public.partyplay_is_blocked_relation(auth.uid(), p_friend_id) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  select count(*) into v_count from public.pp_room_members where room_id=p_room_id and role in ('host','player');
  if v_count >= v_room.capacity then perform public.partyplay_game_error('ROOM_FULL'); end if;
  select * into v_invite from public.pp_game_invites where room_id=p_room_id and recipient_id=p_friend_id and status='pending' and expires_at>now();
  if not found then
    begin
      insert into public.pp_game_invites(room_id,sender_id,recipient_id,game_type,starts_on_accept)
        values(p_room_id,auth.uid(),p_friend_id,v_room.game_type,false) returning * into v_invite;
      v_created := true;
    exception when unique_violation then
      select * into v_invite from public.pp_game_invites where room_id=p_room_id and recipient_id=p_friend_id and status='pending';
    end;
  end if;
  if v_created then
    perform public.partyplay_activity_add(p_friend_id,auth.uid(),'room_invite','دعوت به اتاق بازی','دوستت تو را به لابی بازی دعوت کرده است.',
      jsonb_build_object('invite_id',v_invite.id,'room_id',v_room.id,'game_type',v_room.game_type,'starts_on_accept',false));
  end if;
  return jsonb_build_object('invite_id',v_invite.id,'room_id',p_room_id,'status',v_invite.status,'created',v_created);
end;
$$;

create or replace function public.partyplay_enforce_room_start_readiness()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer; v_all_ready boolean;
begin
  if old.status = 'lobby' and new.status = 'playing' then
    select count(*), coalesce(bool_and(ready), false) into v_count, v_all_ready
      from public.pp_room_members where room_id=new.id and role in ('host','player');
    if (new.game_type = 'truth_or_dare' and (v_count < 2 or v_count > new.capacity))
      or (new.game_type <> 'truth_or_dare' and v_count <> new.capacity) then
      raise exception using message='NEED_EXACT_CAPACITY', errcode='P0001';
    end if;
    if not v_all_ready then raise exception using message='ROOM_NOT_READY', errcode='P0001'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists pp_rooms_require_ready_before_play on public.pp_rooms;
create trigger pp_rooms_require_ready_before_play
before update of status on public.pp_rooms
for each row execute function public.partyplay_enforce_room_start_readiness();

create or replace function public.partyplay_fill_open_room_seat()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_capacity smallint; v_open_seat smallint;
begin
  if new.role in ('host','player') and new.seat_no is not null
    and exists(select 1 from public.pp_room_members where room_id=new.room_id and seat_no=new.seat_no) then
    select capacity into v_capacity from public.pp_rooms where id=new.room_id;
    select seat_no into v_open_seat from generate_series(1, v_capacity) as candidate(seat_no)
      where not exists(select 1 from public.pp_room_members member where member.room_id=new.room_id and member.seat_no=candidate.seat_no)
      order by seat_no limit 1;
    new.seat_no := v_open_seat;
  end if;
  return new;
end;
$$;
drop trigger if exists pp_room_members_fill_open_seat on public.pp_room_members;
create trigger pp_room_members_fill_open_seat
before insert on public.pp_room_members
for each row execute function public.partyplay_fill_open_room_seat();

create or replace function public.partyplay_accept_game_invite(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invite public.pp_game_invites;
  v_room public.pp_rooms;
  v_member_count integer;
  v_session jsonb := null;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_invite from public.pp_game_invites where id=p_invite_id and recipient_id=auth.uid() for update;
  if not found or v_invite.status <> 'pending' then perform public.partyplay_social_error('INVITE_NOT_ACTIONABLE'); end if;
  if v_invite.expires_at <= now() then
    update public.pp_game_invites set status='expired', responded_at=now() where id=v_invite.id;
    perform public.partyplay_social_error('INVITE_EXPIRED');
  end if;
  if not public.partyplay_are_friends(v_invite.sender_id, auth.uid()) then perform public.partyplay_social_error('NOT_FRIENDS'); end if;
  if public.partyplay_is_blocked_relation(v_invite.sender_id, auth.uid()) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  select * into v_room from public.pp_rooms where id=v_invite.room_id for update;
  if not found or v_room.status <> 'lobby' then perform public.partyplay_game_error('ROOM_NOT_JOINABLE'); end if;
  select count(*) into v_member_count from public.pp_room_members where room_id=v_room.id and role in ('host','player');
  if v_member_count >= v_room.capacity then perform public.partyplay_game_error('ROOM_FULL'); end if;
  insert into public.pp_room_members(room_id,user_id,seat_no,role,ready)
    values(v_room.id,auth.uid(),v_member_count+1,'player',v_invite.starts_on_accept)
    on conflict(room_id,user_id) do update set ready=excluded.ready;
  update public.pp_game_invites set status='accepted', responded_at=now() where id=v_invite.id;
  if v_invite.starts_on_accept then
    update public.pp_room_members set ready=true where room_id=v_room.id and user_id=auth.uid();
    v_session := public.partyplay_direct_start_tic_tac_toe(v_room.id);
    perform public.partyplay_activity_add(v_invite.sender_id,auth.uid(),'game_started','بازی شروع شد','دوستت دعوت بازی را پذیرفت و بازی شروع شد.',jsonb_build_object('room_id',v_room.id,'invite_id',v_invite.id));
    perform public.partyplay_activity_add(auth.uid(),v_invite.sender_id,'game_started','بازی شروع شد','دعوت را پذیرفتی؛ بازی آماده است.',jsonb_build_object('room_id',v_room.id,'invite_id',v_invite.id));
  else
    perform public.partyplay_activity_add(v_invite.sender_id,auth.uid(),'room_invite','دوستت وارد اتاق شد','یک بازیکن دعوت اتاق را پذیرفت.',jsonb_build_object('room_id',v_room.id,'invite_id',v_invite.id,'accepted',true));
  end if;
  return jsonb_build_object('room_id',v_room.id,'status',case when v_invite.starts_on_accept then 'playing' else 'lobby' end,'session',v_session);
end;
$$;

revoke all on function public.partyplay_lobby_list_messages(uuid, integer) from public;
revoke all on function public.partyplay_lobby_send_message(uuid, text) from public;
revoke all on function public.partyplay_lobby_set_ready(uuid, boolean) from public;
revoke all on function public.partyplay_lobby_kick_member(uuid, uuid) from public;
revoke all on function public.partyplay_invite_friend_to_room(uuid, uuid) from public;
revoke all on function public.partyplay_enforce_room_start_readiness() from public;
revoke all on function public.partyplay_fill_open_room_seat() from public;
revoke all on function public.partyplay_accept_game_invite(uuid) from public;
grant execute on function public.partyplay_lobby_list_messages(uuid, integer) to authenticated;
grant execute on function public.partyplay_lobby_send_message(uuid, text) to authenticated;
grant execute on function public.partyplay_lobby_set_ready(uuid, boolean) to authenticated;
grant execute on function public.partyplay_lobby_kick_member(uuid, uuid) to authenticated;
grant execute on function public.partyplay_invite_friend_to_room(uuid, uuid) to authenticated;
grant execute on function public.partyplay_accept_game_invite(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
