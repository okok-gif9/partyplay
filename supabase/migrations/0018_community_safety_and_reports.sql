-- Personal safety controls: user blocks, private reports, and an admin-only review queue.

create table if not exists public.pp_user_blocks (
  blocker_id uuid not null references public.pp_profiles(id) on delete cascade,
  blocked_id uuid not null references public.pp_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.pp_user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.pp_profiles(id) on delete cascade,
  target_user_id uuid not null references public.pp_profiles(id) on delete cascade,
  category text not null check (category in ('harassment', 'spam', 'cheating', 'inappropriate_content', 'other')),
  details text not null check (char_length(details) between 10 and 600),
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  admin_note text,
  reviewed_by uuid references public.pp_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> target_user_id),
  check (admin_note is null or char_length(admin_note) between 8 and 280)
);

create index if not exists pp_user_blocks_blocked_idx on public.pp_user_blocks(blocked_id, created_at desc);
create index if not exists pp_user_reports_target_created_idx on public.pp_user_reports(target_user_id, created_at desc);
create index if not exists pp_user_reports_status_created_idx on public.pp_user_reports(status, created_at asc);

alter table public.pp_user_blocks enable row level security;
alter table public.pp_user_reports enable row level security;

create or replace function public.partyplay_is_blocked_relation(p_first_id uuid, p_second_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_first_id is not null and p_second_id is not null and exists (
    select 1 from public.pp_user_blocks
    where (blocker_id = p_first_id and blocked_id = p_second_id)
       or (blocker_id = p_second_id and blocked_id = p_first_id)
  );
$$;

create or replace function public.partyplay_block_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_target public.pp_profiles;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if p_target_user_id = auth.uid() then perform public.partyplay_social_error('CANNOT_BLOCK_SELF'); end if;
  select * into v_target from public.pp_profiles where id = p_target_user_id;
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;

  insert into public.pp_user_blocks (blocker_id, blocked_id)
  values (auth.uid(), p_target_user_id)
  on conflict do nothing;

  delete from public.pp_friendships
  where user_a = least(auth.uid(), p_target_user_id) and user_b = greatest(auth.uid(), p_target_user_id);
  delete from public.pp_friend_requests
  where status = 'pending' and ((requester_id = auth.uid() and addressee_id = p_target_user_id) or (requester_id = p_target_user_id and addressee_id = auth.uid()));

  return jsonb_build_object('id', v_target.id, 'username', v_target.username, 'display_name', v_target.display_name, 'avatar_seed', v_target.avatar_seed, 'presence', v_target.presence, 'membership_tier', case when public.partyplay_is_premium(v_target.id) then 'premium' else 'standard' end, 'is_verified', public.partyplay_is_premium(v_target.id), 'site_role', case when public.partyplay_is_admin(v_target.id) then 'site_admin' else 'member' end);
end;
$$;

create or replace function public.partyplay_unblock_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  delete from public.pp_user_blocks where blocker_id = auth.uid() and blocked_id = p_target_user_id;
end;
$$;

create or replace function public.partyplay_my_blocks()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', profile.id, 'username', profile.username, 'display_name', profile.display_name,
    'avatar_seed', profile.avatar_seed, 'presence', profile.presence,
    'membership_tier', case when public.partyplay_is_premium(profile.id) then 'premium' else 'standard' end,
    'premium_until', profile.premium_until, 'is_verified', public.partyplay_is_premium(profile.id),
    'site_role', case when public.partyplay_is_admin(profile.id) then 'site_admin' else 'member' end,
    'profile_tagline', case when public.partyplay_is_premium(profile.id) or public.partyplay_is_admin(profile.id) then profile.profile_tagline else '' end,
    'blocked_at', block.created_at
  ) order by block.created_at desc), '[]'::jsonb)
  from public.pp_user_blocks block
  join public.pp_profiles profile on profile.id = block.blocked_id
  where block.blocker_id = auth.uid();
$$;

