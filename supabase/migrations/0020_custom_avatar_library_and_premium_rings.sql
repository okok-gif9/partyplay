-- PartyPlay custom avatar library and premium neon rings.
-- Storage remains public only because profile images are public identity data; writes are server-checked for administrators.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partyplay-avatars', 'partyplay-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.pp_avatar_library (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 2 and 48),
  asset_path text not null unique check (asset_path ~ '^library/[a-z0-9._-]+\.(png|jpg|jpeg|webp|gif)$'),
  tier text not null default 'standard' check (tier in ('standard', 'premium')),
  is_active boolean not null default true,
  created_by uuid not null references public.pp_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pp_avatar_library_active_idx on public.pp_avatar_library(is_active, tier, created_at desc);
alter table public.pp_avatar_library enable row level security;

alter table public.pp_profiles
  add column if not exists custom_avatar_path text,
  add column if not exists avatar_asset_path text,
  add column if not exists avatar_library_id uuid references public.pp_avatar_library(id) on delete set null,
  add column if not exists premium_ring_enabled boolean not null default false,
  add column if not exists premium_ring_color text not null default 'violet' check (premium_ring_color in ('violet', 'cyan', 'pink', 'gold', 'aurora'));

alter table public.pp_profiles
  drop constraint if exists pp_profiles_custom_avatar_path_check;
alter table public.pp_profiles
  add constraint pp_profiles_custom_avatar_path_check check (custom_avatar_path is null or custom_avatar_path ~ '^custom/[0-9a-f-]{36}/profile\.(png|jpg|jpeg|webp|gif)$');

-- Public display uses a stable public bucket. All write policies require the server-backed admin role.
drop policy if exists partyplay_avatar_storage_read on storage.objects;
drop policy if exists partyplay_avatar_storage_insert on storage.objects;
drop policy if exists partyplay_avatar_storage_update on storage.objects;
drop policy if exists partyplay_avatar_storage_delete on storage.objects;

create policy partyplay_avatar_storage_read on storage.objects
for select to public using (bucket_id = 'partyplay-avatars');

create policy partyplay_avatar_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'partyplay-avatars'
  and public.partyplay_is_admin(auth.uid())
  and (
    (storage.foldername(name))[1] = 'library'
    or ((storage.foldername(name))[1] = 'custom' and (storage.foldername(name))[2] = auth.uid()::text)
  )
);

create policy partyplay_avatar_storage_update on storage.objects
for update to authenticated using (
  bucket_id = 'partyplay-avatars' and public.partyplay_is_admin(auth.uid())
) with check (
  bucket_id = 'partyplay-avatars'
  and public.partyplay_is_admin(auth.uid())
  and (
    (storage.foldername(name))[1] = 'library'
    or ((storage.foldername(name))[1] = 'custom' and (storage.foldername(name))[2] = auth.uid()::text)
  )
);

create policy partyplay_avatar_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'partyplay-avatars' and public.partyplay_is_admin(auth.uid())
);

create or replace function public.partyplay_avatar_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_premium boolean := public.partyplay_is_premium(auth.uid());
  v_is_admin boolean := public.partyplay_is_admin(auth.uid());
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id, 'label', item.label, 'asset_path', item.asset_path,
      'tier', item.tier, 'can_use', item.tier = 'standard' or v_is_premium or v_is_admin
    ) order by case when item.tier = 'standard' then 0 else 1 end, item.created_at desc), '[]'::jsonb)
    from public.pp_avatar_library item
    where item.is_active
  );
end;
$$;

create or replace function public.partyplay_admin_avatar_library()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.partyplay_require_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id, 'label', item.label, 'asset_path', item.asset_path,
      'tier', item.tier, 'is_active', item.is_active, 'created_at', item.created_at
    ) order by item.is_active desc, item.created_at desc), '[]'::jsonb)
    from public.pp_avatar_library item
  );
end;
$$;

