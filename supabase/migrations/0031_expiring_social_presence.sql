begin;

alter table public.pp_profiles
  add column if not exists presence_updated_at timestamptz not null default now();

create or replace function public.partyplay_touch_profile_presence()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.presence is distinct from old.presence then
    new.presence_updated_at:=now();
  end if;
  return new;
end;
$$;

drop trigger if exists pp_profiles_touch_presence on public.pp_profiles;
create trigger pp_profiles_touch_presence
before update of presence on public.pp_profiles
for each row execute procedure public.partyplay_touch_profile_presence();

create or replace function public.partyplay_heartbeat_presence()
returns timestamptz language plpgsql security definer set search_path=public as $$
declare v_updated timestamptz;
begin
  if auth.uid() is null then perform public.partyplay_social_error('NOT_AUTHENTICATED'); end if;
  update public.pp_profiles set presence_updated_at=now()
  where id=auth.uid() and presence in ('online','in_game')
  returning presence_updated_at into v_updated;
  return v_updated;
end;
$$;

revoke all on function public.partyplay_touch_profile_presence() from public;
revoke all on function public.partyplay_heartbeat_presence() from public;
grant execute on function public.partyplay_heartbeat_presence() to authenticated;
notify pgrst,'reload schema';
commit;