create or replace function public.partyplay_submit_user_report(p_target_user_id uuid, p_category text, p_details text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_report public.pp_user_reports; v_category text := lower(btrim(coalesce(p_category, ''))); v_details text := btrim(coalesce(p_details, ''));
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  if p_target_user_id = auth.uid() then perform public.partyplay_social_error('CANNOT_REPORT_SELF'); end if;
  if not exists (select 1 from public.pp_profiles where id = p_target_user_id) then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  if v_category not in ('harassment', 'spam', 'cheating', 'inappropriate_content', 'other') then perform public.partyplay_social_error('INVALID_REPORT_CATEGORY'); end if;
  if char_length(v_details) < 10 then perform public.partyplay_social_error('REPORT_DETAILS_REQUIRED'); end if;
  if exists (select 1 from public.pp_user_reports where reporter_id = auth.uid() and target_user_id = p_target_user_id and category = v_category and created_at >= now() - interval '15 minutes') then perform public.partyplay_social_error('REPORT_RATE_LIMITED'); end if;

  insert into public.pp_user_reports (reporter_id, target_user_id, category, details)
  values (auth.uid(), p_target_user_id, v_category, left(v_details, 600))
  returning * into v_report;
  return jsonb_build_object('id', v_report.id, 'status', v_report.status, 'created_at', v_report.created_at);
end;
$$;

create or replace function public.partyplay_my_reports()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', report.id, 'category', report.category, 'status', report.status, 'created_at', report.created_at, 'target_display_name', target.display_name) order by report.created_at desc), '[]'::jsonb)
  from public.pp_user_reports report join public.pp_profiles target on target.id = report.target_user_id
  where report.reporter_id = auth.uid();
$$;

-- Blocked relationships cannot create or accept new friendships or direct group additions.
create or replace function public.partyplay_send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_target public.pp_profiles; v_request public.pp_friend_requests; v_low uuid; v_high uuid;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_target from public.pp_profiles where username = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  if v_target.id = auth.uid() then perform public.partyplay_social_error('CANNOT_ADD_SELF'); end if;
  if public.partyplay_is_blocked_relation(auth.uid(), v_target.id) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  if not v_target.allow_friend_requests then perform public.partyplay_social_error('FRIEND_REQUESTS_DISABLED'); end if;
  v_low := least(auth.uid(), v_target.id); v_high := greatest(auth.uid(), v_target.id);
  if exists (select 1 from public.pp_friendships where user_a = v_low and user_b = v_high) then perform public.partyplay_social_error('ALREADY_FRIENDS'); end if;
  select * into v_request from public.pp_friend_requests where (requester_id = auth.uid() and addressee_id = v_target.id) or (requester_id = v_target.id and addressee_id = auth.uid()) order by created_at desc limit 1;
  if found and v_request.status = 'pending' then perform public.partyplay_social_error('REQUEST_ALREADY_PENDING'); end if;
  insert into public.pp_friend_requests (requester_id, addressee_id, status, responded_at) values (auth.uid(), v_target.id, 'pending', null) on conflict (requester_id, addressee_id) do update set status = 'pending', responded_at = null, created_at = now() returning * into v_request;
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'target_name', v_target.display_name);
end;
$$;

create or replace function public.partyplay_respond_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_request public.pp_friend_requests; v_low uuid; v_high uuid;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select * into v_request from public.pp_friend_requests where id = p_request_id and addressee_id = auth.uid() and status = 'pending' for update;
  if not found then perform public.partyplay_social_error('REQUEST_NOT_ACTIONABLE'); end if;
  if p_accept and public.partyplay_is_blocked_relation(v_request.requester_id, v_request.addressee_id) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  update public.pp_friend_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = v_request.id;
  if p_accept then v_low := least(v_request.requester_id, v_request.addressee_id); v_high := greatest(v_request.requester_id, v_request.addressee_id); insert into public.pp_friendships (user_a, user_b) values (v_low, v_high) on conflict do nothing; end if;
  return jsonb_build_object('id', v_request.id, 'status', case when p_accept then 'accepted' else 'declined' end);
end;
$$;

