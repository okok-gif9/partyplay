-- PartyPlay: professional account onboarding and browser-notification preferences.
-- This migration is additive. Existing profiles, rooms, and activity events remain intact.

begin;

-- Preserve a user-selected ID from Auth metadata. Existing accounts retain their current username.
create or replace function public.partyplay_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_username text;
  v_display_name text := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'بازیکن جدید'), 40);
  v_email_base text;
begin
  if v_requested_username ~ '^[a-z0-9_]{3,24}$' then
    v_username := v_requested_username;
  else
    v_email_base := lower(regexp_replace(split_part(coalesce(new.email, 'player'), '@', 1), '[^a-z0-9_]+', '', 'g'));
    if char_length(v_email_base) < 3 then v_email_base := 'player'; end if;
    v_username := left(v_email_base, 17) || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  begin
    insert into public.pp_profiles (id, username, display_name, avatar_seed, presence)
    values (new.id, v_username, v_display_name, 'mint', 'online');
  exception when unique_violation then
    if v_requested_username ~ '^[a-z0-9_]{3,24}$' then
      raise exception 'USERNAME_TAKEN' using errcode = 'P0001';
    end if;
    raise;
  end;

  return new;
end;
$$;

create table if not exists public.pp_notification_preferences (
  user_id uuid primary key references public.pp_profiles(id) on delete cascade,
  browser_enabled boolean not null default false,
  categories jsonb not null default jsonb_build_object(
    'friend_request', true,
    'room_invite', true,
    'game_started', true,
    'your_turn', true,
    'achievement', false,
    'security', true
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pp_notification_preferences_categories_object check (jsonb_typeof(categories) = 'object')
);

create table if not exists public.pp_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pp_profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 8 and 512),
  auth text not null check (char_length(auth) between 8 and 512),
  expiration_time bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists pp_web_push_subscriptions_user_idx on public.pp_web_push_subscriptions(user_id);

create trigger pp_notification_preferences_updated_at
before update on public.pp_notification_preferences
for each row execute procedure public.partyplay_set_updated_at();

create trigger pp_web_push_subscriptions_updated_at
before update on public.pp_web_push_subscriptions
for each row execute procedure public.partyplay_set_updated_at();

alter table public.pp_notification_preferences enable row level security;
alter table public.pp_web_push_subscriptions enable row level security;

create policy "pp_notification_preferences_visible_to_owner" on public.pp_notification_preferences
for select to authenticated using (user_id = auth.uid());

create policy "pp_notification_preferences_mutable_by_owner" on public.pp_notification_preferences
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "pp_notification_preferences_creatable_by_owner" on public.pp_notification_preferences
for insert to authenticated with check (user_id = auth.uid());

-- Web Push endpoints are never returned by the client API. Mutation occurs only through RPC.

alter table public.pp_activity_events drop constraint if exists pp_activity_events_kind_check;
alter table public.pp_activity_events add constraint pp_activity_events_kind_check check (
  kind in ('friend_request', 'friend_accepted', 'group_added', 'room_invite', 'game_started', 'your_turn', 'game_finished', 'achievement', 'report_update', 'security')
);

create or replace function public.partyplay_notification_preferences()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preferences public.pp_notification_preferences;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into public.pp_notification_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;
  select * into v_preferences from public.pp_notification_preferences where user_id = auth.uid();
  return jsonb_build_object('browser_enabled', v_preferences.browser_enabled, 'categories', v_preferences.categories);
end;
$$;

create or replace function public.partyplay_update_notification_preferences(
  p_browser_enabled boolean default null,
  p_categories jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.pp_notification_preferences;
  v_input jsonb;
  v_categories jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into public.pp_notification_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select * into v_current from public.pp_notification_preferences where user_id = auth.uid() for update;
  v_input := coalesce(p_categories, '{}'::jsonb);
  if jsonb_typeof(v_input) <> 'object' then raise exception 'INVALID_NOTIFICATION_CATEGORY'; end if;
  v_categories := jsonb_build_object(
    'friend_request', case when jsonb_typeof(v_input -> 'friend_request') = 'boolean' then (v_input ->> 'friend_request')::boolean else coalesce((v_current.categories ->> 'friend_request')::boolean, true) end,
    'room_invite', case when jsonb_typeof(v_input -> 'room_invite') = 'boolean' then (v_input ->> 'room_invite')::boolean else coalesce((v_current.categories ->> 'room_invite')::boolean, true) end,
    'game_started', case when jsonb_typeof(v_input -> 'game_started') = 'boolean' then (v_input ->> 'game_started')::boolean else coalesce((v_current.categories ->> 'game_started')::boolean, true) end,
    'your_turn', case when jsonb_typeof(v_input -> 'your_turn') = 'boolean' then (v_input ->> 'your_turn')::boolean else coalesce((v_current.categories ->> 'your_turn')::boolean, true) end,
    'achievement', case when jsonb_typeof(v_input -> 'achievement') = 'boolean' then (v_input ->> 'achievement')::boolean else coalesce((v_current.categories ->> 'achievement')::boolean, false) end,
    'security', case when jsonb_typeof(v_input -> 'security') = 'boolean' then (v_input ->> 'security')::boolean else coalesce((v_current.categories ->> 'security')::boolean, true) end
  );

  update public.pp_notification_preferences
  set browser_enabled = coalesce(p_browser_enabled, browser_enabled), categories = v_categories
  where user_id = auth.uid()
  returning * into v_current;
  return jsonb_build_object('browser_enabled', v_current.browser_enabled, 'categories', v_current.categories);
end;
$$;

create or replace function public.partyplay_save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_expiration_time bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_endpoint !~ '^https://' or char_length(coalesce(p_p256dh, '')) < 8 or char_length(coalesce(p_auth, '')) < 8 then
    raise exception 'PUSH_SUBSCRIPTION_INVALID';
  end if;
  insert into public.pp_web_push_subscriptions (user_id, endpoint, p256dh, auth, expiration_time)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_expiration_time)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, expiration_time = excluded.expiration_time;
end;
$$;

create or replace function public.partyplay_remove_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.pp_web_push_subscriptions where user_id = auth.uid() and endpoint = p_endpoint;
end;
$$;

revoke all on function public.partyplay_notification_preferences() from public;
revoke all on function public.partyplay_update_notification_preferences(boolean, jsonb) from public;
revoke all on function public.partyplay_save_push_subscription(text, text, text, bigint) from public;
revoke all on function public.partyplay_remove_push_subscription(text) from public;
grant execute on function public.partyplay_notification_preferences() to authenticated;
grant execute on function public.partyplay_update_notification_preferences(boolean, jsonb) to authenticated;
grant execute on function public.partyplay_save_push_subscription(text, text, text, bigint) to authenticated;
grant execute on function public.partyplay_remove_push_subscription(text) to authenticated;

notify pgrst, 'reload schema';
commit;
