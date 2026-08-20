-- Public identity tiers are display metadata; pp_admins remains the sole source of administrative authority.

alter table public.pp_profiles
  add column if not exists membership_tier text not null default 'standard' check (membership_tier in ('standard', 'premium')),
  add column if not exists premium_until timestamptz,
  add column if not exists site_role text not null default 'member' check (site_role in ('member', 'site_admin')),
  add column if not exists profile_tagline text not null default '' check (char_length(profile_tagline) <= 80);

create index if not exists pp_profiles_premium_until_idx on public.pp_profiles(membership_tier, premium_until) where membership_tier = 'premium';

create or replace function public.partyplay_is_premium(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pp_profiles
    where id = p_user_id
      and membership_tier = 'premium'
      and (premium_until is null or premium_until > now())
  );
$$;

create or replace function public.partyplay_sync_admin_site_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.pp_profiles set site_role = 'site_admin' where id = new.user_id;
    return new;
  end if;
  update public.pp_profiles set site_role = 'member' where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists pp_sync_admin_site_role on public.pp_admins;
create trigger pp_sync_admin_site_role
after insert or delete on public.pp_admins
for each row execute procedure public.partyplay_sync_admin_site_role();

update public.pp_profiles profile
set site_role = case when exists (select 1 from public.pp_admins admin where admin.user_id = profile.id) then 'site_admin' else 'member' end;

-- Replaces the original entry-profile response with identity metadata that is safe to display publicly.
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
  v_is_premium boolean;
  v_is_admin boolean;
begin
  if auth.uid() is null then
    perform public.partyplay_game_error('NOT_AUTHENTICATED');
  end if;
  select * into v_user from auth.users where id = auth.uid();
  v_base_username := lower(regexp_replace(split_part(coalesce(v_user.email, 'player'), '@', 1), '[^a-z0-9_]+', '', 'g'));
  if char_length(v_base_username) < 3 then v_base_username := 'player'; end if;
  v_display_name := left(coalesce(nullif(btrim(p_display_name), ''), nullif(v_user.raw_user_meta_data ->> 'display_name', ''), 'بازیکن جدید'), 40);

  insert into public.pp_profiles (id, username, display_name, avatar_seed, presence)
  values (auth.uid(), left(v_base_username || '_' || substr(replace(auth.uid()::text, '-', ''), 1, 6), 24), v_display_name, 'mint', 'online')
  on conflict (id) do update
  set display_name = case when nullif(btrim(p_display_name), '') is not null then excluded.display_name else public.pp_profiles.display_name end,
      presence = 'online'
  returning * into v_profile;

  v_is_premium := public.partyplay_is_premium(v_profile.id);
  v_is_admin := public.partyplay_is_admin(v_profile.id);
  return jsonb_build_object(
    'id', v_profile.id, 'username', v_profile.username, 'display_name', v_profile.display_name,
    'avatar_seed', v_profile.avatar_seed, 'presence', v_profile.presence,
    'theme_preference', v_profile.theme_preference, 'allow_friend_requests', v_profile.allow_friend_requests,
    'membership_tier', case when v_is_premium then 'premium' else 'standard' end,
    'premium_until', v_profile.premium_until, 'is_verified', v_is_premium,
    'site_role', case when v_is_admin then 'site_admin' else 'member' end,
    'profile_tagline', case when v_is_premium or v_is_admin then v_profile.profile_tagline else '' end
  );
end;
$$;

