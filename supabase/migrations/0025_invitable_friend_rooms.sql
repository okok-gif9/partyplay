begin;

create or replace function public.partyplay_create_friends_room(
  p_game_type text,
  p_name text,
  p_friend_ids uuid[],
  p_capacity smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.pp_rooms;
  v_friend_id uuid;
  v_capacity smallint := p_capacity;
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 60), '');
  v_invite public.pp_game_invites;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if p_friend_ids is null or cardinality(p_friend_ids) < 1 or cardinality(p_friend_ids) > 14 then
    perform public.partyplay_social_error('INVALID_FRIEND_SELECTION');
  end if;
  if (select count(distinct item) from unnest(p_friend_ids) item) <> cardinality(p_friend_ids)
     or auth.uid() = any(p_friend_ids) then perform public.partyplay_social_error('INVALID_FRIEND_SELECTION'); end if;
  if v_capacity is null or v_capacity < cardinality(p_friend_ids) + 1 or v_capacity > 15 then
    perform public.partyplay_game_error('INVALID_CAPACITY');
  end if;
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

revoke all on function public.partyplay_create_friends_room(text, text, uuid[], smallint) from public;
grant execute on function public.partyplay_create_friends_room(text, text, uuid[], smallint) to authenticated;
notify pgrst, 'reload schema';
commit;
