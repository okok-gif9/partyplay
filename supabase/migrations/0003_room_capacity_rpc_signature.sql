-- Ensure the browser RPC accepts JavaScript numeric values without a smallint overload ambiguity.

drop function if exists public.partyplay_create_room(text, text, smallint);

create function public.partyplay_create_room(
  p_game_type text,
  p_name text default 'دورهمی تازه',
  p_capacity integer default 2
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
  elsif coalesce(p_capacity, 0) < 2 or p_capacity > 12 then
    perform public.partyplay_game_error('INVALID_CAPACITY');
  end if;

  if char_length(v_name) < 2 then
    v_name := 'دورهمی تازه';
  end if;

  insert into public.pp_rooms (host_id, name, game_type, capacity)
  values (auth.uid(), left(v_name, 60), p_game_type, p_capacity::smallint)
  returning * into v_room;

  insert into public.pp_room_members (room_id, user_id, seat_no, role, ready)
  values (v_room.id, auth.uid(), 1, 'host', true);

  return public.partyplay_room_payload(v_room);
end;
$$;

revoke all on function public.partyplay_create_room(text, text, integer) from public;
grant execute on function public.partyplay_create_room(text, text, integer) to authenticated;