-- Drop the former four-argument RPC so the browser must use the identity-aware version below.
drop function if exists public.partyplay_update_profile(text, text, text, boolean);
create or replace function public.partyplay_update_profile(
  p_display_name text default null,
  p_avatar_seed text default null,
  p_presence text default null,
  p_allow_friend_requests boolean default null,
  p_profile_tagline text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.pp_profiles;
  v_name text;
  v_tagline text;
  v_is_premium boolean;
  v_is_admin boolean;
  v_standard_avatar boolean;
  v_premium_avatar boolean;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_profile from public.pp_profiles where id = auth.uid() for update;
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;

  v_is_premium := public.partyplay_is_premium(auth.uid());
  v_is_admin := public.partyplay_is_admin(auth.uid());
  v_standard_avatar := p_avatar_seed is null or p_avatar_seed in ('mint', 'coral', 'sky', 'sun', 'orchid', 'lime', 'peach', 'navy', 'berry', 'aqua', 'plum', 'mango');
  v_premium_avatar := p_avatar_seed in ('nova', 'royal', 'comet', 'prism');
  if not v_standard_avatar and not v_premium_avatar then perform public.partyplay_social_error('INVALID_AVATAR'); end if;
  if v_premium_avatar and not (v_is_premium or v_is_admin) then perform public.partyplay_social_error('PREMIUM_FEATURE_REQUIRED'); end if;
  if p_presence is not null and p_presence not in ('online', 'away', 'busy', 'offline') then perform public.partyplay_social_error('INVALID_PRESENCE'); end if;

  v_name := nullif(left(btrim(coalesce(p_display_name, '')), 40), '');
  if p_display_name is not null and v_name is null then perform public.partyplay_social_error('INVALID_DISPLAY_NAME'); end if;
  v_tagline := left(btrim(coalesce(p_profile_tagline, '')), 80);
  if p_profile_tagline is not null and v_tagline <> '' and not (v_is_premium or v_is_admin) then perform public.partyplay_social_error('PREMIUM_FEATURE_REQUIRED'); end if;

  update public.pp_profiles
  set display_name = coalesce(v_name, display_name),
      avatar_seed = coalesce(p_avatar_seed, avatar_seed),
      presence = coalesce(p_presence, presence),
      allow_friend_requests = coalesce(p_allow_friend_requests, allow_friend_requests),
      profile_tagline = case when p_profile_tagline is null then profile_tagline else v_tagline end
  where id = auth.uid()
  returning * into v_profile;

  return jsonb_build_object(
    'id', v_profile.id, 'username', v_profile.username, 'display_name', v_profile.display_name,
    'avatar_seed', v_profile.avatar_seed, 'presence', v_profile.presence,
    'theme_preference', v_profile.theme_preference, 'allow_friend_requests', v_profile.allow_friend_requests,
    'membership_tier', case when v_is_premium then 'premium' else 'standard' end,
    'premium_until', v_profile.premium_until, 'is_verified', v_is_premium,
    'site_role', case when v_is_admin then 'site_admin' else 'member' end,
    'profile_tagline', case when v_is_premium or v_is_admin then v_profile.profile_tagline else '' end
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
  v_is_premium boolean;
  v_is_admin boolean;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_profile from public.pp_profiles where username = v_username;
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  v_is_premium := public.partyplay_is_premium(v_profile.id);
  v_is_admin := public.partyplay_is_admin(v_profile.id);
  return jsonb_build_object(
    'id', v_profile.id, 'username', v_profile.username, 'display_name', v_profile.display_name,
    'avatar_seed', v_profile.avatar_seed, 'presence', v_profile.presence,
    'membership_tier', case when v_is_premium then 'premium' else 'standard' end,
    'premium_until', v_profile.premium_until, 'is_verified', v_is_premium,
    'site_role', case when v_is_admin then 'site_admin' else 'member' end,
    'profile_tagline', case when v_is_premium or v_is_admin then v_profile.profile_tagline else '' end
  );
end;
$$;

create or replace function public.partyplay_admin_set_membership(
  p_user_id uuid,
  p_tier text,
  p_duration_days integer default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_profile public.pp_profiles;
  v_tier text := lower(btrim(coalesce(p_tier, '')));
  v_until timestamptz;
begin
  v_admin_id := public.partyplay_require_admin();
  if v_tier not in ('standard', 'premium') then perform public.partyplay_admin_error('INVALID_MEMBERSHIP_TIER'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 8 then perform public.partyplay_admin_error('MODERATION_REASON_REQUIRED'); end if;
  select * into v_profile from public.pp_profiles where id = p_user_id for update;
  if not found then perform public.partyplay_admin_error('USER_NOT_FOUND'); end if;

  if v_tier = 'premium' then
    if p_duration_days is not null and p_duration_days not in (30, 90, 365) then perform public.partyplay_admin_error('INVALID_PREMIUM_DURATION'); end if;
    v_until := case when p_duration_days is null then null else now() + make_interval(days => p_duration_days) end;
    update public.pp_profiles set membership_tier = 'premium', premium_until = v_until where id = p_user_id returning * into v_profile;
  else
    update public.pp_profiles
    set membership_tier = 'standard', premium_until = null, profile_tagline = '',
        avatar_seed = case when avatar_seed in ('nova', 'royal', 'comet', 'prism') then 'mint' else avatar_seed end
    where id = p_user_id returning * into v_profile;
  end if;

  insert into public.pp_account_action_events (actor_id, target_user_id, action, reason, metadata)
  values (v_admin_id, p_user_id, case when v_tier = 'premium' then 'premium_granted' else 'premium_revoked' end, btrim(p_reason), jsonb_build_object('tier', v_tier, 'premium_until', v_until));

  return jsonb_build_object(
    'membership_tier', case when public.partyplay_is_premium(v_profile.id) then 'premium' else 'standard' end,
    'premium_until', v_profile.premium_until,
    'is_verified', public.partyplay_is_premium(v_profile.id),
    'site_role', case when public.partyplay_is_admin(v_profile.id) then 'site_admin' else 'member' end
  );
end;
$$;

create or replace function public.partyplay_admin_session()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_admin_id uuid; v_profile public.pp_profiles;
begin
  v_admin_id := public.partyplay_require_admin();
  select * into v_profile from public.pp_profiles where id = v_admin_id;
  return jsonb_build_object('is_admin', true, 'profile', jsonb_build_object(
    'id', v_profile.id, 'display_name', v_profile.display_name, 'username', v_profile.username,
    'avatar_seed', v_profile.avatar_seed, 'site_role', 'site_admin', 'membership_tier',
    case when public.partyplay_is_premium(v_profile.id) then 'premium' else 'standard' end,
    'is_verified', public.partyplay_is_premium(v_profile.id)
  ));
end;
$$;

create or replace function public.partyplay_admin_users(p_query text default null, p_limit integer default 25, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_query text := lower(btrim(coalesce(p_query, ''))); v_limit integer := greatest(1, least(coalesce(p_limit, 25), 50)); v_offset integer := greatest(0, coalesce(p_offset, 0)); v_total integer; v_items jsonb;
begin
  perform public.partyplay_require_admin();
  if char_length(v_query) > 48 then perform public.partyplay_admin_error('INVALID_QUERY'); end if;
  select count(*) into v_total from public.pp_profiles profile where v_query = '' or lower(profile.username) like '%' || v_query || '%' or lower(profile.display_name) like '%' || v_query || '%';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'display_name', display_name, 'username', username, 'avatar_seed', avatar_seed, 'presence', presence,
    'created_at', created_at, 'room_count', room_count, 'completed_games', completed_games,
    'membership_tier', membership_tier, 'premium_until', premium_until, 'is_verified', is_verified, 'site_role', site_role
  ) order by created_at desc, username), '[]'::jsonb) into v_items
  from (
    select profile.id, profile.display_name, profile.username, profile.avatar_seed, profile.presence, profile.created_at,
      case when public.partyplay_is_premium(profile.id) then 'premium' else 'standard' end as membership_tier,
      profile.premium_until, public.partyplay_is_premium(profile.id) as is_verified,
      case when public.partyplay_is_admin(profile.id) then 'site_admin' else 'member' end as site_role,
      (select count(*)::integer from public.pp_room_members membership where membership.user_id = profile.id) as room_count,
      (select count(*)::integer from public.pp_room_members membership join public.pp_game_sessions session on session.room_id = membership.room_id where membership.user_id = profile.id and session.status = 'finished') as completed_games
    from public.pp_profiles profile
    where v_query = '' or lower(profile.username) like '%' || v_query || '%' or lower(profile.display_name) like '%' || v_query || '%'
    order by profile.created_at desc, profile.username limit v_limit offset v_offset
  ) filtered_profiles;
  return jsonb_build_object('items', v_items, 'total', coalesce(v_total, 0), 'limit', v_limit, 'offset', v_offset);
end;
$$;

create or replace function public.partyplay_admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_profile public.pp_profiles; v_email text; v_account_state jsonb; v_is_premium boolean; v_is_admin boolean;
begin
  perform public.partyplay_require_admin();
  select * into v_profile from public.pp_profiles where id = p_user_id;
  if not found then perform public.partyplay_admin_error('USER_NOT_FOUND'); end if;
  select email into v_email from auth.users where id = p_user_id;
  v_account_state := public.partyplay_account_access_state(p_user_id);
  v_is_premium := public.partyplay_is_premium(v_profile.id); v_is_admin := public.partyplay_is_admin(v_profile.id);
  return jsonb_build_object(
    'id', v_profile.id, 'display_name', v_profile.display_name, 'username', v_profile.username, 'avatar_seed', v_profile.avatar_seed, 'presence', v_profile.presence, 'created_at', v_profile.created_at, 'email', v_email,
    'room_count', (select count(*)::integer from public.pp_room_members where user_id = v_profile.id),
    'completed_games', (select count(*)::integer from public.pp_room_members membership join public.pp_game_sessions session on session.room_id = membership.room_id where membership.user_id = v_profile.id and session.status = 'finished'),
    'last_activity_at', (select max(created_at) from public.pp_game_events where actor_id = v_profile.id),
    'account_state', coalesce(v_account_state ->> 'state', 'active'), 'restricted_until', v_account_state -> 'restricted_until', 'purge_after', v_account_state -> 'purge_after', 'moderation_reason', v_account_state -> 'reason',
    'membership_tier', case when v_is_premium then 'premium' else 'standard' end, 'premium_until', v_profile.premium_until, 'is_verified', v_is_premium,
    'site_role', case when v_is_admin then 'site_admin' else 'member' end, 'profile_tagline', case when v_is_premium or v_is_admin then v_profile.profile_tagline else '' end
  );
end;
$$;

revoke all on function public.partyplay_update_profile(text, text, text, boolean, text) from public;
revoke all on function public.partyplay_lookup_profile(text) from public;
revoke all on function public.partyplay_admin_set_membership(uuid, text, integer, text) from public;
grant execute on function public.partyplay_update_profile(text, text, text, boolean, text) to authenticated;
grant execute on function public.partyplay_lookup_profile(text) to authenticated;
grant execute on function public.partyplay_admin_set_membership(uuid, text, integer, text) to authenticated;

notify pgrst, 'reload schema';
