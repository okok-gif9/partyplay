begin;

create table if not exists public.pp_party_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.pp_rooms(id) on delete cascade,
  sender_id uuid not null references public.pp_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists pp_party_messages_room_created_idx on public.pp_party_messages(room_id, created_at desc);
alter table public.pp_party_messages enable row level security;
alter table public.pp_party_messages replica identity full;
drop policy if exists "pp_party_messages_visible_to_active_players" on public.pp_party_messages;
create policy "pp_party_messages_visible_to_active_players" on public.pp_party_messages
  for select to authenticated using (
    exists (select 1 from public.pp_rooms room join public.pp_room_members member on member.room_id=room.id
      where room.id=pp_party_messages.room_id and room.status='playing'
        and member.user_id=auth.uid() and member.role in ('host','player'))
  );
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pp_party_messages') then
    alter publication supabase_realtime add table public.pp_party_messages;
  end if;
end;
$$;

create or replace function public.partyplay_party_chat_list(p_room_id uuid, p_limit integer default 80)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.pp_rooms room join public.pp_room_members member on member.room_id=room.id
    where room.id=p_room_id and room.status='playing' and member.user_id=auth.uid() and member.role in ('host','player')
  ) then perform public.partyplay_social_error('NOT_A_MEMBER'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',message.id,'sender_id',message.sender_id,'sender_name',profile.display_name,
      'sender_avatar',profile.avatar_seed,'body',message.body,'created_at',message.created_at) order by message.created_at asc)
    from (select * from public.pp_party_messages where room_id=p_room_id order by created_at desc limit greatest(1,least(coalesce(p_limit,80),120))) message
    join public.pp_profiles profile on profile.id=message.sender_id
  ),'[]'::jsonb);
end;
$$;

create or replace function public.partyplay_party_chat_send(p_room_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_body text := btrim(coalesce(p_body,''));
  v_message public.pp_party_messages;
  v_profile public.pp_profiles;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if char_length(v_body)<1 or char_length(v_body)>500 then perform public.partyplay_social_error('INVALID_MESSAGE'); end if;
  if not exists (
    select 1 from public.pp_rooms room join public.pp_room_members member on member.room_id=room.id
    where room.id=p_room_id and room.status='playing' and member.user_id=auth.uid() and member.role in ('host','player')
  ) then perform public.partyplay_social_error('NOT_A_MEMBER'); end if;
  insert into public.pp_party_messages(room_id,sender_id,body) values(p_room_id,auth.uid(),v_body) returning * into v_message;
  select * into v_profile from public.pp_profiles where id=auth.uid();
  return jsonb_build_object('id',v_message.id,'sender_id',v_message.sender_id,'sender_name',v_profile.display_name,
    'sender_avatar',v_profile.avatar_seed,'body',v_message.body,'created_at',v_message.created_at);
end;
$$;

revoke all on function public.partyplay_party_chat_list(uuid,integer) from public;
revoke all on function public.partyplay_party_chat_send(uuid,text) from public;
grant execute on function public.partyplay_party_chat_list(uuid,integer) to authenticated;
grant execute on function public.partyplay_party_chat_send(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
