-- PartyPlay social identity: profile settings, friend requests and direct group membership.
-- Applied after 0004_identity_and_groups.sql.

create or replace function public.partyplay_social_error(p_code text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception '%', p_code using errcode = 'P0001';
end;
$$;

create or replace function public.partyplay_update_profile(
  p_display_name text default null,
  p_avatar_seed text default null,
  p_presence text default null,
  p_allow_friend_requests boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.pp_profiles;
  v_name text;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;

  if p_avatar_seed is not null and p_avatar_seed not in (
    'mint', 'coral', 'sky', 'sun', 'orchid', 'lime',
    'peach', 'navy', 'berry', 'aqua', 'plum', 'mango'
  ) then
    perform public.partyplay_social_error('INVALID_AVATAR');
  end if;

  if p_presence is not null and p_presence not in ('online', 'away', 'busy', 'offline') then
    perform public.partyplay_social_error('INVALID_PRESENCE');
  end if;

  v_name := nullif(left(btrim(coalesce(p_display_name, '')), 40), '');
  if p_display_name is not null and v_name is null then
    perform public.partyplay_social_error('INVALID_DISPLAY_NAME');
  end if;

  update public.pp_profiles
  set display_name = coalesce(v_name, display_name),
      avatar_seed = coalesce(p_avatar_seed, avatar_seed),
      presence = coalesce(p_presence, presence),
      allow_friend_requests = coalesce(p_allow_friend_requests, allow_friend_requests)
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    perform public.partyplay_social_error('PROFILE_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'avatar_seed', v_profile.avatar_seed,
    'presence', v_profile.presence,
    'theme_preference', v_profile.theme_preference,
    'allow_friend_requests', v_profile.allow_friend_requests
  );
end;
$$;

create or replace function public.partyplay_lookup_profile(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.pp_profiles;
  v_username text := lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;

  select * into v_profile
  from public.pp_profiles
  where username = v_username;

  if not found then
    perform public.partyplay_social_error('PROFILE_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'avatar_seed', v_profile.avatar_seed,
    'presence', v_profile.presence
  );
end;
$$;

create or replace function public.partyplay_send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.pp_profiles;
  v_request public.pp_friend_requests;
  v_low uuid;
  v_high uuid;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;

  select * into v_target
  from public.pp_profiles
  where username = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));

  if not found then
    perform public.partyplay_social_error('PROFILE_NOT_FOUND');
  end if;
  if v_target.id = auth.uid() then
    perform public.partyplay_social_error('CANNOT_ADD_SELF');
  end if;
  if not v_target.allow_friend_requests then
    perform public.partyplay_social_error('FRIEND_REQUESTS_DISABLED');
  end if;

  v_low := least(auth.uid(), v_target.id);
  v_high := greatest(auth.uid(), v_target.id);
  if exists (select 1 from public.pp_friendships where user_a = v_low and user_b = v_high) then
    perform public.partyplay_social_error('ALREADY_FRIENDS');
  end if;

  select * into v_request from public.pp_friend_requests
  where (requester_id = auth.uid() and addressee_id = v_target.id)
     or (requester_id = v_target.id and addressee_id = auth.uid())
  order by created_at desc limit 1;

  if found and v_request.status = 'pending' then
    perform public.partyplay_social_error('REQUEST_ALREADY_PENDING');
  end if;

  insert into public.pp_friend_requests (requester_id, addressee_id, status, responded_at)
  values (auth.uid(), v_target.id, 'pending', null)
  on conflict (requester_id, addressee_id)
  do update set status = 'pending', responded_at = null, created_at = now()
  returning * into v_request;

  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'target_name', v_target.display_name);
end;
$$;

