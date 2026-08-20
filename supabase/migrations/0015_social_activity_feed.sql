-- Private in-app activity feed for social events. No browser client receives privileged write access.

create table if not exists public.pp_activity_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.pp_profiles(id) on delete cascade,
  actor_id uuid references public.pp_profiles(id) on delete set null,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'group_added', 'room_invite', 'game_finished', 'achievement', 'report_update')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 280),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists pp_activity_events_recipient_created_idx on public.pp_activity_events(recipient_id, created_at desc);
create index if not exists pp_activity_events_recipient_unread_idx on public.pp_activity_events(recipient_id) where read_at is null;

alter table public.pp_activity_events enable row level security;
alter table public.pp_activity_events replica identity full;
alter publication supabase_realtime add table public.pp_activity_events;

create policy "pp_activity_events_visible_to_recipient" on public.pp_activity_events
for select to authenticated using (recipient_id = auth.uid());

create policy "pp_activity_events_markable_by_recipient" on public.pp_activity_events
for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create or replace function public.partyplay_activity_add(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pp_activity_events (recipient_id, actor_id, kind, title, body, payload)
  values (p_recipient_id, p_actor_id, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 280), coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.partyplay_activity_friend_request_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  if tg_op = 'INSERT' or (new.status = 'pending' and old.status is distinct from 'pending') then
    select display_name into v_actor_name from public.pp_profiles where id = new.requester_id;
    perform public.partyplay_activity_add(
      new.addressee_id, new.requester_id, 'friend_request',
      'درخواست دوستی جدید',
      coalesce(v_actor_name, 'یک بازیکن') || ' می‌خواهد به جمع تو اضافه شود.',
      jsonb_build_object('request_id', new.id)
    );
  elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
    select display_name into v_actor_name from public.pp_profiles where id = new.addressee_id;
    perform public.partyplay_activity_add(
      new.requester_id, new.addressee_id, 'friend_accepted',
      'درخواست دوستی پذیرفته شد',
      coalesce(v_actor_name, 'بازیکن') || ' حالا دوست توست.',
      jsonb_build_object('request_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists pp_activity_friend_request on public.pp_friend_requests;
create trigger pp_activity_friend_request
after insert or update of status on public.pp_friend_requests
for each row execute procedure public.partyplay_activity_friend_request_trigger();

create or replace function public.partyplay_activity_group_member_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_name text;
  v_actor uuid;
begin
  select name, owner_id into v_group_name, v_actor from public.pp_groups where id = new.group_id;
  if new.user_id <> v_actor then
    perform public.partyplay_activity_add(
      new.user_id, v_actor, 'group_added',
      'به یک گروه اضافه شدی',
      'اکنون عضو گروه «' || coalesce(v_group_name, 'PartyPlay') || '» هستی.',
      jsonb_build_object('group_id', new.group_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists pp_activity_group_member on public.pp_group_members;
create trigger pp_activity_group_member
after insert on public.pp_group_members
for each row execute procedure public.partyplay_activity_group_member_trigger();

create or replace function public.partyplay_activity_feed(p_limit integer default 30)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', activity.id,
    'kind', activity.kind,
    'title', activity.title,
    'body', activity.body,
    'payload', activity.payload,
    'created_at', activity.created_at,
    'read_at', activity.read_at,
    'actor', case when actor.id is null then null else jsonb_build_object(
      'id', actor.id,
      'username', actor.username,
      'display_name', actor.display_name,
      'avatar_seed', actor.avatar_seed
    ) end
  ) order by activity.created_at desc), '[]'::jsonb)
  from (
    select * from public.pp_activity_events
    where recipient_id = auth.uid()
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) activity
  left join public.pp_profiles actor on actor.id = activity.actor_id;
$$;

create or replace function public.partyplay_mark_activity_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;
  update public.pp_activity_events
  set read_at = now()
  where recipient_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.partyplay_activity_add(uuid, uuid, text, text, text, jsonb) from public;
revoke all on function public.partyplay_activity_feed(integer) from public;
revoke all on function public.partyplay_mark_activity_read(uuid[]) from public;
grant execute on function public.partyplay_activity_feed(integer) to authenticated;
grant execute on function public.partyplay_mark_activity_read(uuid[]) to authenticated;

notify pgrst, 'reload schema';
