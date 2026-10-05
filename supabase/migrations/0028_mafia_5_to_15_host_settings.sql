begin;

-- The core room table originally capped rooms at 12 players. Mafia now supports 5–15.
alter table public.pp_rooms drop constraint if exists pp_rooms_capacity_check;
alter table public.pp_rooms add constraint pp_rooms_capacity_check check (capacity between 2 and 15);

create or replace function public.partyplay_game_capacity_is_valid(p_game_type text, p_capacity smallint)
returns boolean language sql immutable as $$
  select case p_game_type
    when 'tic_tac_toe' then p_capacity = 2
    when 'connect_four' then p_capacity = 2
    when 'backgammon' then p_capacity = 2
    when 'uno' then p_capacity between 2 and 4
    when 'ludo' then p_capacity between 2 and 4
    when 'hokm' then p_capacity = 4
    when 'pictionary' then p_capacity between 3 and 8
    when 'spyfall' then p_capacity between 3 and 8
    when 'codenames' then p_capacity between 4 and 10
    when 'snakes_ladders' then p_capacity between 2 and 8
    when 'truth_or_dare' then p_capacity between 2 and 12
    when 'mafia' then p_capacity between 5 and 15
    else false
  end;
$$;

create or replace function public.partyplay_create_mafia_room(
  p_name text,
  p_capacity smallint,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_name text := left(btrim(coalesce(p_name,'')),60);
  v_settings jsonb;
  v_room jsonb;
  v_mafia_count integer;
  v_day_seconds integer;
  v_voting_seconds integer;
  v_doctor_enabled boolean;
  v_detective_enabled boolean;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  if p_capacity not between 5 and 15 then perform public.partyplay_mafia_error('NEED_EXACT_CAPACITY'); end if;
  if char_length(v_name)<2 then v_name := 'اتاق مافیا'; end if;
  v_day_seconds := case when coalesce(p_settings->>'day_seconds','') ~ '^[0-9]+$' then greatest(60,least(300,(p_settings->>'day_seconds')::integer)) else 180 end;
  v_voting_seconds := case when coalesce(p_settings->>'voting_seconds','') ~ '^[0-9]+$' then greatest(30,least(120,(p_settings->>'voting_seconds')::integer)) else 60 end;
  v_doctor_enabled := case when lower(coalesce(p_settings->>'doctor_enabled','true')) in ('true','false') then lower(coalesce(p_settings->>'doctor_enabled','true'))::boolean else true end;
  v_detective_enabled := case when lower(coalesce(p_settings->>'detective_enabled','true')) in ('true','false') then lower(coalesce(p_settings->>'detective_enabled','true'))::boolean else true end;
  v_mafia_count := case when coalesce(p_settings->>'mafia_count','') ~ '^[0-9]+$' then (p_settings->>'mafia_count')::integer else greatest(2,ceil(p_capacity::numeric/3)::integer) end;
  v_mafia_count := greatest(1,least(v_mafia_count,p_capacity::integer-(case when v_doctor_enabled then 1 else 0 end)-(case when v_detective_enabled then 1 else 0 end)-1));
  v_settings := jsonb_build_object('mafia_count',v_mafia_count,'doctor_enabled',v_doctor_enabled,'detective_enabled',v_detective_enabled,
    'day_seconds',v_day_seconds,'voting_seconds',v_voting_seconds,
    'reveal_on_death',case when lower(coalesce(p_settings->>'reveal_on_death','false')) in ('true','false') then lower(coalesce(p_settings->>'reveal_on_death','false'))::boolean else false end);
  v_room := public.partyplay_create_room('mafia',v_name,p_capacity);
  update public.pp_rooms set settings=v_settings where id=(v_room->>'id')::uuid and host_id=auth.uid();
  return v_room || jsonb_build_object('settings',v_settings);
end;
$$;

create or replace function public.partyplay_mafia_winner(p_session_id uuid)
returns text language plpgsql stable security definer set search_path=public as $$
declare
  v_mafia_count integer;
  v_city_count integer;
begin
  select count(*) filter(where is_alive and faction='mafia'),
         count(*) filter(where is_alive and faction='city')
    into v_mafia_count,v_city_count
    from public.pp_mafia_players where session_id=p_session_id;
  if coalesce(v_mafia_count,0)=0 then return 'city'; end if;
  if v_mafia_count >= coalesce(v_city_count,0) then return 'mafia'; end if;
  return null;
end;
$$;

create or replace function public.partyplay_start_mafia(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_room public.pp_rooms;
  v_session public.pp_game_sessions;
  v_players uuid[];
  v_roles text[] := array[]::text[];
  v_state jsonb;
  v_round integer := 1;
  v_player_count integer;
  v_mafia_count integer;
  v_role_limit integer;
  v_i integer;
  v_day_seconds integer;
  v_voting_seconds integer;
  v_doctor_enabled boolean;
  v_detective_enabled boolean;
  v_reveal_on_death boolean;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_room from public.pp_rooms where id=p_room_id for update;
  if not found then perform public.partyplay_mafia_error('ROOM_NOT_FOUND'); end if;
  if v_room.host_id<>auth.uid() then perform public.partyplay_mafia_error('NOT_HOST'); end if;
  if v_room.game_type<>'mafia' then perform public.partyplay_mafia_error('INVALID_GAME'); end if;
  if v_room.capacity not between 5 and 15 then perform public.partyplay_mafia_error('NEED_EXACT_CAPACITY'); end if;
  select array_agg(user_id order by random()),count(*) into v_players,v_player_count
    from public.pp_room_members where room_id=v_room.id and role in ('host','player');
  if v_player_count<>v_room.capacity then perform public.partyplay_mafia_error('NEED_EXACT_CAPACITY'); end if;

  v_doctor_enabled := coalesce((v_room.settings->>'doctor_enabled')::boolean,true);
  v_detective_enabled := coalesce((v_room.settings->>'detective_enabled')::boolean,true);
  v_role_limit := v_player_count-(case when v_doctor_enabled then 1 else 0 end)-(case when v_detective_enabled then 1 else 0 end)-1;
  v_mafia_count := case when coalesce(v_room.settings->>'mafia_count','') ~ '^[0-9]+$' then (v_room.settings->>'mafia_count')::integer else greatest(2,ceil(v_player_count::numeric/3)::integer) end;
  v_mafia_count := greatest(1,least(v_mafia_count,v_role_limit));
  v_day_seconds := greatest(60,least(300,coalesce((v_room.settings->>'day_seconds')::integer,180)));
  v_voting_seconds := greatest(30,least(120,coalesce((v_room.settings->>'voting_seconds')::integer,60)));
  v_reveal_on_death := coalesce((v_room.settings->>'reveal_on_death')::boolean,false);

  v_roles := array_append(v_roles,'godfather');
  if v_mafia_count>1 then for v_i in 2..v_mafia_count loop v_roles := array_append(v_roles,'mafia'); end loop; end if;
  if v_doctor_enabled then v_roles := array_append(v_roles,'doctor'); end if;
  if v_detective_enabled then v_roles := array_append(v_roles,'detective'); end if;
  v_roles := v_roles || array_fill('citizen'::text,array[v_player_count-cardinality(v_roles)]);
  if cardinality(v_roles)<>v_player_count then perform public.partyplay_mafia_error('INVALID_ROLE_SETTINGS'); end if;

  select * into v_session from public.pp_game_sessions where room_id=v_room.id for update;
  if found and v_session.status='running' then return public.partyplay_mafia_session_payload(v_session); end if;
  if found then v_round:=v_session.round_no+1; delete from public.pp_mafia_players where session_id=v_session.id; end if;
  v_state:=jsonb_build_object('phase','role_reveal','day_no',0,'alive_player_ids',to_jsonb(v_players),
    'speaker_order','[]'::jsonb,'speaker_index',0,'speaker_user_id',null,'speaker_mode',null,
    'speaker_deadline_at',null,'voting_deadline_at',null,'day_seconds',v_day_seconds,'voting_seconds',v_voting_seconds,
    'reveal_on_death',v_reveal_on_death,'narration','کارت نقش خودت را باز کن و برای ورود به بازی آماده شو.','winner_faction',null);
  if v_session.id is not null then
    update public.pp_game_sessions set game_type='mafia',status='running',round_no=v_round,turn_user_id=null,winner_id=null,version=0,finished_at=null,state=v_state
      where id=v_session.id returning * into v_session;
  else
    insert into public.pp_game_sessions(room_id,game_type,round_no,status,state,version)
      values(v_room.id,'mafia',v_round,'running',v_state,0) returning * into v_session;
  end if;
  insert into public.pp_mafia_players(session_id,user_id,role,faction)
    select v_session.id,v_players[position],v_roles[position],case when v_roles[position] in ('godfather','mafia') then 'mafia' else 'city' end
    from generate_subscripts(v_roles,1) as position;
  update public.pp_rooms set status='playing',started_at=now(),finished_at=null where id=v_room.id;
  insert into public.pp_game_events(session_id,actor_id,sequence_no,event_type,payload)
    values(v_session.id,auth.uid(),v_session.version,'mafia_started',jsonb_build_object('capacity',v_player_count,'settings',v_room.settings))
    on conflict(session_id,sequence_no) do nothing;
  return public.partyplay_mafia_session_payload(v_session);
end;
$$;

-- Apply configured discussion and voting windows whenever the server changes phase/speaker.
create or replace function public.partyplay_apply_mafia_timers()
returns trigger language plpgsql set search_path=public as $$
declare
  v_day_seconds integer;
  v_voting_seconds integer;
  v_setting_key text;
  v_phase text := coalesce(new.state->>'phase','');
  v_old_phase text := coalesce(old.state->>'phase','');
begin
  if new.game_type<>'mafia' or new.status<>'running' then return new; end if;
  foreach v_setting_key in array array['day_seconds','voting_seconds','reveal_on_death'] loop
    if old.state ? v_setting_key and not (new.state ? v_setting_key) then
      new.state:=jsonb_set(new.state,array[v_setting_key],old.state->v_setting_key,true);
    end if;
  end loop;
  v_day_seconds:=greatest(60,least(300,coalesce((new.state->>'day_seconds')::integer,180)));
  v_voting_seconds:=greatest(30,least(120,coalesce((new.state->>'voting_seconds')::integer,60)));
  if v_phase='day_speaking' and (v_old_phase<>'day_speaking' or old.state->>'speaker_user_id' is distinct from new.state->>'speaker_user_id') then
    new.state:=jsonb_set(new.state,'{speaker_deadline_at}',to_jsonb(now()+make_interval(secs=>v_day_seconds)),true);
  elsif v_phase='voting' and v_old_phase<>'voting' then
    new.state:=jsonb_set(new.state,'{voting_deadline_at}',to_jsonb(now()+make_interval(secs=>v_voting_seconds)),true);
  end if;
  return new;
end;
$$;
drop trigger if exists pp_game_sessions_mafia_timers on public.pp_game_sessions;
create trigger pp_game_sessions_mafia_timers before update of state on public.pp_game_sessions
  for each row execute function public.partyplay_apply_mafia_timers();

-- Dead Mafia players may read permitted spectator data, but cannot advance/write game state.
create or replace function public.partyplay_reject_mafia_spectator_actions()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.game_type='mafia' and old.status='running' and new.state is distinct from old.state then
    if auth.uid() is null or not exists(select 1 from public.pp_mafia_players where session_id=old.id and user_id=auth.uid() and is_alive) then
      raise exception using message='SPECTATOR_ONLY',errcode='P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists pp_game_sessions_mafia_living_actor on public.pp_game_sessions;
create trigger pp_game_sessions_mafia_living_actor before update of state on public.pp_game_sessions
  for each row execute function public.partyplay_reject_mafia_spectator_actions();

create or replace function public.partyplay_load_mafia_private_view(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_session public.pp_game_sessions;
  v_room public.pp_rooms;
  v_self public.pp_mafia_players;
  v_day integer;
  v_reveal_on_death boolean;
  v_revealed_roles jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then perform public.partyplay_mafia_error('NOT_AUTHENTICATED'); end if;
  select * into v_session from public.pp_game_sessions where id=p_session_id;
  if not found or v_session.game_type<>'mafia' then perform public.partyplay_mafia_error('SESSION_NOT_FOUND'); end if;
  select * into v_room from public.pp_rooms where id=v_session.room_id;
  if not exists(select 1 from public.pp_room_members where room_id=v_session.room_id and user_id=auth.uid()) then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  select * into v_self from public.pp_mafia_players where session_id=v_session.id and user_id=auth.uid();
  if not found then perform public.partyplay_mafia_error('NOT_A_MEMBER'); end if;
  v_day:=greatest(1,coalesce((v_session.state->>'day_no')::integer,1));
  v_reveal_on_death:=coalesce((v_room.settings->>'reveal_on_death')::boolean,false);
  if coalesce(v_session.state->>'phase','')='finished' or v_reveal_on_death then
    select coalesce(jsonb_agg(jsonb_build_object('user_id',player.user_id,'display_name',profile.display_name,'role',player.role,'faction',player.faction,'is_alive',player.is_alive)
      order by case when player.faction='mafia' then 0 else 1 end,profile.display_name),'[]'::jsonb)
      into v_revealed_roles from public.pp_mafia_players player join public.pp_profiles profile on profile.id=player.user_id
      where player.session_id=v_session.id and (coalesce(v_session.state->>'phase','')='finished' or not player.is_alive);
  end if;
  return jsonb_build_object(
    'self',jsonb_build_object('role',v_self.role,'faction',v_self.faction,'is_alive',v_self.is_alive,'role_acknowledged',v_self.role_acknowledged,'doctor_self_save_used',v_self.doctor_self_save_used),
    'teammates',case when v_self.faction='mafia' then coalesce((select jsonb_agg(jsonb_build_object('user_id',player.user_id,'display_name',profile.display_name,'role',player.role,'is_alive',player.is_alive) order by profile.display_name)
      from public.pp_mafia_players player join public.pp_profiles profile on profile.id=player.user_id where player.session_id=v_session.id and player.faction='mafia'),'[]'::jsonb) else '[]'::jsonb end,
    'detective_result',case when v_self.role='detective' then (select result from public.pp_mafia_night_actions where session_id=v_session.id and day_no=v_day and actor_id=auth.uid() and action_type='detective_check') else null end,
    'revealed_roles',v_revealed_roles);
end;
$$;

revoke all on function public.partyplay_create_mafia_room(text,smallint,jsonb) from public;
grant execute on function public.partyplay_create_mafia_room(text,smallint,jsonb) to authenticated;
revoke all on function public.partyplay_start_mafia(uuid) from public;
grant execute on function public.partyplay_start_mafia(uuid) to authenticated;
revoke all on function public.partyplay_load_mafia_private_view(uuid) from public;
grant execute on function public.partyplay_load_mafia_private_view(uuid) to authenticated;
revoke all on function public.partyplay_mafia_winner(uuid) from public;
notify pgrst,'reload schema';
commit;
