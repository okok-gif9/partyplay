-- Keep membership checks inside SECURITY DEFINER helpers. Policies must not query
-- the RLS-protected membership table directly, because that creates policy recursion.
create or replace function public.partyplay_is_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from public.pp_room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

create or replace function public.partyplay_is_session_member(p_session_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.pp_game_sessions session
    join public.pp_room_members membership on membership.room_id = session.room_id
    where session.id = p_session_id and membership.user_id = p_user_id
  );
$$;

create or replace function public.partyplay_is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from public.pp_group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

revoke all on function public.partyplay_is_room_member(uuid, uuid) from public;
revoke all on function public.partyplay_is_session_member(uuid, uuid) from public;
revoke all on function public.partyplay_is_group_member(uuid, uuid) from public;
grant execute on function public.partyplay_is_room_member(uuid, uuid) to authenticated;
grant execute on function public.partyplay_is_session_member(uuid, uuid) to authenticated;
grant execute on function public.partyplay_is_group_member(uuid, uuid) to authenticated;

drop policy if exists "pp_groups_visible_to_members" on public.pp_groups;
create policy "pp_groups_visible_to_members" on public.pp_groups
for select to authenticated using (
  owner_id = auth.uid() or public.partyplay_is_group_member(id)
);

drop policy if exists "pp_group_members_visible_to_members" on public.pp_group_members;
create policy "pp_group_members_visible_to_members" on public.pp_group_members
for select to authenticated using (
  user_id = auth.uid() or public.partyplay_is_group_member(group_id)
);

drop policy if exists "pp_rooms_visible_to_members_or_public" on public.pp_rooms;
create policy "pp_rooms_visible_to_members_or_public" on public.pp_rooms
for select to authenticated using (
  visibility = 'public' or host_id = auth.uid() or public.partyplay_is_room_member(id)
);

drop policy if exists "pp_room_members_visible_to_room_members" on public.pp_room_members;
create policy "pp_room_members_visible_to_room_members" on public.pp_room_members
for select to authenticated using (
  user_id = auth.uid() or public.partyplay_is_room_member(room_id)
);

drop policy if exists "pp_game_sessions_visible_to_room_members" on public.pp_game_sessions;
create policy "pp_game_sessions_visible_to_room_members" on public.pp_game_sessions
for select to authenticated using (public.partyplay_is_room_member(room_id));

drop policy if exists "pp_game_events_visible_to_room_members" on public.pp_game_events;
create policy "pp_game_events_visible_to_room_members" on public.pp_game_events
for select to authenticated using (public.partyplay_is_session_member(session_id));

drop policy if exists "pp_room_messages_visible_to_room_members" on public.pp_room_messages;
create policy "pp_room_messages_visible_to_room_members" on public.pp_room_messages
for select to authenticated using (public.partyplay_is_room_member(room_id));

drop policy if exists "pp_room_messages_send_as_self" on public.pp_room_messages;
create policy "pp_room_messages_send_as_self" on public.pp_room_messages
for insert to authenticated with check (
  sender_id = auth.uid() and public.partyplay_is_room_member(room_id)
);

drop policy if exists "pp_message_reactions_visible_to_room_members" on public.pp_room_message_reactions;
create policy "pp_message_reactions_visible_to_room_members" on public.pp_room_message_reactions
for select to authenticated using (exists (
  select 1 from public.pp_room_messages message
  where message.id = pp_room_message_reactions.message_id
    and public.partyplay_is_room_member(message.room_id)
));

drop policy if exists "pp_mafia_reactions_visible_to_room" on public.pp_mafia_speaker_reactions;
create policy "pp_mafia_reactions_visible_to_room" on public.pp_mafia_speaker_reactions
for select to authenticated using (public.partyplay_is_session_member(session_id));

notify pgrst, 'reload schema';
