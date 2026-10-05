begin;

alter table public.pp_profiles
  add column if not exists bio text not null default '';

alter table public.pp_profiles
  drop constraint if exists pp_profiles_bio_length_check;
alter table public.pp_profiles
  add constraint pp_profiles_bio_length_check check (char_length(bio) <= 280);

alter table public.pp_profiles
  drop constraint if exists pp_profiles_presence_check;
alter table public.pp_profiles
  add constraint pp_profiles_presence_check
  check (presence in ('online', 'away', 'busy', 'offline', 'in_game'));

create or replace function public.partyplay_my_profile_bio()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bio text;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;
  select bio into v_bio from public.pp_profiles where id = auth.uid();
  if not found then
    perform public.partyplay_social_error('PROFILE_NOT_FOUND');
  end if;
  return jsonb_build_object('bio', coalesce(v_bio, ''));
end;
$$;

create or replace function public.partyplay_update_profile_bio(p_bio text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bio text := btrim(coalesce(p_bio, ''));
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;
  if char_length(v_bio) > 280 then
    perform public.partyplay_social_error('BIO_TOO_LONG');
  end if;
  update public.pp_profiles set bio = v_bio where id = auth.uid();
  if not found then
    perform public.partyplay_social_error('PROFILE_NOT_FOUND');
  end if;
  return jsonb_build_object('bio', v_bio);
end;
$$;

create or replace function public.partyplay_set_presence(p_presence text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.pp_profiles;
begin
  if auth.uid() is null then
    perform public.partyplay_social_error('NOT_AUTHENTICATED');
  end if;
  if p_presence not in ('online', 'away', 'busy', 'offline', 'in_game') then
    perform public.partyplay_social_error('INVALID_PRESENCE');
  end if;
  update public.pp_profiles set presence = p_presence where id = auth.uid() returning * into v_profile;
  if not found then
    perform public.partyplay_social_error('PROFILE_NOT_FOUND');
  end if;
  return jsonb_build_object('id', v_profile.id, 'username', v_profile.username,
    'display_name', v_profile.display_name, 'presence', v_profile.presence);
end;
$$;

revoke all on function public.partyplay_my_profile_bio() from public;
revoke all on function public.partyplay_update_profile_bio(text) from public;
revoke all on function public.partyplay_set_presence(text) from public;
grant execute on function public.partyplay_my_profile_bio() to authenticated;
grant execute on function public.partyplay_update_profile_bio(text) to authenticated;
grant execute on function public.partyplay_set_presence(text) to authenticated;

notify pgrst, 'reload schema';
commit;
