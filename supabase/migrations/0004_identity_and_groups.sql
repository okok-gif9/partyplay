-- PartyPlay identity hydration and real group creation.

create or replace function public.partyplay_ensure_profile(p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users;
  v_profile public.pp_profiles;
  v_base_username text;
  v_display_name text;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  select * into v_user from auth.users where id = auth.uid();
  v_base_username := lower(regexp_replace(split_part(coalesce(v_user.email, 'player'), '@', 1), '[^a-z0-9_]+', '', 'g'));
  if char_length(v_base_username) < 3 then
    v_base_username := 'player';
  end if;
  v_display_name := left(coalesce(nullif(btrim(p_display_name), ''), nullif(v_user.raw_user_meta_data ->> 'display_name', ''), 'بازیکن جدید'), 40);

  insert into public.pp_profiles (id, username, display_name, avatar_seed, presence)
  values (
    auth.uid(),
    left(v_base_username || '_' || substr(replace(auth.uid()::text, '-', ''), 1, 6), 24),
    v_display_name,
    'spark',
    'online'
  )
  on conflict (id) do update
  set display_name = case
        when nullif(btrim(p_display_name), '') is not null then excluded.display_name
        else public.pp_profiles.display_name
      end,
      presence = 'online'
  returning * into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'avatar_seed', v_profile.avatar_seed,
    'presence', v_profile.presence,
    'theme_preference', v_profile.theme_preference
  );
end;
$$;

create or replace function public.partyplay_create_group(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.pp_groups;
  v_name text := left(btrim(coalesce(p_name, '')), 40);
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;

  if char_length(v_name) < 2 then
    perform public.partyplay_game_error('INVALID_GROUP_NAME');
  end if;

  insert into public.pp_groups (owner_id, name)
  values (auth.uid(), v_name)
  returning * into v_group;

  insert into public.pp_group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'owner');

  return jsonb_build_object(
    'id', v_group.id,
    'name', v_group.name,
    'description', v_group.description,
    'avatar_seed', v_group.avatar_seed,
    'created_at', v_group.created_at
  );
end;
$$;

revoke all on function public.partyplay_ensure_profile(text) from public;
revoke all on function public.partyplay_create_group(text) from public;
grant execute on function public.partyplay_ensure_profile(text) to authenticated;
grant execute on function public.partyplay_create_group(text) to authenticated;