create or replace function public.partyplay_admin_register_avatar(
  p_label text,
  p_asset_path text,
  p_tier text default 'standard'
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_admin_id uuid := public.partyplay_require_admin();
  v_avatar public.pp_avatar_library;
  v_label text := left(btrim(coalesce(p_label, '')), 48);
  v_path text := lower(btrim(coalesce(p_asset_path, '')));
  v_tier text := lower(btrim(coalesce(p_tier, 'standard')));
begin
  if char_length(v_label) < 2 then perform public.partyplay_admin_error('INVALID_AVATAR_FILE'); end if;
  if v_tier not in ('standard', 'premium') then perform public.partyplay_admin_error('INVALID_AVATAR_TIER'); end if;
  if v_path !~ '^library/[a-z0-9._-]+\.(png|jpg|jpeg|webp|gif)$' then perform public.partyplay_admin_error('INVALID_AVATAR_FILE'); end if;
  if not exists (select 1 from storage.objects where bucket_id = 'partyplay-avatars' and name = v_path) then perform public.partyplay_admin_error('INVALID_AVATAR_FILE'); end if;

  insert into public.pp_avatar_library(label, asset_path, tier, created_by)
  values (v_label, v_path, v_tier, v_admin_id)
  returning * into v_avatar;
  insert into public.pp_admin_audit_events(admin_id, event_type, payload)
  values (v_admin_id, 'avatar_library_added', jsonb_build_object('avatar_id', v_avatar.id, 'tier', v_avatar.tier));
  return jsonb_build_object('id', v_avatar.id, 'label', v_avatar.label, 'asset_path', v_avatar.asset_path, 'tier', v_avatar.tier, 'is_active', v_avatar.is_active);
end;
$$;

create or replace function public.partyplay_admin_update_avatar(
  p_avatar_id uuid,
  p_label text default null,
  p_tier text default null,
  p_is_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.partyplay_require_admin();
  v_avatar public.pp_avatar_library;
  v_label text := case when p_label is null then null else left(btrim(p_label), 48) end;
  v_tier text := case when p_tier is null then null else lower(btrim(p_tier)) end;
begin
  if v_tier is not null and v_tier not in ('standard', 'premium') then perform public.partyplay_admin_error('INVALID_AVATAR_TIER'); end if;
  if p_label is not null and char_length(coalesce(v_label, '')) < 2 then perform public.partyplay_admin_error('INVALID_AVATAR_FILE'); end if;
  update public.pp_avatar_library
  set label = coalesce(v_label, label), tier = coalesce(v_tier, tier), is_active = coalesce(p_is_active, is_active), updated_at = now()
  where id = p_avatar_id
  returning * into v_avatar;
  if not found then perform public.partyplay_admin_error('AVATAR_NOT_FOUND'); end if;

  if not v_avatar.is_active then
    update public.pp_profiles set avatar_library_id = null, avatar_asset_path = null, avatar_seed = 'mint' where avatar_library_id = v_avatar.id;
  elsif v_avatar.tier = 'premium' then
    update public.pp_profiles profile set avatar_library_id = null, avatar_asset_path = null, avatar_seed = 'mint'
    where avatar_library_id = v_avatar.id and not (public.partyplay_is_premium(profile.id) or public.partyplay_is_admin(profile.id));
  end if;
  insert into public.pp_admin_audit_events(admin_id, event_type, payload)
  values (v_admin_id, 'avatar_library_updated', jsonb_build_object('avatar_id', v_avatar.id, 'tier', v_avatar.tier, 'is_active', v_avatar.is_active));
  return jsonb_build_object('id', v_avatar.id, 'label', v_avatar.label, 'asset_path', v_avatar.asset_path, 'tier', v_avatar.tier, 'is_active', v_avatar.is_active);
end;
$$;

create or replace function public.partyplay_admin_set_custom_avatar(p_asset_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_admin_id uuid := public.partyplay_require_admin();
  v_path text := lower(btrim(coalesce(p_asset_path, '')));
begin
  if v_path !~ ('^custom/' || v_admin_id::text || '/profile\.(png|jpg|jpeg|webp|gif)$') then perform public.partyplay_admin_error('INVALID_AVATAR_FILE'); end if;
  if not exists (select 1 from storage.objects where bucket_id = 'partyplay-avatars' and name = v_path) then perform public.partyplay_admin_error('INVALID_AVATAR_FILE'); end if;
  update public.pp_profiles set custom_avatar_path = v_path, avatar_asset_path = v_path, avatar_library_id = null, avatar_seed = 'mint' where id = v_admin_id;
  insert into public.pp_admin_audit_events(admin_id, event_type, target_user_id, payload)
  values (v_admin_id, 'custom_avatar_set', v_admin_id, jsonb_build_object('asset_path', v_path));
  return jsonb_build_object('asset_path', v_path);
end;
$$;

drop function if exists public.partyplay_update_profile(text, text, text, boolean, text);
create or replace function public.partyplay_update_profile(
  p_display_name text default null,
  p_avatar_seed text default null,
  p_presence text default null,
  p_allow_friend_requests boolean default null,
  p_profile_tagline text default null,
  p_avatar_library_id uuid default null,
  p_avatar_mode text default null,
  p_premium_ring_enabled boolean default null,
  p_premium_ring_color text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.pp_profiles;
  v_library public.pp_avatar_library;
  v_name text;
  v_tagline text;
  v_ring_color text := lower(btrim(coalesce(p_premium_ring_color, 'violet')));
  v_is_premium boolean;
  v_is_admin boolean;
  v_mode text := lower(btrim(coalesce(p_avatar_mode, '')));
  v_asset_path text;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_profile from public.pp_profiles where id = auth.uid() for update;
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  v_is_premium := public.partyplay_is_premium(auth.uid());
  v_is_admin := public.partyplay_is_admin(auth.uid());
  if p_presence is not null and p_presence not in ('online', 'away', 'busy', 'offline') then perform public.partyplay_social_error('INVALID_PRESENCE'); end if;
  v_name := nullif(left(btrim(coalesce(p_display_name, '')), 40), '');
  if p_display_name is not null and v_name is null then perform public.partyplay_social_error('INVALID_DISPLAY_NAME'); end if;
  v_tagline := left(btrim(coalesce(p_profile_tagline, '')), 80);
  if p_profile_tagline is not null and v_tagline <> '' and not (v_is_premium or v_is_admin) then perform public.partyplay_social_error('PREMIUM_FEATURE_REQUIRED'); end if;

  if v_mode = 'seed' or (v_mode = '' and p_avatar_seed is not null) then
    if p_avatar_seed not in ('mint', 'coral', 'sky', 'sun', 'orchid', 'lime', 'peach', 'navy', 'berry', 'aqua', 'plum', 'mango', 'nova', 'royal', 'comet', 'prism') then perform public.partyplay_social_error('INVALID_AVATAR'); end if;
    if p_avatar_seed in ('nova', 'royal', 'comet', 'prism') and not (v_is_premium or v_is_admin) then perform public.partyplay_social_error('PREMIUM_FEATURE_REQUIRED'); end if;
    update public.pp_profiles set avatar_seed = p_avatar_seed, avatar_asset_path = null, avatar_library_id = null where id = auth.uid();
  elsif v_mode = 'library' then
    if p_avatar_library_id is null then perform public.partyplay_social_error('AVATAR_NOT_FOUND'); end if;
    select * into v_library from public.pp_avatar_library where id = p_avatar_library_id and is_active for update;
    if not found then perform public.partyplay_social_error('AVATAR_NOT_FOUND'); end if;
    if v_library.tier = 'premium' and not (v_is_premium or v_is_admin) then perform public.partyplay_social_error('PREMIUM_FEATURE_REQUIRED'); end if;
    update public.pp_profiles set avatar_library_id = v_library.id, avatar_asset_path = v_library.asset_path, avatar_seed = 'mint' where id = auth.uid();
  elsif v_mode = 'custom' then
    if not v_is_admin or v_profile.custom_avatar_path is null then perform public.partyplay_social_error('NOT_ADMIN'); end if;
    update public.pp_profiles set avatar_library_id = null, avatar_asset_path = v_profile.custom_avatar_path, avatar_seed = 'mint' where id = auth.uid();
  elsif v_mode <> '' then
    perform public.partyplay_social_error('INVALID_AVATAR');
  end if;

  if p_premium_ring_enabled is not null then
    if p_premium_ring_enabled and not (v_is_premium or v_is_admin) then perform public.partyplay_social_error('PREMIUM_FEATURE_REQUIRED'); end if;
    if v_ring_color not in ('violet', 'cyan', 'pink', 'gold', 'aurora') then perform public.partyplay_social_error('INVALID_RING_COLOR'); end if;
  end if;

  update public.pp_profiles
  set display_name = coalesce(v_name, display_name), presence = coalesce(p_presence, presence),
      allow_friend_requests = coalesce(p_allow_friend_requests, allow_friend_requests),
      profile_tagline = case when p_profile_tagline is null then profile_tagline else v_tagline end,
      premium_ring_enabled = case when p_premium_ring_enabled is null then premium_ring_enabled else p_premium_ring_enabled end,
      premium_ring_color = case when p_premium_ring_color is null then premium_ring_color else v_ring_color end
  where id = auth.uid()
  returning * into v_profile;

  select item.asset_path into v_asset_path from public.pp_avatar_library item where item.id = v_profile.avatar_library_id and item.is_active;
  if v_profile.avatar_library_id is not null and v_asset_path is null then update public.pp_profiles set avatar_library_id = null, avatar_asset_path = null, avatar_seed = 'mint' where id = auth.uid() returning * into v_profile; end if;
  return jsonb_build_object(
    'id', v_profile.id, 'username', v_profile.username, 'display_name', v_profile.display_name, 'avatar_seed', v_profile.avatar_seed,
    'avatar_asset_path', v_profile.avatar_asset_path,
    'avatar_source', case when v_profile.avatar_asset_path is null then 'seed' when v_profile.avatar_library_id is not null then 'library' else 'custom' end,
    'presence', v_profile.presence, 'theme_preference', v_profile.theme_preference, 'allow_friend_requests', v_profile.allow_friend_requests,
    'membership_tier', case when v_is_premium then 'premium' else 'standard' end, 'premium_until', v_profile.premium_until, 'is_verified', v_is_premium,
    'site_role', case when v_is_admin then 'site_admin' else 'member' end, 'profile_tagline', case when v_is_premium or v_is_admin then v_profile.profile_tagline else '' end,
    'premium_ring_enabled', v_profile.premium_ring_enabled and (v_is_premium or v_is_admin), 'premium_ring_color', v_profile.premium_ring_color
  );
end;
$$;

create or replace function public.partyplay_ensure_profile(p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users; v_profile public.pp_profiles; v_base_username text; v_display_name text; v_is_premium boolean; v_is_admin boolean; v_asset_path text;
begin
  if auth.uid() is null then perform public.partyplay_game_error('NOT_AUTHENTICATED'); end if;
  select * into v_user from auth.users where id = auth.uid();
  v_base_username := lower(regexp_replace(split_part(coalesce(v_user.email, 'player'), '@', 1), '[^a-z0-9_]+', '', 'g'));
  if char_length(v_base_username) < 3 then v_base_username := 'player'; end if;
  v_display_name := left(coalesce(nullif(btrim(p_display_name), ''), nullif(v_user.raw_user_meta_data ->> 'display_name', ''), 'بازیکن جدید'), 40);
  insert into public.pp_profiles (id, username, display_name, avatar_seed, presence) values (auth.uid(), left(v_base_username || '_' || substr(replace(auth.uid()::text, '-', ''), 1, 6), 24), v_display_name, 'mint', 'online')
  on conflict (id) do update set display_name = case when nullif(btrim(p_display_name), '') is not null then excluded.display_name else public.pp_profiles.display_name end, presence = 'online'
  returning * into v_profile;
  v_is_premium := public.partyplay_is_premium(v_profile.id); v_is_admin := public.partyplay_is_admin(v_profile.id);
  select item.asset_path into v_asset_path from public.pp_avatar_library item where item.id = v_profile.avatar_library_id and item.is_active;
  return jsonb_build_object(
    'id', v_profile.id, 'username', v_profile.username, 'display_name', v_profile.display_name, 'avatar_seed', v_profile.avatar_seed,
    'avatar_asset_path', v_profile.avatar_asset_path,
    'avatar_source', case when v_profile.avatar_asset_path is null then 'seed' when v_profile.avatar_library_id is not null then 'library' else 'custom' end,
    'presence', v_profile.presence, 'theme_preference', v_profile.theme_preference, 'allow_friend_requests', v_profile.allow_friend_requests,
    'membership_tier', case when v_is_premium then 'premium' else 'standard' end, 'premium_until', v_profile.premium_until, 'is_verified', v_is_premium,
    'site_role', case when v_is_admin then 'site_admin' else 'member' end, 'profile_tagline', case when v_is_premium or v_is_admin then v_profile.profile_tagline else '' end,
    'premium_ring_enabled', v_profile.premium_ring_enabled and (v_is_premium or v_is_admin), 'premium_ring_color', v_profile.premium_ring_color
  );
end;
$$;

create or replace function public.partyplay_lookup_profile(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_profile public.pp_profiles; v_username text := lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', '')); v_is_premium boolean; v_is_admin boolean; v_asset_path text;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_profile from public.pp_profiles where username = v_username;
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  v_is_premium := public.partyplay_is_premium(v_profile.id); v_is_admin := public.partyplay_is_admin(v_profile.id);
  select item.asset_path into v_asset_path from public.pp_avatar_library item where item.id = v_profile.avatar_library_id and item.is_active;
  return jsonb_build_object(
    'id', v_profile.id, 'username', v_profile.username, 'display_name', v_profile.display_name, 'avatar_seed', v_profile.avatar_seed,
    'avatar_asset_path', v_profile.avatar_asset_path,
    'presence', v_profile.presence, 'membership_tier', case when v_is_premium then 'premium' else 'standard' end, 'premium_until', v_profile.premium_until, 'is_verified', v_is_premium,
    'site_role', case when v_is_admin then 'site_admin' else 'member' end, 'profile_tagline', case when v_is_premium or v_is_admin then v_profile.profile_tagline else '' end,
    'premium_ring_enabled', v_profile.premium_ring_enabled and (v_is_premium or v_is_admin), 'premium_ring_color', v_profile.premium_ring_color
  );
end;
$$;

revoke all on table public.pp_avatar_library from public;
revoke all on function public.partyplay_avatar_catalog() from public;
revoke all on function public.partyplay_admin_avatar_library() from public;
revoke all on function public.partyplay_admin_register_avatar(text, text, text) from public;
revoke all on function public.partyplay_admin_update_avatar(uuid, text, text, boolean) from public;
revoke all on function public.partyplay_admin_set_custom_avatar(text) from public;
revoke all on function public.partyplay_update_profile(text, text, text, boolean, text, uuid, text, boolean, text) from public;
revoke all on function public.partyplay_ensure_profile(text) from public;
revoke all on function public.partyplay_lookup_profile(text) from public;

grant execute on function public.partyplay_avatar_catalog() to authenticated;
grant execute on function public.partyplay_admin_avatar_library() to authenticated;
grant execute on function public.partyplay_admin_register_avatar(text, text, text) to authenticated;
grant execute on function public.partyplay_admin_update_avatar(uuid, text, text, boolean) to authenticated;
grant execute on function public.partyplay_admin_set_custom_avatar(text) to authenticated;
grant execute on function public.partyplay_update_profile(text, text, text, boolean, text, uuid, text, boolean, text) to authenticated;
grant execute on function public.partyplay_ensure_profile(text) to authenticated;
grant execute on function public.partyplay_lookup_profile(text) to authenticated;

notify pgrst, 'reload schema';
