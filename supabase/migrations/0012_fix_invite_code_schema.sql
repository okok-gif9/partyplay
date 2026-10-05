-- Supabase installs pgcrypto in the extensions schema; qualify it explicitly because
-- room-creation RPCs intentionally run with search_path limited to public.
create or replace function public.partyplay_invite_code()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
$$;

revoke all on function public.partyplay_invite_code() from public;
grant execute on function public.partyplay_invite_code() to authenticated;
notify pgrst, 'reload schema';