create or replace function public.partyplay_respond_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.pp_friend_requests;
  v_low uuid;
  v_high uuid;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;

  select * into v_request
  from public.pp_friend_requests
  where id = p_request_id and addressee_id = auth.uid() and status = 'pending'
  for update;

  if not found then
    perform public.partyplay_social_error('REQUEST_NOT_ACTIONABLE');
  end if;

  update public.pp_friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = v_request.id;

  if p_accept then
    v_low := least(v_request.requester_id, v_request.addressee_id);
    v_high := greatest(v_request.requester_id, v_request.addressee_id);
    insert into public.pp_friendships (user_a, user_b)
    values (v_low, v_high)
    on conflict do nothing;
  end if;

  return jsonb_build_object('id', v_request.id, 'status', case when p_accept then 'accepted' else 'declined' end);
end;
$$;

create or replace function public.partyplay_remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;

  delete from public.pp_friendships
  where user_a = least(auth.uid(), p_friend_id)
    and user_b = greatest(auth.uid(), p_friend_id);
end;
$$;

create or replace function public.partyplay_add_group_member(p_group_id uuid, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_target public.pp_profiles;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;

  select role into v_role
  from public.pp_group_members
  where group_id = p_group_id and user_id = auth.uid();

  if v_role not in ('owner', 'admin') then
    perform public.partyplay_social_error('GROUP_PERMISSION_DENIED');
  end if;

  select * into v_target
  from public.pp_profiles
  where username = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));

  if not found then
    perform public.partyplay_social_error('PROFILE_NOT_FOUND');
  end if;

  insert into public.pp_group_members (group_id, user_id, role)
  values (p_group_id, v_target.id, 'member')
  on conflict (group_id, user_id) do nothing;

  return jsonb_build_object(
    'id', v_target.id,
    'display_name', v_target.display_name,
    'username', v_target.username,
    'avatar_seed', v_target.avatar_seed
  );
end;
$$;

create or replace function public.partyplay_update_group_identity(
  p_group_id uuid,
  p_name text default null,
  p_description text default null,
  p_avatar_seed text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.pp_groups;
  v_role text;
  v_name text;
  v_description text;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;

  select role into v_role from public.pp_group_members
  where group_id = p_group_id and user_id = auth.uid();
  if v_role not in ('owner', 'admin') then
    perform public.partyplay_social_error('GROUP_PERMISSION_DENIED');
  end if;

  if p_avatar_seed is not null and p_avatar_seed not in ('ring', 'flag', 'planet', 'cube', 'star', 'compass', 'spark', 'prism') then
    perform public.partyplay_social_error('INVALID_GROUP_AVATAR');
  end if;

  v_name := nullif(left(btrim(coalesce(p_name, '')), 40), '');
  v_description := left(btrim(coalesce(p_description, '')), 180);
  if p_name is not null and v_name is null then
    perform public.partyplay_social_error('INVALID_GROUP_NAME');
  end if;

  update public.pp_groups
  set name = coalesce(v_name, name),
      description = case when p_description is null then description else v_description end,
      avatar_seed = coalesce(p_avatar_seed, avatar_seed)
  where id = p_group_id
  returning * into v_group;

  return jsonb_build_object('id', v_group.id, 'name', v_group.name, 'description', v_group.description, 'avatar_seed', v_group.avatar_seed);
end;
$$;

revoke all on function public.partyplay_update_profile(text, text, text, boolean) from public;
revoke all on function public.partyplay_lookup_profile(text) from public;
revoke all on function public.partyplay_send_friend_request(text) from public;
revoke all on function public.partyplay_respond_friend_request(uuid, boolean) from public;
revoke all on function public.partyplay_remove_friend(uuid) from public;
revoke all on function public.partyplay_add_group_member(uuid, text) from public;
revoke all on function public.partyplay_update_group_identity(uuid, text, text, text) from public;

grant execute on function public.partyplay_update_profile(text, text, text, boolean) to authenticated;
grant execute on function public.partyplay_lookup_profile(text) to authenticated;
grant execute on function public.partyplay_send_friend_request(text) to authenticated;
grant execute on function public.partyplay_respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.partyplay_remove_friend(uuid) to authenticated;
grant execute on function public.partyplay_add_group_member(uuid, text) to authenticated;
grant execute on function public.partyplay_update_group_identity(uuid, text, text, text) to authenticated;