create or replace function public.partyplay_add_group_member(p_group_id uuid, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_role text; v_target public.pp_profiles;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  select role into v_role from public.pp_group_members where group_id = p_group_id and user_id = auth.uid();
  if v_role not in ('owner', 'admin') then perform public.partyplay_social_error('GROUP_PERMISSION_DENIED'); end if;
  select * into v_target from public.pp_profiles where username = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
  if not found then perform public.partyplay_social_error('PROFILE_NOT_FOUND'); end if;
  if public.partyplay_is_blocked_relation(auth.uid(), v_target.id) then perform public.partyplay_social_error('USER_BLOCKED'); end if;
  insert into public.pp_group_members (group_id, user_id, role) values (p_group_id, v_target.id, 'member') on conflict (group_id, user_id) do nothing;
  return jsonb_build_object('id', v_target.id, 'display_name', v_target.display_name, 'username', v_target.username, 'avatar_seed', v_target.avatar_seed);
end;
$$;

create or replace function public.partyplay_admin_reports(p_status text default 'open', p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text := lower(btrim(coalesce(p_status, 'open'))); v_limit integer := greatest(1, least(coalesce(p_limit, 30), 80));
begin
  perform public.partyplay_require_admin();
  if v_status not in ('open', 'reviewing', 'closed', 'all') then perform public.partyplay_admin_error('INVALID_REPORT_STATUS'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', report.id, 'category', report.category, 'details', report.details, 'status', report.status, 'created_at', report.created_at,
    'admin_note', report.admin_note, 'reporter', jsonb_build_object('id', reporter.id, 'display_name', reporter.display_name, 'username', reporter.username, 'avatar_seed', reporter.avatar_seed),
    'target', jsonb_build_object('id', target.id, 'display_name', target.display_name, 'username', target.username, 'avatar_seed', target.avatar_seed)
  ) order by report.created_at asc), '[]'::jsonb) from (
    select * from public.pp_user_reports where v_status = 'all' or status = v_status order by created_at asc limit v_limit
  ) report join public.pp_profiles reporter on reporter.id = report.reporter_id join public.pp_profiles target on target.id = report.target_user_id);
end;
$$;

create or replace function public.partyplay_admin_update_report(p_report_id uuid, p_status text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_admin_id uuid; v_report public.pp_user_reports; v_status text := lower(btrim(coalesce(p_status, ''))); v_note text := btrim(coalesce(p_note, ''));
begin
  v_admin_id := public.partyplay_require_admin();
  if v_status not in ('reviewing', 'closed') then perform public.partyplay_admin_error('INVALID_REPORT_STATUS'); end if;
  if char_length(v_note) < 8 then perform public.partyplay_admin_error('MODERATION_REASON_REQUIRED'); end if;
  update public.pp_user_reports set status = v_status, admin_note = left(v_note, 280), reviewed_by = v_admin_id, reviewed_at = now() where id = p_report_id returning * into v_report;
  if not found then perform public.partyplay_admin_error('REPORT_NOT_FOUND'); end if;
  insert into public.pp_account_action_events (actor_id, target_user_id, action, reason, metadata) values (v_admin_id, v_report.target_user_id, 'user_report_reviewed', left(v_note, 280), jsonb_build_object('report_id', v_report.id, 'status', v_status, 'category', v_report.category));
  return jsonb_build_object('id', v_report.id, 'status', v_report.status, 'admin_note', v_report.admin_note, 'reviewed_at', v_report.reviewed_at);
end;
$$;

revoke all on function public.partyplay_block_user(uuid) from public;
revoke all on function public.partyplay_unblock_user(uuid) from public;
revoke all on function public.partyplay_my_blocks() from public;
revoke all on function public.partyplay_submit_user_report(uuid, text, text) from public;
revoke all on function public.partyplay_my_reports() from public;
revoke all on function public.partyplay_admin_reports(text, integer) from public;
revoke all on function public.partyplay_admin_update_report(uuid, text, text) from public;
grant execute on function public.partyplay_block_user(uuid) to authenticated;
grant execute on function public.partyplay_unblock_user(uuid) to authenticated;
grant execute on function public.partyplay_my_blocks() to authenticated;
grant execute on function public.partyplay_submit_user_report(uuid, text, text) to authenticated;
grant execute on function public.partyplay_my_reports() to authenticated;
grant execute on function public.partyplay_admin_reports(text, integer) to authenticated;
grant execute on function public.partyplay_admin_update_report(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
